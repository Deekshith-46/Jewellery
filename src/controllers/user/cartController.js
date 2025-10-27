const Cart = require('../../models/user/Cart');
const Variant = require('../../models/admin/Variant');
const Order = require('../../models/user/Order');

// Helper function to compute item price
const computeItemPrice = async (item) => {
  if (item.variantId) {
    const variant = await Variant.findOne({ variantId: item.variantId });
    if (!variant) throw new Error('Variant not found');
    return (variant.price || 0) * (item.quantity || 1);
  } else if (item.customBuild) {
    return (item.customBuild.price || 0) * (item.quantity || 1);
  }
  return 0;
};

// Get user's cart
exports.getCart = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }
    
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// Add item to cart
exports.addToCart = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { variantId, quantity = 1, customBuild } = req.body;

    if (!variantId && !customBuild) {
      return res.status(400).json({ message: 'variantId or customBuild is required' });
    }

    let cart = await Cart.findOne({ userId });
    if (!cart) {
      cart = await Cart.create({ userId, items: [] });
    }

    // If variant: check if same variant exists then increment quantity
    if (variantId) {
      const existing = cart.items.find(i => i.variantId === variantId && !i.customBuild);
      if (existing) {
        existing.quantity += Number(quantity);
      } else {
        cart.items.push({ variantId, quantity: Number(quantity) });
      }
    } else {
      // Custom build: treat as unique entry
      cart.items.push({ customBuild: customBuild, quantity: Number(quantity) });
    }

    cart.updatedAt = Date.now();
    await cart.save();
    
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// Update cart item quantity
exports.updateItem = async (req, res, next) => {
  try {
    const { userId, index } = req.params;
    const { quantity } = req.body;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const idx = Number(index);
    if (isNaN(idx) || !cart.items[idx]) {
      return res.status(400).json({ message: 'Item not found' });
    }
    
    if (quantity <= 0) {
      cart.items.splice(idx, 1);
    } else {
      cart.items[idx].quantity = Number(quantity);
    }
    
    cart.updatedAt = Date.now();
    await cart.save();
    
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// Remove item from cart
exports.removeItem = async (req, res, next) => {
  try {
    const { userId, index } = req.params;
    
    const cart = await Cart.findOne({ userId });
    if (!cart) {
      return res.status(404).json({ message: 'Cart not found' });
    }
    
    const idx = Number(index);
    if (isNaN(idx) || !cart.items[idx]) {
      return res.status(400).json({ message: 'Item not found' });
    }
    
    cart.items.splice(idx, 1);
    cart.updatedAt = Date.now();
    await cart.save();
    
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// Clear entire cart
exports.clearCart = async (req, res, next) => {
  try {
    const { userId } = req.params;
    
    const cart = await Cart.findOneAndUpdate(
      { userId }, 
      { items: [], updatedAt: Date.now() }, 
      { new: true, upsert: true }
    );
    
    res.json(cart);
  } catch (err) {
    next(err);
  }
};

// Checkout cart
exports.checkout = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { shipping = 0, taxes = 0, shippingAddress, paymentMethod } = req.body;

    const cart = await Cart.findOne({ userId });
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ message: 'Cart is empty' });
    }

    // Compute subtotal
    let subtotal = 0;
    const orderItems = [];
    
    for (const item of cart.items) {
      const linePrice = await computeItemPrice(item);
      subtotal += linePrice;
      orderItems.push({
        variantId: item.variantId || null,
        customBuild: item.customBuild || null,
        quantity: item.quantity,
        price: linePrice
      });
    }

    const total = subtotal + Number(shipping) + Number(taxes);
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Create order
    const order = await Order.create({
      orderId,
      userId,
      items: orderItems,
      subtotal,
      shipping: Number(shipping),
      taxes: Number(taxes),
      total,
      status: 'Pending',
      shippingAddress,
      paymentMethod,
      paymentStatus: 'Pending'
    });

    // Decrease variant stock for variant items
    for (const item of cart.items) {
      if (item.variantId) {
        await Variant.updateOne(
          { variantId: item.variantId }, 
          { $inc: { stock: -Math.max(1, item.quantity) } }
        );
      }
    }

    // Clear cart
    cart.items = [];
    await cart.save();

    res.json({ order });
  } catch (err) {
    next(err);
  }
};
