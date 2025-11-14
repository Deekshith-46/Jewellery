const mongoose = require('mongoose');
const Order = require('../../models/user/Order');
const Cart = require('../../models/user/Cart');
const ExpandedVariant = require('../../models/admin/ExpandedVariant');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');
const DYOExpandedVariant = require('../../models/admin/DYOExpandedVariant');
const Address = require('../../models/user/Address');
const User = require('../../models/user/User');
const Coupon = require('../../models/admin/Coupon');

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
      shippingAddressId, // ID of previously saved address
      billingAddress,
      billingAddressId, // ID of previously saved address
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
    
    if (!paymentMethod) {
      return res.status(400).json({ 
        success: false,
        message: 'Payment method is required' 
      });
    }
    
    // Handle shipping address - either from ID or provided object
    let finalShippingAddress = null;
    if (shippingAddressId) {
      // Fetch address by ID and verify it belongs to user
      const user = await User.findOne({ _id: userId, addresses: shippingAddressId });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Shipping address not found or does not belong to user' });
      }
      const savedAddress = await Address.findById(shippingAddressId);
      if (!savedAddress) {
        return res.status(404).json({ success: false, message: 'Shipping address not found' });
      }
      finalShippingAddress = {
        firstName: savedAddress.firstName,
        lastName: savedAddress.lastName,
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country,
        phone: savedAddress.phone
      };
    } else if (shippingAddress) {
      // Use provided address object
      if (!shippingAddress.firstName || !shippingAddress.address || !shippingAddress.city) {
        return res.status(400).json({ success: false, message: 'Complete shipping address is required' });
      }
      finalShippingAddress = shippingAddress;
    } else {
      return res.status(400).json({ success: false, message: 'Shipping address or shippingAddressId is required' });
    }
    
    // Handle billing address - either from ID, provided object, or use shipping address
    let finalBillingAddress = null;
    if (billingAddressId) {
      // Fetch address by ID and verify it belongs to user
      const user = await User.findOne({ _id: userId, addresses: billingAddressId });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Billing address not found or does not belong to user' });
      }
      const savedAddress = await Address.findById(billingAddressId);
      if (!savedAddress) {
        return res.status(404).json({ success: false, message: 'Billing address not found' });
      }
      finalBillingAddress = {
        firstName: savedAddress.firstName,
        lastName: savedAddress.lastName,
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country
      };
    } else if (billingAddress) {
      // Use provided address object
      finalBillingAddress = billingAddress;
    } else {
      // Default to shipping address if no billing address provided
      finalBillingAddress = finalShippingAddress;
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
        const variant = await ExpandedVariant.findById(item.variant._id);
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
      shippingAddress: finalShippingAddress,
      billingAddress: finalBillingAddress,
      paymentMethod,
      customerNotes,
      status: 'Pending',
      paymentStatus: 'Pending'
    });
    
    await order.save();

    // Track coupon usage
    if (appliedCoupon && couponDiscount > 0) {
      const couponToUpdate = await Coupon.findById(appliedCoupon._id);
      if (couponToUpdate) {
        couponToUpdate.usedCount = (couponToUpdate.usedCount || 0) + 1;
        const usedEntry = couponToUpdate.usedByUsers.find(u => String(u.userId) === String(userId));
        if (usedEntry) {
          usedEntry.count = (usedEntry.count || 0) + 1;
        } else {
          couponToUpdate.usedByUsers.push({ userId, count: 1 });
        }
        await couponToUpdate.save();
      }
    }

    // Track coupon usage
    if (appliedCoupon && couponDiscount > 0) {
      const couponToUpdate = await Coupon.findById(appliedCoupon._id);
      if (couponToUpdate) {
        couponToUpdate.usedCount = (couponToUpdate.usedCount || 0) + 1;
        const usedEntry = couponToUpdate.usedByUsers.find(u => String(u.userId) === String(userId));
        if (usedEntry) {
          usedEntry.count = (usedEntry.count || 0) + 1;
        } else {
          couponToUpdate.usedByUsers.push({ userId, count: 1 });
        }
        await couponToUpdate.save();
      }
    }
    
    // Reduce stock for RTS items
    for (const cartItem of cart.items) {
      if (cartItem.itemType === 'rts' && cartItem.variant) {
        await ExpandedVariant.findByIdAndUpdate(
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
      .populate('items.variant', 'variantSku productSku metalType shape_code centerStoneWeight clarity color cut metalPrice stock')
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
 * Direct RTS checkout (Ready-To-Ship) for a single variant selection
 * POST /api/orders/rts/checkout
 * Body: {
 *   productSku, metalType|metalCode, shape|shapeCode, centerStoneWeight, quantity=1,
 *   contactEmail, shippingAddress|shippingAddressId, paymentMethod, discount?
 * }
 */
exports.checkoutRtsNow = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      productSku,
      metalType,
      metalCode,
      shape,
      shapeCode,
      centerStoneWeight,
      quantity = 1,
      contactEmail,
      contactPhone,
      shippingAddress,
      shippingAddressId,
      billingAddress,
      billingAddressId,
      paymentMethod,
      discount,
      couponCode
    } = req.body;

    if (!contactEmail) return res.status(400).json({ success: false, message: 'Contact email is required' });
    if (!paymentMethod) return res.status(400).json({ success: false, message: 'Payment method is required' });
    if (!productSku) return res.status(400).json({ success: false, message: 'productSku is required' });
    if (!centerStoneWeight && centerStoneWeight !== 0) {
      return res.status(400).json({ success: false, message: 'centerStoneWeight is required' });
    }

    // Shipping address handling (same as other endpoints)
    let finalShippingAddress = null;
    if (shippingAddressId) {
      const user = await User.findOne({ _id: userId, addresses: shippingAddressId });
      if (!user) return res.status(404).json({ success: false, message: 'Shipping address not found or does not belong to user' });
      const savedAddress = await Address.findById(shippingAddressId);
      if (!savedAddress) return res.status(404).json({ success: false, message: 'Shipping address not found' });
      finalShippingAddress = {
        firstName: savedAddress.firstName,
        lastName: savedAddress.lastName,
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country,
        phone: savedAddress.phone
      };
    } else if (shippingAddress) {
      if (!shippingAddress.firstName || !shippingAddress.address || !shippingAddress.city) {
        return res.status(400).json({ success: false, message: 'Complete shipping address is required' });
      }
      finalShippingAddress = shippingAddress;
    } else {
      return res.status(400).json({ success: false, message: 'Shipping address or shippingAddressId is required' });
    }

    // Billing address: optional, default to shipping
    let finalBillingAddress = null;
    if (billingAddressId) {
      const user = await User.findOne({ _id: userId, addresses: billingAddressId });
      if (!user) return res.status(404).json({ success: false, message: 'Billing address not found or does not belong to user' });
      const savedAddress = await Address.findById(billingAddressId);
      if (!savedAddress) return res.status(404).json({ success: false, message: 'Billing address not found' });
      finalBillingAddress = {
        firstName: savedAddress.firstName,
        lastName: savedAddress.lastName,
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country
      };
    } else if (billingAddress) {
      finalBillingAddress = billingAddress;
    } else {
      finalBillingAddress = finalShippingAddress;
    }

    // Normalize selection filters
    const desiredShape = shapeCode
      ? String(shapeCode).toUpperCase()
      : (shape ? String(shape).toUpperCase() : null);
    const desiredMetalType = metalType ? String(metalType) : null;
    const desiredMetalCode = metalCode ? String(metalCode).toUpperCase() : null;

    // Build query to find ExpandedVariant (RTS)
    const variantQuery = {
      productSku: productSku,
      active: true,
      centerStoneWeight: Number(centerStoneWeight)
    };
    if (desiredShape) variantQuery.shape_code = { $regex: `^${desiredShape}$`, $options: 'i' };
    if (desiredMetalCode) variantQuery.metalCode = desiredMetalCode;
    if (!desiredMetalCode && desiredMetalType) {
      variantQuery.metalType = { $regex: `^${desiredMetalType}$`, $options: 'i' };
    }

    const variant = await ExpandedVariant.findOne(variantQuery).lean();
    if (!variant) {
      return res.status(404).json({
        success: false,
        message: 'RTS variant not found for given selection',
        debug: { productSku, shape: desiredShape, centerStoneWeight: Number(centerStoneWeight), metalCode: desiredMetalCode, metalType: desiredMetalType }
      });
    }
    if (!variant.stock || variant.stock < Number(quantity)) {
      return res.status(400).json({ success: false, message: `Insufficient stock for ${variant.variantSku}. Only ${variant.stock || 0} available.` });
    }

    // Fetch product to read discountPercent if any
    let productDoc = null;
    if (variant.product) {
      productDoc = await Product.findById(variant.product).select('productSku productName title discountPercent defaultMetalWeight').lean();
    } else {
      productDoc = await Product.findOne({ productSku }).select('productSku productName title discountPercent defaultMetalWeight').lean();
    }

    // Pricing (product-level discounts first)
    const pricePerItem = Number(variant.totalPrice || variant.metalPrice || 0);
    const qty = Math.max(1, Number(quantity) || 1);
    const subtotal = pricePerItem * qty;
    const productDiscountPercent = Number(productDoc?.discountPercent || 0);
    const productPercentDiscountAmount = productDiscountPercent > 0 ? +(subtotal * (productDiscountPercent / 100)).toFixed(2) : 0;
    const extraDiscount = discount !== undefined && discount !== '' ? Math.max(0, Number(discount)) : 0;
    const TAX_RATE = Number(process.env.TAX_RATE) || 0.085;
    const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD) || 50000;
    const STANDARD_SHIPPING_COST = Number(process.env.STANDARD_SHIPPING_COST) || 500;
    let discountedSubtotal = Math.max(0, subtotal - productPercentDiscountAmount - extraDiscount);

    // Coupon application (optional)
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const normalizedCode = String(couponCode).trim().toUpperCase();
      const coupon = await Coupon.findOne({ code: normalizedCode });
      if (!coupon || coupon.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Invalid or inactive coupon code' });
      }
      const now = new Date();
      if (coupon.startDate && coupon.startDate > now) {
        return res.status(400).json({ success: false, message: 'Coupon is not yet active' });
      }
      if (coupon.endDate && coupon.endDate < now) {
        return res.status(400).json({ success: false, message: 'Coupon has expired' });
      }
      if (coupon.minOrderAmount && discountedSubtotal < coupon.minOrderAmount) {
        return res.status(400).json({ success: false, message: `Minimum order amount for this coupon is ${coupon.minOrderAmount}` });
      }
      if (coupon.maxGlobalUses && coupon.usedCount >= coupon.maxGlobalUses) {
        return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
      }
      if (coupon.maxUsesPerUser) {
        const usedEntry = coupon.usedByUsers.find(u => String(u.userId) === String(userId));
        if (usedEntry && usedEntry.count >= coupon.maxUsesPerUser) {
          return res.status(400).json({ success: false, message: 'You have already used this coupon the maximum number of times' });
        }
      }

      // Calculate coupon discount
      if (coupon.discountType === 'fixed') {
        couponDiscount = Math.min(coupon.discountValue, discountedSubtotal);
      } else if (coupon.discountType === 'percent') {
        couponDiscount = discountedSubtotal * (coupon.discountValue / 100);
        if (coupon.maxDiscountAmount) {
          couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
        }
      }
      couponDiscount = Math.max(0, Number(couponDiscount.toFixed(2)) || 0);
      discountedSubtotal = Math.max(0, discountedSubtotal - couponDiscount);
      appliedCoupon = coupon;
    }

    const shippingCost = discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_COST;
    const taxes = +(discountedSubtotal * TAX_RATE).toFixed(2);
    const total = Math.max(0, +(discountedSubtotal + shippingCost + taxes).toFixed(2));

    // Create order item (RTS)
    const orderItem = {
      itemType: 'rts',
      variant: variant._id,
      variant_sku: variant.variantSku,
      quantity: qty,
      pricePerItem,
      totalPrice: subtotal,
      itemSnapshot: {
        title: productDoc?.productName || productDoc?.title || variant.productSku,
        description: productDoc?.description || '',
        images: [],
        specifications: {
          metal_type: variant.metalType || variant.metalCode,
          shape: variant.shape_code,
          centerStoneWeight: variant.centerStoneWeight
        }
      }
    };

    // Create order
    const order = new Order({
      userId,
      items: [orderItem],
      subtotal,
      shippingCost,
      taxes,
      discount: productPercentDiscountAmount + extraDiscount + couponDiscount,
      couponId: appliedCoupon ? appliedCoupon._id : undefined,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      couponDiscount,
      total,
      contactEmail,
      contactPhone,
      shippingAddress: finalShippingAddress,
      billingAddress: finalBillingAddress,
      paymentMethod,
      status: 'Pending',
      paymentStatus: 'Pending'
    });

    await order.save();

    // Track coupon usage for RTS checkout
    if (appliedCoupon && couponDiscount > 0) {
      const couponToUpdate = await Coupon.findById(appliedCoupon._id);
      if (couponToUpdate) {
        couponToUpdate.usedCount = (couponToUpdate.usedCount || 0) + 1;
        const usedEntry = couponToUpdate.usedByUsers.find(u => String(u.userId) === String(userId));
        if (usedEntry) {
          usedEntry.count = (usedEntry.count || 0) + 1;
        } else {
          couponToUpdate.usedByUsers.push({ userId, count: 1 });
        }
        await couponToUpdate.save();
      }
    }

    // Reduce stock
    await ExpandedVariant.findByIdAndUpdate(variant._id, { $inc: { stock: -qty } });

    // Populate minimal response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.variant', 'variantSku productSku metalType shape_code centerStoneWeight metalPrice stock')
      .lean();

    return res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      pricing: { subtotal, shippingCost, tax: taxes, finalPrice: total },
      order: populatedOrder
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Direct DYO checkout (Buy Now) from a single product + diamond selection
 * POST /api/orders/dyo/checkout
 * Body: {
 *   productId|productSku, metalType|metal, shape|shapeCode, diamondSku?,
 *   quantity=1, contactEmail, shippingAddress, paymentMethod, discount? (absolute)
 * }
 * Pricing:
 *   subtotal = metalPrice + diamondPrice
 *   tax = 8.5% of subtotal (or TAX_RATE env overrides)
 *   shipping = backend computed (env thresholds)
 *   discountPercent from Product.discountPercent applied if present
 *   final total = subtotal - productPercentDiscount - discount + tax + shipping
 */
