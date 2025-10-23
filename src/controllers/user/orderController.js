const Order = require('../../models/user/Order');
const OrderItem = require('../../models/user/OrderItem');
const Product = require('../../models/admin/Product');
const DiamondSpec = require('../../models/admin/DiamondSpec');

exports.placeOrder = async (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: 'Auth required' });
    const userId = req.user._id;
    const {
      items = [],
      shippingAddressId,
      shippingCost: shippingCostInput,
      taxPercent: taxPercentInput
    } = req.body;
    if (!items || !items.length) return res.status(400).json({ message: 'Cart empty' });

    let subtotal = 0;
    const prepared = [];

    for (const it of items) {
      let basePrice = 0;
      if (it.productId) {
        const product = await Product.findById(it.productId);
        if (!product) return res.status(400).json({ message: 'Invalid product: ' + it.productId });
        // Include both product basePrice and metalPrice in the item base
        basePrice += (product.basePrice || 0) + (product.metalPrice || 0);
      }
      if (it.diamondSpecId) {
        const diamond = await DiamondSpec.findById(it.diamondSpecId);
        if (!diamond) return res.status(400).json({ message: 'Invalid diamond: ' + it.diamondSpecId });
        if (!diamond.active) return res.status(400).json({ message: `Diamond ${diamond.sku} is not active` });
        basePrice += diamond.price;
        if (diamond.stock < (it.quantity || 1)) return res.status(400).json({ message: `Insufficient stock for ${diamond.sku}` });
      }
      const qty = it.quantity || 1;
      subtotal += basePrice * qty;
      prepared.push({
        productId: it.productId,
        diamondSpecId: it.diamondSpecId,
        quantity: qty,
        metalId: it.metalId,
        engravingText: it.engravingText,
        itemPrice: basePrice
      });
    }

    let discount = 0;

    // Determine tax percent: request > env TAX_PERCENT > 0
    const envTax = Number(process.env.TAX_PERCENT || 0);
    const taxPercent = typeof taxPercentInput === 'number' ? taxPercentInput : envTax;
    const tax = (Number(taxPercent) / 100) * subtotal;

    // Determine shipping cost: request > free threshold > env flat > 0
    const freeMin = Number(process.env.FREE_SHIPPING_MIN || 0); // if subtotal-discount >= freeMin => 0 shipping
    const flatShip = Number(process.env.SHIPPING_FLAT || 0);
    const preShip = subtotal - discount;
    let shippingCost = typeof shippingCostInput === 'number' ? Number(shippingCostInput) : (preShip >= freeMin ? 0 : flatShip);
    if (Number.isNaN(shippingCost)) shippingCost = 0;

    const finalTotal = preShip + tax + shippingCost;

    const order = new Order({ userId, shippingAddressId, subtotal, tax, shippingCost, discount, finalTotal, paymentStatus: 'pending' });
    await order.save();

    const createdItems = [];
    for (const p of prepared) {
      const oi = new OrderItem({ orderId: order._id, userId, ...p });
      await oi.save();
      createdItems.push(oi);
      if (p.diamondSpecId) await DiamondSpec.findByIdAndUpdate(p.diamondSpecId, { $inc: { stock: -p.quantity } });
    }

    order.items = createdItems.map(x => x._id);
    await order.save();

    const populated = await Order.findById(order._id).populate({
      path: 'items',
      populate: [{ path: 'productId' }, { path: 'diamondSpecId' }]
    });

    res.status(201).json({ order: populated });
  } catch (err) { next(err); }
};

exports.getUserOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate({
      path: 'items',
      populate: [{ path: 'productId' }, { path: 'diamondSpecId' }]
    });
    res.json(orders);
  } catch (err) { next(err); }
};

