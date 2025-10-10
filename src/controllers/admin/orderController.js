const Order = require('../../models/user/Order');

exports.adminGetAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, status, paymentStatus } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    const items = await Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(Number(limit)).populate('items');
    const total = await Order.countDocuments(filter);
    res.json({ items, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { next(err); }
};

exports.updatePaymentStatusByAdmin = async (req, res, next) => {
  try {
    const { paymentStatus, status } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (status) order.status = status;
    await order.save();
    res.json(order);
  } catch (err) { next(err); }
};

