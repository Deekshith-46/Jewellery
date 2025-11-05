const mongoose = require('mongoose');
const Order = require('../../models/user/Order');
const Cart = require('../../models/user/Cart');
const Variant = require('../../models/admin/Variant');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');

/**
 * Checkout from cart and create order
 * POST /api/orders/checkout
 * 
 * Tax and shipping are calculated automatically:
 * - Tax: 9% of subtotal (configurable via TAX_RATE env var)
 * - Shipping: Free for orders > 50000, else 500 (configurable via SHIPPING_* env vars)
 */
exports.checkoutFromCart = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { 
      contactEmail,
      contactPhone,
      shippingAddress,
      billingAddress,
      paymentMethod,
      discount = 0,
      customerNotes
    } = req.body;
    
    // Validation
    if (!contactEmail) {
      return res.status(400).json({ 
        success: false,
        message: 'Contact email is required' 
      });
    }
    
    if (!shippingAddress || !shippingAddress.firstName || !shippingAddress.address || !shippingAddress.city) {
      return res.status(400).json({ 
        success: false,
        message: 'Complete shipping address is required' 
      });
    }
    
    if (!paymentMethod) {
      return res.status(400).json({ 
        success: false,
        message: 'Payment method is required' 
      });
    }
    
    // Get cart
    const cart = await Cart.findOne({ userId })
      .populate('items.variant')
      .populate('items.product')
      .populate('items.selectedDiamond');
    
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Cart is empty' 
      });
    }
    
    // Verify stock availability for RTS items
    for (const item of cart.items) {
      if (item.itemType === 'rts' && item.variant) {
        const variant = await Variant.findById(item.variant._id);
        if (!variant) {
          return res.status(400).json({ 
            success: false,
            message: `Variant ${item.variant_sku} is no longer available` 
          });
        }
        if (!variant.active) {
          return res.status(400).json({ 
            success: false,
            message: `Variant ${item.variant_sku} is no longer active` 
          });
        }
        if (variant.stock < item.quantity) {
          return res.status(400).json({ 
            success: false,
            message: `Insufficient stock for ${item.variant_sku}. Only ${variant.stock} available.` 
          });
        }
      }
    }
    
    // Prepare order items
    const orderItems = [];
    let subtotal = 0;
    
    for (const cartItem of cart.items) {
      const orderItem = {
        itemType: cartItem.itemType,
        quantity: cartItem.quantity,
        pricePerItem: cartItem.pricePerItem,
        totalPrice: cartItem.totalPrice,
        engraving: cartItem.engraving,
        specialInstructions: cartItem.specialInstructions
      };
      
      // Copy price breakdown if available (for DYO items)
      if (cartItem.priceBreakdown) {
        orderItem.priceBreakdown = {
          metal_cost: cartItem.priceBreakdown.metal_cost,
          diamond_price: cartItem.priceBreakdown.diamond_price,
          metal_weight: cartItem.priceBreakdown.metal_weight
        };
      }
      
      if (cartItem.itemType === 'rts') {
        // Ready-to-Ship item
        orderItem.variant = cartItem.variant._id;
        orderItem.variant_sku = cartItem.variant_sku;
        
        // Snapshot
        orderItem.itemSnapshot = {
          title: cartItem.variant.productSku || 'RTS Product',
          description: `${cartItem.variant.metal_type} - ${cartItem.variant.shape} - ${cartItem.variant.carat}ct`,
          specifications: {
            metal_type: cartItem.variant.metal_type,
            shape: cartItem.variant.shape,
            carat: cartItem.variant.carat
          }
        };
      } else {
        // Design-Your-Own item - ONLY store user-selected values
        orderItem.product = cartItem.product._id;
        orderItem.productSku = cartItem.productSku;
        orderItem.productName = cartItem.product.productName || cartItem.product.title;
        
        // Store ONLY user-selected values
        orderItem.selectedMetal = cartItem.selectedMetal;
        orderItem.selectedShape = cartItem.selectedShape;
        orderItem.selectedCarat = cartItem.selectedCarat;
        
        if (cartItem.selectedDiamond) {
          orderItem.selectedDiamond = cartItem.selectedDiamond._id;
          orderItem.diamondSku = cartItem.diamondSku;
        }
        
        // Snapshot - ONLY user-selected details (not all product options)
        orderItem.itemSnapshot = {
          title: cartItem.product.productName || cartItem.product.title,
          // Only description from product (general info)
          description: cartItem.product.description || '',
          // Only images if available (but not all product metadata)
          images: [],
          specifications: {
            // ONLY the user's selections
            metal: cartItem.selectedMetal,
            shape: cartItem.selectedShape,
            carat: cartItem.selectedCarat,
            diamond: cartItem.selectedDiamond ? {
              sku: cartItem.selectedDiamond.sku,
              shape: cartItem.selectedDiamond.shape?.label || cartItem.selectedDiamond.shape?.code || cartItem.selectedDiamond.shape,
              carat: cartItem.selectedDiamond.carat,
              cut: cartItem.selectedDiamond.cut,
              color: cartItem.selectedDiamond.color,
              purity: cartItem.selectedDiamond.purity,
              polish: cartItem.selectedDiamond.polish,
              symmetry: cartItem.selectedDiamond.symmetry,
              fluorescence: cartItem.selectedDiamond.fluorescence,
              price: cartItem.selectedDiamond.price,
              pricePerCarat: cartItem.selectedDiamond.pricePerCarat,
              certNumber: cartItem.selectedDiamond.certNumber,
              imageUrl: cartItem.selectedDiamond.imageUrl,
              videoUrl: cartItem.selectedDiamond.videoUrl
            } : null,
            // Include price breakdown
            priceBreakdown: orderItem.priceBreakdown
          }
        };
        
        // DO NOT include product metadata like:
        // - availableMetalTypes (all available metals)
        // - availableShapes (all available shapes)
        // - useAllMetals, useAllShapes (product configuration flags)
        // Only store what the USER selected!
      }
      
      orderItems.push(orderItem);
      subtotal += cartItem.totalPrice;
    }
    
    // Auto-calculate tax and shipping
    // Tax calculation (default 9%, configurable via env var)
    const TAX_RATE = Number(process.env.TAX_RATE) || 0.09; // 9% GST/VAT
    const tax = Math.round(subtotal * TAX_RATE);
    
    // Shipping calculation (configurable via env vars)
    const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD) || 50000;
    const STANDARD_SHIPPING_COST = Number(process.env.STANDARD_SHIPPING_COST) || 500;
    
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_COST;
    
    // Discount
    const disc = Number(discount) || 0;
    
    // Total calculation
    const total = subtotal + shipping + tax - disc;
    
    // Create order
    const order = new Order({
      userId,
      items: orderItems,
      subtotal,
      shippingCost: shipping,
      taxes: tax,
      discount: disc,
      total,
      contactEmail,
      contactPhone,
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      paymentMethod,
      customerNotes,
      status: 'Pending',
      paymentStatus: 'Pending'
    });
    
    await order.save();
    
    // Reduce stock for RTS items
    for (const cartItem of cart.items) {
      if (cartItem.itemType === 'rts' && cartItem.variant) {
        await Variant.findByIdAndUpdate(
          cartItem.variant._id,
          { $inc: { stock: -cartItem.quantity } }
        );
      }
    }
    
    // Clear cart
    cart.items = [];
    await cart.save();
    
    // Populate order for response - ONLY selected fields
    const populatedOrder = await Order.findById(order._id)
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price')
      .populate('items.product', 'productSku productName title description main_shape style') // Product info
      .populate({
        path: 'items.selectedDiamond',
        select: 'sku shape carat cut color purity polish symmetry fluorescence price pricePerCarat certNumber certUrl imageUrl videoUrl measurement ratio lab',
        populate: {
          path: 'shape',
          select: 'code label'
        }
      })
      .lean();
    
    // Clean up response - ensure only selected values are returned
    // Remove any full product objects with all options
    if (populatedOrder.items) {
      populatedOrder.items = populatedOrder.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Return product info (but not all available options like availableMetalTypes)
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title,
            description: item.product.description,
            main_shape: item.product.main_shape,
            style: item.product.style
          };
          // Ensure only selected values are visible
        }
        return item;
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: populatedOrder
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Get all orders for logged-in user
 * GET /api/orders
 */
