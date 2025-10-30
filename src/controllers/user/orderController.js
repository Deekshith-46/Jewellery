const mongoose = require('mongoose');
const Order = require('../../models/user/Order');
const Cart = require('../../models/user/Cart');
const Variant = require('../../models/admin/Variant');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');

/**
 * Checkout from cart and create order
 * POST /api/orders/checkout
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
      shippingCost = 0,
      taxes = 0,
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
        // Design-Your-Own item
        orderItem.product = cartItem.product._id;
        orderItem.productSku = cartItem.productSku;
        orderItem.productName = cartItem.product.productName;
        orderItem.selectedMetal = cartItem.selectedMetal;
        orderItem.selectedShape = cartItem.selectedShape;
        orderItem.selectedCarat = cartItem.selectedCarat;
        
        if (cartItem.selectedDiamond) {
          orderItem.selectedDiamond = cartItem.selectedDiamond._id;
          orderItem.diamondSku = cartItem.diamondSku;
        }
        
        // Snapshot
        orderItem.itemSnapshot = {
          title: cartItem.product.productName || cartItem.product.title,
          description: cartItem.product.description,
          images: cartItem.product.default_images || [],
          specifications: {
            metal: cartItem.selectedMetal,
            shape: cartItem.selectedShape,
            carat: cartItem.selectedCarat,
            diamond: cartItem.selectedDiamond ? {
              sku: cartItem.selectedDiamond.sku,
              shape: cartItem.selectedDiamond.shape,
              carat: cartItem.selectedDiamond.carat,
              cut: cartItem.selectedDiamond.cut,
              color: cartItem.selectedDiamond.color,
              clarity: cartItem.selectedDiamond.clarity
            } : null
          }
        };
      }
      
      orderItems.push(orderItem);
      subtotal += cartItem.totalPrice;
    }
    
    // Calculate total
    const shipping = Number(shippingCost) || 0;
    const tax = Number(taxes) || 0;
    const disc = Number(discount) || 0;
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
    
    // Populate order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.variant', 'variant_sku productSku metal_type shape carat price')
      .populate('items.product', 'productSku productName title')
      .populate('items.selectedDiamond', 'sku shape carat cut color clarity price')
      .lean();
    
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
      .populate('items.product', 'productSku productName title')
      .populate('items.selectedDiamond', 'sku shape carat cut color clarity price')
      .lean();
    
    const total = await Order.countDocuments(query);
    
    res.json({
      success: true,
      count: orders.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)),
      orders
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
    
    // Populate references
    await order.populate('items.variant', 'variant_sku productSku metal_type shape carat price');
    await order.populate('items.product', 'productSku productName title');
    await order.populate('items.selectedDiamond', 'sku shape carat cut color clarity price');
    
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
