var express = require('express');
var router = express.Router();
let paymentModel = require('../schemas/payments');
let orderModel = require('../schemas/orders');
let shipmentModel = require('../schemas/shipments');
let { CheckLogin, CheckRole } = require('../utils/authHandler');
const { broadcast } = require('../utils/realtime');


async function ensureOrderNumbers(session = null) {
  let query = orderModel.find({ isDeleted: false }).sort({ createdAt: 1, _id: 1 });
  if (session) query = query.session(session);
  const orders = await query;
  let changed = false;
  for (let index = 0; index < orders.length; index += 1) {
    const order = orders[index];
    const expected = index + 1;
    if (Number(order.orderNumber || 0) !== expected) {
      order.orderNumber = expected;
      await order.save(session ? { session } : undefined);
      changed = true;
    }
  }
  return changed;
}

router.get('/my-orders', CheckLogin, async function (req, res) {
  try {
    await ensureOrderNumbers();
    const orders = await orderModel.find({ user: req.user.id, isDeleted: false })
      .sort({ createdAt: 1, _id: 1 })
      .lean();
    const mapped = orders.map((order, index) => ({
      ...order,
      displayOrderNumber: index + 1
    }));
    res.send(mapped);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.get('/admin-orders', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    await ensureOrderNumbers();
    const orders = await orderModel.find({ isDeleted: false })
      .populate('user', 'username fullName email')
      .sort({ orderNumber: 1, createdAt: 1 });
    res.send(orders);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.put('/admin-orders/:id/status', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const paymentStatus = String(req.body.status || '').trim();
    const deliveryStatus = String(req.body.deliveryStatus || '').trim();
    const updates = {};

    if (paymentStatus) {
      if (!['pending', 'paid'].includes(paymentStatus)) {
        return res.status(400).send({ message: 'trang thai thanh toan khong hop le' });
      }
      updates.paymentStatus = paymentStatus;
    }

    if (deliveryStatus) {
      if (!['pending', 'shipping', 'delivered'].includes(deliveryStatus)) {
        return res.status(400).send({ message: 'trang thai giao hang khong hop le' });
      }
      updates.deliveryStatus = deliveryStatus;
    }

    const order = await orderModel.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!order) return res.status(404).send({ message: 'khong tim thay don hang' });

    const paymentUpdates = {};
    if (updates.paymentStatus) paymentUpdates.status = updates.paymentStatus;
    if (updates.deliveryStatus) paymentUpdates.deliveryStatus = updates.deliveryStatus;
    if (order.payment && Object.keys(paymentUpdates).length) {
      await paymentModel.findByIdAndUpdate(order.payment, paymentUpdates, { new: true });
    }
    if (order.shipment && updates.deliveryStatus) {
      await shipmentModel.findByIdAndUpdate(order.shipment, { status: updates.deliveryStatus }, { new: true });
    }

    broadcast('order.updated', { orderId: String(order._id), userId: String(order.user) });
    broadcast('dashboard.updated', {});
    res.send(order);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});


router.delete('/admin-orders/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const order = await orderModel.findById(req.params.id);
    if (!order || order.isDeleted) {
      return res.status(404).send({ message: 'khong tim thay don hang' });
    }

    if (order.paymentStatus !== 'paid' || order.deliveryStatus !== 'delivered') {
      return res.status(400).send({ message: 'chi duoc xoa don hang da thanh toan va da giao' });
    }

    const orderId = String(order._id);
    const userId = String(order.user || '');
    const paymentId = order.payment ? String(order.payment) : '';
    const shipmentId = order.shipment ? String(order.shipment) : '';

    await orderModel.deleteOne({ _id: order._id });
    if (paymentId) {
      await paymentModel.deleteOne({ _id: paymentId });
    }
    if (shipmentId) {
      await shipmentModel.deleteOne({ _id: shipmentId });
    }

    await ensureOrderNumbers();

    broadcast('order.updated', { orderId, userId, deleted: true });
    broadcast('dashboard.updated', {});
    res.send({ message: 'da xoa don hang' });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
