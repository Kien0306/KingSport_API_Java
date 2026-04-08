var express = require('express');
var router = express.Router();
let { CheckLogin, CheckRole } = require('../utils/authHandler');
let inventoryModel = require('../schemas/inventories');
let orderModel = require('../schemas/orders');

router.get('/top-selling', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const inventories = await inventoryModel.find({ soldCount: { $gt: 0 } })
      .populate({ path: 'product', populate: { path: 'category', select: 'name' } })
      .sort({ soldCount: -1, stock: -1 })
      .limit(8);

    const data = inventories
      .filter((item) => item.product && !item.product.isDeleted)
      .map((item) => ({
        productId: item.product._id,
        title: item.product.title,
        soldCount: Number(item.soldCount || 0),
        stock: Number(item.stock || 0),
        category: item.product.category?.name || 'Khác'
      }));

    res.send(data);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get('/revenue-summary', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const orders = await orderModel.find({ isDeleted: false });
    const totalRevenue = orders.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidOrders = orders.filter((item) => item.paymentStatus === 'paid').length;
    const pendingOrders = orders.filter((item) => item.paymentStatus === 'pending').length;
    const deliveredOrders = orders.filter((item) => item.deliveryStatus === 'delivered').length;
    res.send({
      totalRevenue,
      orderCount: orders.length,
      paidOrders,
      pendingOrders,
      deliveredOrders
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});


router.get('/revenue-metrics', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const orders = await orderModel.find({ isDeleted: false }).sort({ createdAt: 1 });
    const totalRevenue = orders.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paidRevenue = orders.filter((item) => item.paymentStatus === 'paid').reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const paymentGroups = {
      paid: orders.filter((item) => item.paymentStatus === 'paid').length,
      pending: orders.filter((item) => item.paymentStatus === 'pending').length
    };
    const deliveryGroups = {
      pending: orders.filter((item) => item.deliveryStatus === 'pending').length,
      shipping: orders.filter((item) => item.deliveryStatus === 'shipping').length,
      delivered: orders.filter((item) => item.deliveryStatus === 'delivered').length
    };

    const byDate = new Map();
    const byMonth = new Map();
    orders.forEach((item) => {
      const dateObj = new Date(item.createdAt);
      const dateKey = dateObj.toISOString().slice(0, 10);
      const dateBucket = byDate.get(dateKey) || { revenue: 0, orders: 0 };
      dateBucket.revenue += Number(item.amount || 0);
      dateBucket.orders += 1;
      byDate.set(dateKey, dateBucket);

      const monthKey = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
      const monthBucket = byMonth.get(monthKey) || { revenue: 0, orders: 0 };
      monthBucket.revenue += Number(item.amount || 0);
      monthBucket.orders += 1;
      byMonth.set(monthKey, monthBucket);
    });

    const trend = Array.from(byDate.entries()).slice(-7).map(([date, bucket]) => ({
      date,
      revenue: bucket.revenue,
      orders: bucket.orders
    }));

    const monthlyTrend = Array.from(byMonth.entries()).slice(-6).map(([month, bucket]) => ({
      month,
      revenue: bucket.revenue,
      orders: bucket.orders
    }));
    const monthlyRevenueTotal = monthlyTrend.reduce((sum, item) => sum + Number(item.revenue || 0), 0);

    const averageOrderValue = orders.length ? Math.round(totalRevenue / orders.length) : 0;
    const deliveryRate = orders.length ? Math.round((deliveryGroups.delivered / orders.length) * 100) : 0;
    res.send({
      totalRevenue,
      paidRevenue,
      orderCount: orders.length,
      averageOrderValue,
      deliveryRate,
      paymentGroups,
      deliveryGroups,
      trend,
      monthlyTrend,
      monthlyRevenueTotal
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
