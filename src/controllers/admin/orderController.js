const Order = require('../../models/user/Order');
const ExpandedVariant = require('../../models/admin/ExpandedVariant');

/**
 * Get all orders (Admin)
 * GET /api/admin/orders
 */
exports.adminGetAllOrders = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 50, 
      status, 
      paymentStatus,
      search 
    } = req.query;
    
    const filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    
    // Search by orderId or email
    if (search) {
      filter.$or = [
        { orderId: new RegExp(search, 'i') },
        { contactEmail: new RegExp(search, 'i') }
      ];
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .populate('userId', 'name email')
      .populate('items.variant', 'variantSku productSku metalType shape_code centerStoneWeight metalPrice')
      .populate('items.product', 'productSku productName title')
      .lean();
    
    const total = await Order.countDocuments(filter);
    
    res.json({ 
      success: true,
      orders,
      total, 
      page: Number(page), 
      pages: Math.ceil(total / Number(limit)) 
    });
    
  } catch (err) { 
    next(err); 
  }
};

/**
 * Get single order by ID (Admin)
 * GET /api/admin/orders/:id
 */
exports.adminGetOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const order = await Order.findById(id)
      .populate('userId', 'name email phone')
      .populate('items.variant', 'variantSku productSku metalType shape_code centerStoneWeight metalPrice stock')
      .populate('items.product', 'productSku productName title description')
      .populate('items.selectedDiamond', 'sku shape carat cut color clarity price')
      .lean();
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    res.json({
      success: true,
      order
    });
    
  } catch (err) { 
    next(err); 
  }
};

/**
 * Update order status and payment status (Admin)
 * PUT /api/admin/orders/:id
 */
exports.updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { 
      status, 
      paymentStatus, 
      trackingNumber,
      shippingMethod,
      adminNotes
    } = req.body;
    
    const order = await Order.findById(id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false,
        message: 'Order not found' 
      });
    }
    
    // Update fields
    if (status) order.status = status;
    if (paymentStatus) order.paymentStatus = paymentStatus;
    if (trackingNumber) order.trackingNumber = trackingNumber;
    if (shippingMethod) order.shippingMethod = shippingMethod;
    if (adminNotes) order.adminNotes = adminNotes;
    
    // If status changed to Delivered, set actualDelivery date
    if (status === 'Delivered' && !order.actualDelivery) {
      order.actualDelivery = new Date();
    }
    
    // If order is cancelled, restore stock
    if (status === 'Cancelled' && order.status !== 'Cancelled') {
      for (const item of order.items) {
        if (item.itemType === 'rts' && item.variant) {
          await ExpandedVariant.findByIdAndUpdate(
            item.variant,
            { $inc: { stock: item.quantity } }
          );
        }
      }
    }
    
    await order.save();
    
    res.json({
      success: true,
      message: 'Order updated successfully',
      order
    });
    
  } catch (err) { 
    next(err); 
  }
};

/**
 * Get order statistics (Admin)
 * GET /api/admin/orders/stats
 */
exports.getOrderStats = async (req, res, next) => {
  try {
    const totalOrders = await Order.countDocuments();
    const pendingOrders = await Order.countDocuments({ status: 'Pending' });
    const confirmedOrders = await Order.countDocuments({ status: 'Confirmed' });
    const shippedOrders = await Order.countDocuments({ status: 'Shipped' });
    const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
    const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });
    
    const pendingPayments = await Order.countDocuments({ paymentStatus: 'Pending' });
    const paidOrders = await Order.countDocuments({ paymentStatus: 'Paid' });
    
    // Calculate total revenue (only paid orders)
    const revenueResult = await Order.aggregate([
      { $match: { paymentStatus: 'Paid' } },
      { $group: { _id: null, totalRevenue: { $sum: '$total' } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
    
    res.json({
      success: true,
      stats: {
        totalOrders,
        ordersByStatus: {
          pending: pendingOrders,
          confirmed: confirmedOrders,
          shipped: shippedOrders,
          delivered: deliveredOrders,
          cancelled: cancelledOrders
        },
        ordersByPayment: {
          pending: pendingPayments,
          paid: paidOrders
        },
        revenue: {
          total: totalRevenue,
          currency: 'USD'
        }
      }
    });
    
  } catch (err) { 
    next(err); 
  }
};