exports.checkoutDyoNow = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const {
      productId,
      productSku,
      metalType,
      metal,
      shape,
      shapeCode,
      diamondId,
      diamondSku,
      quantity = 1,
      contactEmail,
      contactPhone,
      shippingAddress,
      shippingAddressId, // ID of previously saved address
      billingAddress,
      billingAddressId, // ID of previously saved address
      paymentMethod,
      discount, // absolute amount, optional
      couponCode
    } = req.body;

    // Validate
    if (!contactEmail) return res.status(400).json({ success: false, message: 'Contact email is required' });
    if (!paymentMethod) return res.status(400).json({ success: false, message: 'Payment method is required' });
    if (!metalType && !metal) return res.status(400).json({ success: false, message: 'metalType or metal code is required' });
    if (!diamondId && !diamondSku) return res.status(400).json({ success: false, message: 'diamondId or diamondSku is required' });
    
    // Handle shipping address - either from ID or provided object
    let finalShippingAddress = null;
    if (shippingAddressId) {
      // Fetch address by ID and verify it belongs to user
      const user = await User.findOne({ _id: userId, addresses: shippingAddressId });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Shipping address not found or does not belong to user' });
      }
      const savedAddress = await Address.findById(shippingAddressId);
      if (!savedAddress) {
        return res.status(404).json({ success: false, message: 'Shipping address not found' });
      }
      finalShippingAddress = {
        firstName: savedAddress.firstName,
        lastName: savedAddress.lastName,
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country,
        phone: savedAddress.phone
      };
    } else if (shippingAddress) {
      // Use provided address object
      if (!shippingAddress.firstName || !shippingAddress.address || !shippingAddress.city) {
        return res.status(400).json({ success: false, message: 'Complete shipping address is required' });
      }
      finalShippingAddress = shippingAddress;
    } else {
      return res.status(400).json({ success: false, message: 'Shipping address or shippingAddressId is required' });
    }
    
    // Handle billing address - either from ID, provided object, or use shipping address
    let finalBillingAddress = null;
    if (billingAddressId) {
      // Fetch address by ID and verify it belongs to user
      const user = await User.findOne({ _id: userId, addresses: billingAddressId });
      if (!user) {
        return res.status(404).json({ success: false, message: 'Billing address not found or does not belong to user' });
      }
      const savedAddress = await Address.findById(billingAddressId);
      if (!savedAddress) {
        return res.status(404).json({ success: false, message: 'Billing address not found' });
      }
      finalBillingAddress = {
        firstName: savedAddress.firstName,
        lastName: savedAddress.lastName,
        address: savedAddress.address,
        city: savedAddress.city,
        state: savedAddress.state,
        postalCode: savedAddress.postalCode,
        country: savedAddress.country
      };
    } else if (billingAddress) {
      // Use provided address object
      finalBillingAddress = billingAddress;
    } else {
      // Default to shipping address if no billing address provided
      finalBillingAddress = finalShippingAddress;
    }

    // Find product
    let product = null;
    if (productSku) product = await Product.findOne({ productSku: productSku });
    if (!product && productId) product = await Product.findOne({ productId });
    if (!product && productId && mongoose.Types.ObjectId.isValid(productId)) product = await Product.findById(productId);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Get diamond first to extract shape
    let diamondDoc = null;
    if (diamondId) {
      if (!mongoose.Types.ObjectId.isValid(diamondId)) {
        return res.status(400).json({ success: false, message: 'Invalid diamondId' });
      }
      diamondDoc = await DiamondSpec.findById(diamondId).populate('shape', 'code label').select('sku price pricePerCarat shape carat cut color purity').lean();
      if (!diamondDoc) return res.status(404).json({ success: false, message: 'Diamond not found for provided diamondId' });
    } else if (diamondSku) {
      diamondDoc = await DiamondSpec.findOne({ sku: diamondSku }).populate('shape', 'code label').select('sku price pricePerCarat shape carat cut color purity').lean();
      if (!diamondDoc) return res.status(404).json({ success: false, message: 'Diamond not found for provided sku' });
    }
    const diamondPrice = Number(diamondDoc.price || 0);
    
    // Get shape from diamond (shape.code or shape label) - this is the FINAL shape for the order
    const diamondShapeCode = diamondDoc.shape?.code || diamondDoc.shape?.label || null;

    const sku = product.productSku || product.productId;
    
    // First, check DYOVariant to see if metal is available for this product (if DYOVariant exists)
    const DYOVariant = require('../../models/admin/DYOVariant');
    const dyoVariantDoc = await DYOVariant.findOne({ 
      $or: [{ product: product._id }, { productSku: sku }],
      active: true
    }).lean();
    
    let metalCodeToCheck = metal ? String(metal).toUpperCase() : null;
    let metalTypeToCheck = metalType;
    
    // If metal code provided and DYOVariant exists, check if it's in DYOVariant.metalTypes
    if (metalCodeToCheck && dyoVariantDoc) {
      const availableMetals = dyoVariantDoc.metalTypes || [];
      if (availableMetals.length > 0 && !availableMetals.includes(metalCodeToCheck)) {
        return res.status(404).json({ 
          success: false, 
          message: 'Metal not available for this product',
          debug: {
            tried: { metal: metalCodeToCheck },
            availableMetalCodes: availableMetals,
            availableMetalTypes: []
          }
        });
      }
    }
    
    // Get reference shape (optional) - used only for getting metalPrice, not stored in order
    // If provided, use it to get more accurate metalPrice; if not, get any metalPrice for that metal
    let referenceShapeCode = null;
    if (shapeCode) {
      referenceShapeCode = String(shapeCode).toUpperCase();
    } else if (shape) {
      // Map shape name to code if needed
      const SHAPE_NAME_TO_CODE = {
        'round': 'RND', 'oval': 'OVL', 'princess': 'PRN', 'cushion': 'CUS',
        'emerald': 'EMR', 'radiant': 'RAD', 'asscher': 'ASH', 'marquise': 'MAR',
        'heart': 'HRT', 'pear': 'PEA', 'baguette': 'BAG'
      };
      const normalized = String(shape).trim().toLowerCase();
      referenceShapeCode = SHAPE_NAME_TO_CODE[normalized] || String(shape).trim().toUpperCase();
    }
    
    // Now find DYOExpandedVariant for pricing
    // If reference shape is provided, use it for more accurate pricing; otherwise get any metalPrice for that metal
    const query = {
      $or: [{ product: product._id }, { productSku: sku }],
      active: true
    };
    if (metalCodeToCheck) {
      query.metalCode = metalCodeToCheck;
    } else if (metalTypeToCheck) {
      query.metalType = { $regex: `^${metalTypeToCheck}$`, $options: 'i' };
    }
    
    // If reference shape provided, add it to query for more accurate metalPrice
    if (referenceShapeCode) {
      query.shape_code = { $regex: `^${referenceShapeCode}$`, $options: 'i' };
    }

    let dyoExpandedVariant = await DYOExpandedVariant.findOne(query).sort({ updatedAt: -1 }).lean();
    
    // Fallback 1: If reference shape was provided but no match, try without shape filter
    if (!dyoExpandedVariant && referenceShapeCode) {
      const queryWithoutShape = {
        $or: [{ product: product._id }, { productSku: sku }],
        active: true
      };
      if (metalCodeToCheck) {
        queryWithoutShape.metalCode = metalCodeToCheck;
      } else if (metalTypeToCheck) {
        queryWithoutShape.metalType = { $regex: `^${metalTypeToCheck}$`, $options: 'i' };
      }
      dyoExpandedVariant = await DYOExpandedVariant.findOne(queryWithoutShape).sort({ updatedAt: -1 }).lean();
    }
    
    // Fallback 2: try metalType mapping from metal code
    if (!dyoExpandedVariant && metalCodeToCheck) {
      const METAL_CODE_TO_TYPE = {
        '14W': '14k_white_gold',
        '14Y': '14k_yellow_gold',
        '14R': '14k_rose_gold',
        '18W': '18k_white_gold',
        '18Y': '18k_yellow_gold',
        '18R': '18k_rose_gold',
        'P': 'platinum',
        'PT': 'platinum'
      };
      const mapped = METAL_CODE_TO_TYPE[metalCodeToCheck];
      if (mapped) {
        const altQuery = {
          $or: [{ product: product._id }, { productSku: sku }],
          active: true,
          metalType: { $regex: `^${mapped}$`, $options: 'i' }
        };
        // Try with reference shape first if provided
        if (referenceShapeCode) {
          altQuery.shape_code = { $regex: `^${referenceShapeCode}$`, $options: 'i' };
        }
        dyoExpandedVariant = await DYOExpandedVariant.findOne(altQuery).sort({ updatedAt: -1 }).lean();
        
        // If still no match and shape was provided, try without shape
        if (!dyoExpandedVariant && referenceShapeCode) {
          delete altQuery.shape_code;
          dyoExpandedVariant = await DYOExpandedVariant.findOne(altQuery).sort({ updatedAt: -1 }).lean();
        }
      }
    }
    
    // If no DYOExpandedVariant found but DYOVariant confirms metal is available, use product defaultPrice as fallback
    let metalPrice = 0;
    if (!dyoExpandedVariant) {
      // Try to get any DYOExpandedVariant for this product to see what's available
      const baseList = {
        $or: [{ product: product._id }, { productSku: sku }],
        active: true
      };
      const options = await DYOExpandedVariant.find(baseList).select('metalCode metalType metalPrice').lean();
      let availableMetalCodes = [...new Set(options.map(o => o.metalCode).filter(Boolean))];
      let availableMetalTypes = [...new Set(options.map(o => o.metalType).filter(Boolean))];
      
      // If DYOVariant exists and has the metal, but no DYOExpandedVariant pricing, use product defaultPrice
      if (dyoVariantDoc && metalCodeToCheck && (dyoVariantDoc.metalTypes || []).includes(metalCodeToCheck)) {
        metalPrice = Number(product.defaultPrice || 0);
        if (metalPrice === 0) {
          return res.status(404).json({ 
            success: false, 
            message: 'Metal is available but no pricing found. Please ensure DYOExpandedVariant data is imported for this product.',
            debug: {
              tried: { metal: metalCodeToCheck },
              availableMetalCodes: dyoVariantDoc.metalTypes || [],
              availableMetalTypes: [],
              note: 'Metal is available in DYOVariant but no pricing in DYOExpandedVariant'
            }
          });
        }
      } else {
        // Fallback to DYOVariant options if expanded list empty
        if (availableMetalCodes.length === 0 && availableMetalTypes.length === 0 && dyoVariantDoc) {
          availableMetalCodes = dyoVariantDoc.metalTypes || [];
        }
        return res.status(404).json({ 
          success: false, 
          message: 'Matching DYO option not found for given metal selection',
          debug: {
            tried: { metal: metalCodeToCheck || metalTypeToCheck },
            availableMetalCodes,
            availableMetalTypes
          }
        });
      }
    } else {
      metalPrice = Number(dyoExpandedVariant.metalPrice || 0);
    }

    // Pricing
    const quantityNum = Math.max(1, Number(quantity) || 1);
    const subtotalSingle = metalPrice + diamondPrice;
    const subtotal = subtotalSingle * quantityNum;

    // Product discount percent
    const productDiscountPercent = Number(product.discountPercent || 0);
    const productPercentDiscountAmount = productDiscountPercent > 0 ? +(subtotal * (productDiscountPercent / 100)).toFixed(2) : 0;

    // Extra absolute discount (optional)
    const extraDiscount = discount !== undefined && discount !== '' ? Math.max(0, Number(discount)) : 0;

    // Shipping and tax (backend-only)
    const TAX_RATE = Number(process.env.TAX_RATE) || 0.085; // 8.5%
    const FREE_SHIPPING_THRESHOLD = Number(process.env.FREE_SHIPPING_THRESHOLD) || 50000;
    const STANDARD_SHIPPING_COST = Number(process.env.STANDARD_SHIPPING_COST) || 500;

    let discountedSubtotal = Math.max(0, subtotal - productPercentDiscountAmount - extraDiscount);

    // Coupon application (optional)
    let couponDiscount = 0;
    let appliedCoupon = null;
    if (couponCode) {
      const normalizedCode = String(couponCode).trim().toUpperCase();
      const coupon = await Coupon.findOne({ code: normalizedCode });
      if (!coupon || coupon.status !== 'active') {
        return res.status(400).json({ success: false, message: 'Invalid or inactive coupon code' });
      }
      const now = new Date();
      if (coupon.startDate && coupon.startDate > now) {
        return res.status(400).json({ success: false, message: 'Coupon is not yet active' });
      }
      if (coupon.endDate && coupon.endDate < now) {
        return res.status(400).json({ success: false, message: 'Coupon has expired' });
      }
      if (coupon.minOrderAmount && discountedSubtotal < coupon.minOrderAmount) {
        return res.status(400).json({ success: false, message: `Minimum order amount for this coupon is ${coupon.minOrderAmount}` });
      }
      if (coupon.maxGlobalUses && coupon.usedCount >= coupon.maxGlobalUses) {
        return res.status(400).json({ success: false, message: 'Coupon usage limit reached' });
      }
      if (coupon.maxUsesPerUser) {
        const usedEntry = coupon.usedByUsers.find(u => String(u.userId) === String(userId));
        if (usedEntry && usedEntry.count >= coupon.maxUsesPerUser) {
          return res.status(400).json({ success: false, message: 'You have already used this coupon the maximum number of times' });
        }
      }

      if (coupon.discountType === 'fixed') {
        couponDiscount = Math.min(coupon.discountValue, discountedSubtotal);
      } else if (coupon.discountType === 'percent') {
        couponDiscount = discountedSubtotal * (coupon.discountValue / 100);
        if (coupon.maxDiscountAmount) {
          couponDiscount = Math.min(couponDiscount, coupon.maxDiscountAmount);
        }
      }
      couponDiscount = Math.max(0, Number(couponDiscount.toFixed(2)) || 0);
      discountedSubtotal = Math.max(0, discountedSubtotal - couponDiscount);
      appliedCoupon = coupon;
    }

    const shippingCost = discountedSubtotal >= FREE_SHIPPING_THRESHOLD ? 0 : STANDARD_SHIPPING_COST;
    const taxes = +(discountedSubtotal * TAX_RATE).toFixed(2);
    const total = Math.max(0, +(discountedSubtotal + shippingCost + taxes).toFixed(2));

    // Build order item
    const selectedMetalValue = dyoExpandedVariant 
      ? (dyoExpandedVariant.metalCode || dyoExpandedVariant.metalType)
      : (metalCodeToCheck || metalTypeToCheck);
    const metalWeightValue = dyoExpandedVariant 
      ? Number(dyoExpandedVariant.metalWeight || 0)
      : Number(product.defaultMetalWeight || 0);
    
    const orderItem = {
      itemType: 'dyo',
      product: product._id,
      productSku: sku,
      productName: product.productName || product.title,
      selectedMetal: selectedMetalValue,
      selectedShape: diamondShapeCode, // Shape comes from diamond, not variant
      selectedCarat: diamondDoc ? diamondDoc.carat : undefined,
      selectedDiamond: diamondDoc ? diamondDoc._id : undefined,
      diamondSku: diamondDoc ? diamondDoc.sku : undefined,
      quantity: quantityNum,
      pricePerItem: subtotalSingle,
      totalPrice: subtotal,
      priceBreakdown: {
        metal_cost: metalPrice,
        diamond_price: diamondPrice,
        metal_weight: metalWeightValue
      },
      itemSnapshot: {
        title: product.productName || product.title,
        description: product.description || '',
        images: [],
        specifications: {
          metal: selectedMetalValue,
          shape: diamondShapeCode, // Shape from diamond
          carat: diamondDoc ? diamondDoc.carat : undefined
        }
      }
    };

    // Create order
    const order = new Order({
      userId,
      items: [orderItem],
      subtotal,
      shippingCost,
      taxes,
      discount: productPercentDiscountAmount + extraDiscount + couponDiscount,
      couponId: appliedCoupon ? appliedCoupon._id : undefined,
      couponCode: appliedCoupon ? appliedCoupon.code : undefined,
      couponDiscount,
      total,
      contactEmail,
      contactPhone,
      shippingAddress: finalShippingAddress,
      billingAddress: finalBillingAddress,
      paymentMethod,
      status: 'Pending',
      paymentStatus: 'Pending'
    });

    await order.save();

    // Track coupon usage for DYO checkout
    if (appliedCoupon && couponDiscount > 0) {
      const couponToUpdate = await Coupon.findById(appliedCoupon._id);
      if (couponToUpdate) {
        couponToUpdate.usedCount = (couponToUpdate.usedCount || 0) + 1;
        const usedEntry = couponToUpdate.usedByUsers.find(u => String(u.userId) === String(userId));
        if (usedEntry) {
          usedEntry.count = (usedEntry.count || 0) + 1;
        } else {
          couponToUpdate.usedByUsers.push({ userId, count: 1 });
        }
        await couponToUpdate.save();
      }
    }

    // Fetch populated order for response
    const populatedOrder = await Order.findById(order._id)
      .populate('items.product', 'productSku productName title description')
      .populate('items.selectedDiamond', 'sku shape carat cut color purity price pricePerCarat')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      pricing: {
        subtotal,
        shippingCost,
        tax: taxes,
        finalPrice: total
      },
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
      .populate('items.variant', 'variantSku productSku metalType shape_code centerStoneWeight clarity color cut metalPrice')
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
    await order.populate('items.variant', 'variantSku productSku metalType shape_code centerStoneWeight metalPrice');
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
        await ExpandedVariant.findByIdAndUpdate(
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