exports.getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId };
    if (status) {
      query.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price')
      .populate('items.product', 'productSku productName title description main_shape style') // Product info
      .populate({
        path: 'items.selectedDiamond',
        select: 'sku shape carat cut color purity polish symmetry fluorescence price pricePerCarat certNumber certUrl imageUrl videoUrl measurement ratio lab',
        populate: {
          path: 'shape',
          select: 'code label'
        }
      })
      .lean();
    
    // Clean up - ensure only selected values are returned
    const cleanedOrders = orders.map(order => {
      if (order.items) {
        order.items = order.items.map(item => {
          if (item.itemType === 'dyo' && item.product) {
            // Only return minimal product info, not full product with all options
            item.product = {
              _id: item.product._id,
              productSku: item.product.productSku,
              productName: item.product.productName || item.product.title
            };
          }
          return item;
        });
      }
      return order;
    });
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      count: cleanedOrders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      orders: cleanedOrders
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Get single order by ID
 * GET /api/orders/:orderId
 */
exports.getOrderById = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    
    // Search by orderId string or MongoDB _id
    let order;
    if (mongoose.Types.ObjectId.isValid(orderId) && orderId.length === 24) {
      order = await Order.findOne({ _id: orderId, userId });
    } else {
      order = await Order.findOne({ orderId, userId });
    }
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    // Populate references - ONLY selected fields
    await order.populate('items.variant', 'variant_sku productSku metal_type shape carat price');
    await order.populate('items.product', 'productSku productName title'); // Minimal product info only
    await order.populate('items.selectedDiamond', 'sku shape carat cut color clarity price');
    
    // Convert to JSON and clean up - remove full product objects with all options
    const orderObj = order.toObject();
    if (orderObj.items) {
      orderObj.items = orderObj.items.map(item => {
        if (item.itemType === 'dyo' && item.product) {
          // Only return minimal product info, not full product with all options
          item.product = {
            _id: item.product._id,
            productSku: item.product.productSku,
            productName: item.product.productName || item.product.title
          };
          // Ensure only selected values are visible in response
        }
        return item;
      });
    }
    
    order = orderObj;
    
    res.json({
      success: true,
      order
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Cancel order (only if status is Pending)
 * PUT /api/orders/:orderId/cancel
 */
exports.cancelOrder = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { orderId } = req.params;
    
    const order = await Order.findOne({ orderId, userId });
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    if (order.status !== 'Pending') {
      return res.status(400).json({ 
        success: false,
        message: 'Only pending orders can be cancelled' 
      });
    }
    
    order.status = 'Cancelled';
    await order.save();
    
    // Restore stock for RTS items
    for (const item of order.items) {
      if (item.itemType === 'rts' && item.variant) {
        await Variant.findByIdAndUpdate(
          item.variant,
          { $inc: { stock: item.quantity } }
        );
      }
    }
    
    res.json({
      success: true,
      message: 'Order cancelled successfully',
      order
    });
    
  } catch (err) {
    next(err);
  }
};

/**
 * Update payment status (for payment gateway webhooks)
 * PUT /api/orders/:orderId/payment-status
 * 
 * This endpoint should be called by your payment gateway webhook
 * or by an admin after confirming payment
 */
exports.updatePaymentStatus = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentStatus, transactionId, isPaid } = req.body;
    
    // Find order (no userId check for webhook)
    const order = await Order.findOne({ orderId });
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    // Update payment fields
    if (paymentStatus) {
      order.paymentStatus = paymentStatus;
    }
    
    if (transactionId) {
      order.transactionId = transactionId;
    }
    
    if (isPaid !== undefined) {
      order.isPaid = isPaid;
      if (isPaid) {
        order.paidAt = new Date();
        // Auto-confirm order when paid
        if (order.status === 'Pending') {
          order.status = 'Confirmed';
        }
      }
    }
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Payment status updated successfully',
      order
    });
    
  } catch (err) {
    next(err);
  }
};
