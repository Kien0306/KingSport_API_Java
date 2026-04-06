var express = require('express');
var router = express.Router();
const { CheckLogin } = require('../utils/authHandler');
let cartModel = require('../schemas/carts');
let inventoryModel = require('../schemas/inventories');
let paymentModel = require('../schemas/payments');
let orderModel = require('../schemas/orders');
let shipmentModel = require('../schemas/shipments');
let addressModel = require('../schemas/addresses');
let couponModel = require('../schemas/coupons');
let userModel = require('../schemas/users');
let pointTransactionModel = require('../schemas/pointtransactions');
const { runDbTransaction } = require('../utils/transactionHelper');
const { broadcast } = require('../utils/realtime');
const { sendOrderSuccessMail } = require('../utils/mailHandler');

function resolveProductPriceBySize(product = {}, selectedSize = '') {
  const fallbackPrice = Number(product?.price || 0);
  if (!selectedSize) return fallbackPrice;
  const found = Array.isArray(product?.sizePrices)
    ? product.sizePrices.find((item) => String(item?.size || '').trim() === String(selectedSize || '').trim())
    : null;
  return Number(found?.price ?? fallbackPrice);
}

async function getCartWithProducts(userId) {
  const cart = await cartModel.findOne({ user: userId }).populate({
    path: 'products.product',
    populate: { path: 'category', select: 'name slug' }
  });
  return attachInventoryToCartProducts(cart);
}

async function attachInventoryToCartProducts(cart) {
  if (!cart || !Array.isArray(cart.products) || !cart.products.length) return cart;
  const productIds = cart.products.map((item) => item.product?._id || item.product).filter(Boolean);
  const inventories = await inventoryModel.find({ product: { $in: productIds } });
  const inventoryMap = new Map(inventories.map((item) => [String(item.product), item]));
  cart.products = cart.products.map((item) => {
    const product = item.product?.toObject ? item.product.toObject() : item.product;
    const inventory = inventoryMap.get(String(product?._id || item.product || ''));
    if (product) {
      product.sizeStocks = inventory && Array.isArray(inventory.sizeStocks) ? inventory.sizeStocks : [];
      product.stock = product.sizeStocks.length
        ? product.sizeStocks.reduce((sum, current) => sum + Number(current.stock || 0), 0)
        : Number(inventory?.stock || 0);
      product.price = resolveProductPriceBySize(product, item.selectedSize || '');
    }
    return { ...item.toObject(), product };
  });
  return cart;
}


router.get('/', CheckLogin, async function (req, res) {
  let cart = await getCartWithProducts(req.user.id);
  res.send(cart ? cart.products : []);
});

router.post('/add', CheckLogin, async function (req, res) {
  let cart = await cartModel.findOne({ user: req.user.id });
  let products = cart.products;
  let productId = req.body.product;
  let selectedSize = String(req.body.selectedSize || '').trim();
  let colorName = String(req.body.colorName || '').trim();
  let colorHex = String(req.body.colorHex || '').trim();
  let getProduct = await inventoryModel.findOne({ product: productId });
  if (!getProduct) {
    return res.status(404).send({ message: 'san pham khong ton tai' });
  }
  const availableStock = (() => {
    if (!selectedSize) return Number(getProduct.stock || 0);
    const sizeInfo = Array.isArray(getProduct.sizeStocks) ? getProduct.sizeStocks.find((item) => String(item.size || '') === selectedSize) : null;
    return Number(sizeInfo?.stock || 0);
  })();
  let index = products.findIndex(function (f) {
    return String(f.product) === String(productId) && String(f.selectedSize || '') === selectedSize && String(f.colorName || '') === colorName;
  });
  if (index < 0) {
    if (availableStock < 1) {
      return res.status(404).send({ message: 'ton kho khong du' });
    }
    products.push({ product: productId, quantity: 1, selectedSize, colorName, colorHex });
  } else {
    if (availableStock < products[index].quantity + 1) {
      return res.status(404).send({ message: 'ton kho khong du' });
    }
    products[index].quantity += 1;
  }

  await cart.save();
  let fullCart = await getCartWithProducts(req.user.id);
  broadcast('cart.updated', { userId: String(req.user.id) });
  res.send(fullCart.products);
});

router.post('/remove', CheckLogin, async function (req, res) {
  let cart = await cartModel.findOne({ user: req.user.id });
  let products = cart.products;
  let productId = req.body.product;
  let selectedSize = String(req.body.selectedSize || '');
  let index = products.findIndex(function (f) {
    return String(f.product) === String(productId) && String(f.selectedSize || '') === selectedSize;
  });
  if (index < 0) {
    return res.status(404).send({ message: 'san pham khong ton tai trong gio hang' });
  }
  products.splice(index, 1);
  await cart.save();
  let fullCart = await getCartWithProducts(req.user.id);
  broadcast('cart.updated', { userId: String(req.user.id) });
  res.send(fullCart.products);
});

router.post('/decrease', CheckLogin, async function (req, res) {
  let cart = await cartModel.findOne({ user: req.user.id });
  let products = cart.products;
  let productId = req.body.product;
  let index = products.findIndex(function (f) {
    return String(f.product) === String(productId) && String(f.selectedSize || '') === String(req.body.selectedSize || '');
  });
  if (index < 0) {
    return res.status(404).send({ message: 'san pham khong ton tai trong gio hang' });
  }
  if (products[index].quantity === 1) {
    products.splice(index, 1);
  } else {
    products[index].quantity -= 1;
  }
  await cart.save();
  let fullCart = await getCartWithProducts(req.user.id);
  broadcast('cart.updated', { userId: String(req.user.id) });
  res.send(fullCart.products);
});

router.post('/modify', CheckLogin, async function (req, res) {
  let cart = await cartModel.findOne({ user: req.user.id });
  let products = cart.products;
  let productId = req.body.product;
  let quantity = Number(req.body.quantity || 0);
  let getProduct = await inventoryModel.findOne({ product: productId });
  if (!getProduct) {
    return res.status(404).send({ message: 'san pham khong ton tai' });
  }
  const selectedSize = String(req.body.selectedSize || '').trim();
  const availableStock = (() => {
    if (!selectedSize) return Number(getProduct.stock || 0);
    const sizeInfo = Array.isArray(getProduct.sizeStocks) ? getProduct.sizeStocks.find((item) => String(item.size || '') === selectedSize) : null;
    return Number(sizeInfo?.stock || 0);
  })();
  if (quantity > availableStock) {
    return res.status(400).send({ message: 'ton kho khong du' });
  }
  let index = products.findIndex(function (f) {
    return String(f.product) === String(productId) && String(f.selectedSize || '') === String(req.body.selectedSize || '');
  });
  if (index < 0) {
    return res.status(404).send({ message: 'san pham khong ton tai trong gio hang' });
  }
  if (quantity <= 0) {
    products.splice(index, 1);
  } else {
    products[index].quantity = quantity;
  }
  await cart.save();
  let fullCart = await getCartWithProducts(req.user.id);
  broadcast('cart.updated', { userId: String(req.user.id) });
  res.send(fullCart.products);
});


router.post('/update-size', CheckLogin, async function (req, res) {
  let cart = await cartModel.findOne({ user: req.user.id });
  let products = cart.products;
  let productId = req.body.product;
  let selectedSize = String(req.body.selectedSize || '').trim();
  let nextSelectedSize = String(req.body.nextSelectedSize || '').trim();
  let currentIndex = products.findIndex(function (f) {
    return String(f.product) === String(productId) && String(f.selectedSize || '') === selectedSize;
  });
  if (currentIndex < 0) {
    return res.status(404).send({ message: 'san pham khong ton tai trong gio hang' });
  }
  let inventory = await inventoryModel.findOne({ product: productId });
  if (!inventory) {
    return res.status(404).send({ message: 'san pham khong ton tai' });
  }
  const sizeInfo = Array.isArray(inventory.sizeStocks) ? inventory.sizeStocks.find((item) => String(item.size || '') === nextSelectedSize) : null;
  const availableStock = nextSelectedSize ? Number(sizeInfo?.stock || 0) : Number(inventory.stock || 0);
  const mergeIndex = products.findIndex(function (f, index) {
    return index !== currentIndex && String(f.product) === String(productId) && String(f.selectedSize || '') === nextSelectedSize;
  });
  const requiredQty = Number(products[currentIndex].quantity || 0) + (mergeIndex >= 0 ? Number(products[mergeIndex].quantity || 0) : 0);
  if (availableStock < requiredQty) {
    return res.status(400).send({ message: 'ton kho khong du cho size da chon' });
  }
  if (mergeIndex >= 0) {
    products[mergeIndex].quantity = requiredQty;
    products.splice(currentIndex, 1);
  } else {
    products[currentIndex].selectedSize = nextSelectedSize;
  }
  await cart.save();
  let fullCart = await getCartWithProducts(req.user.id);
  broadcast('cart.updated', { userId: String(req.user.id) });
  res.send(fullCart.products);
});

router.post('/checkout', CheckLogin, async function (req, res) {
  try {
    const fullName = String(req.body.fullName || '').trim();
    const phone = String(req.body.phone || '').trim();
    const address = String(req.body.address || '').trim();
    const paymentMethod = String(req.body.paymentMethod || 'cod').trim() === 'bank' ? 'bank' : 'cod';

    if (!fullName || !phone || !address) {
      return res.status(400).send({ message: 'vui long nhap day du thong tin nhan hang' });
    }

    const couponCode = String(req.body.couponCode || '').trim().toUpperCase();

    const result = await runDbTransaction(async (session) => {
      let cartQuery = cartModel.findOne({ user: req.user.id }).populate({
        path: 'products.product',
        populate: { path: 'category', select: 'name slug' }
      });
      if (session) cartQuery = cartQuery.session(session);
      let cart = await cartQuery;
      if (!cart || !cart.products.length) {
        throw new Error('gio hang dang trong');
      }

      let totalAmount = 0;
      let discountAmount = 0;
      let appliedCoupon = null;
      const orderItems = [];

      for (const item of cart.products) {
        const product = item.product || {};
        const productId = product._id || item.product;
        let inventoryQuery = inventoryModel.findOne({ product: productId });
        if (session) inventoryQuery = inventoryQuery.session(session);
        const inventory = await inventoryQuery;
        if (!inventory) { throw new Error('ton kho khong du'); }
        const sizeInfo = item.selectedSize && Array.isArray(inventory.sizeStocks) ? inventory.sizeStocks.find((s) => String(s.size || '') === String(item.selectedSize || '')) : null;
        const availableStock = item.selectedSize ? Number(sizeInfo?.stock || 0) : Number(inventory.stock || 0);
        if (availableStock < item.quantity) { throw new Error('ton kho khong du'); }
        const quantity = Number(item.quantity || 0);
        const price = resolveProductPriceBySize(product, item.selectedSize || '');
        const subtotal = price * quantity;
        totalAmount += subtotal;
        orderItems.push({
          product: productId,
          title: product.title || 'San pham',
          quantity,
          price,
          subtotal,
          size: item.selectedSize || '',
          colorName: item.colorName || '',
          colorHex: item.colorHex || ''
        });
      }

      if (couponCode) {
        let couponQuery = couponModel.findOne({ code: couponCode, isActive: true, isDeleted: false });
        if (session) couponQuery = couponQuery.session(session);
        appliedCoupon = await couponQuery;
        if (!appliedCoupon) throw new Error('ma giam gia khong hop le');
        if (appliedCoupon.isPointCoupon && !appliedCoupon.ownerUser) {
          throw new Error('ma nay chi dung de doi diem, khong ap dung truc tiep khi thanh toan');
        }
        if (appliedCoupon.ownerUser && String(appliedCoupon.ownerUser) !== String(req.user.id)) {
          throw new Error('ma giam gia nay khong thuoc tai khoan cua ban');
        }
        if (appliedCoupon.expiresAt && new Date(appliedCoupon.expiresAt).getTime() < Date.now()) {
          throw new Error('ma giam gia da het han');
        }
        if (appliedCoupon.isPointCoupon && appliedCoupon.isUsedOnce) {
          throw new Error('ma doi diem nay da duoc su dung');
        }
        if (totalAmount < Number(appliedCoupon.minOrderAmount || 0)) {
          throw new Error('don hang chua du dieu kien ap dung ma giam gia');
        }
        discountAmount = appliedCoupon.type === 'fixed'
          ? Number(appliedCoupon.value || 0)
          : Math.round(totalAmount * Number(appliedCoupon.value || 0) / 100);
        if (appliedCoupon.maxDiscount && Number(appliedCoupon.maxDiscount) > 0) {
          discountAmount = Math.min(discountAmount, Number(appliedCoupon.maxDiscount));
        }
        discountAmount = Math.max(0, Math.min(discountAmount, totalAmount));
      }

      const finalAmount = Math.max(0, totalAmount - discountAmount);
      const earnedPoints = Math.floor(finalAmount / 1000);
      const paymentStatus = paymentMethod === 'bank' ? 'pending' : 'paid';
      const orderNumber = (await orderModel.countDocuments({})) + 1;
      const latestUser = await userModel.findById(req.user.id).session(session || null);
      const checkoutEmail = String(latestUser?.email || req.user?.email || '').trim().toLowerCase();

      const orderPayload = {
        user: req.user.id,
        orderNumber,
        products: orderItems,
        fullName,
        email: checkoutEmail,
        phone,
        address,
        paymentMethod,
        paymentStatus,
        deliveryStatus: 'pending',
        originalAmount: totalAmount,
        discountAmount,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
        amount: finalAmount,
        note: paymentMethod === 'bank' ? 'Cho xac nhan chuyen khoan' : 'Thanh toan khi nhan hang'
      };

      const orderDocs = await orderModel.create([orderPayload], session ? { session } : undefined);
      const order = orderDocs[0];

      const paymentPayload = {
        user: req.user.id,
        order: order._id,
        products: orderItems,
        fullName,
        email: checkoutEmail,
        phone,
        address,
        paymentMethod,
        status: paymentStatus,
        deliveryStatus: 'pending',
        originalAmount: totalAmount,
        discountAmount,
        couponCode: appliedCoupon ? appliedCoupon.code : '',
        amount: finalAmount,
        note: orderPayload.note
      };
      const paymentDocs = await paymentModel.create([paymentPayload], session ? { session } : undefined);
      const payment = paymentDocs[0];

      const shipmentDocs = await shipmentModel.create([{
        order: order._id,
        user: req.user.id,
        fullName,
        phone,
        address,
        status: 'pending',
        carrier: 'Nội bộ',
        trackingCode: '',
        note: ''
      }], session ? { session } : undefined);
      const shipment = shipmentDocs[0];

      const addressPayload = {
        user: req.user.id,
        fullName,
        phone,
        address,
        label: 'Mặc định',
        isDefault: true,
        isDeleted: false
      };
      await addressModel.findOneAndUpdate(
        { user: req.user.id, isDefault: true },
        addressPayload,
        session ? { new: true, upsert: true, session, setDefaultsOnInsert: true } : { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      order.payment = payment._id;
      order.shipment = shipment._id;
      await order.save(session ? { session } : undefined);

      for (const item of orderItems) {
        const inventory = await inventoryModel.findOne({ product: item.product });
        if (inventory) {
          if (item.size && Array.isArray(inventory.sizeStocks)) {
            const idx = inventory.sizeStocks.findIndex((s) => String(s.size || '') === String(item.size || ''));
            if (idx >= 0) {
              inventory.sizeStocks[idx].stock = Math.max(0, Number(inventory.sizeStocks[idx].stock || 0) - Number(item.quantity || 0));
              inventory.sizeStocks[idx].soldCount = Number(inventory.sizeStocks[idx].soldCount || 0) + Number(item.quantity || 0);
            }
            inventory.stock = inventory.sizeStocks.reduce((sum, s) => sum + Number(s.stock || 0), 0);
            inventory.soldCount = inventory.sizeStocks.reduce((sum, s) => sum + Number(s.soldCount || 0), 0);
            await inventory.save(session ? { session } : undefined);
          } else {
            await inventoryModel.findOneAndUpdate({ product: item.product }, { $inc: { stock: -Number(item.quantity || 0), soldCount: Number(item.quantity || 0) } }, session ? { new: true, session } : { new: true });
          }
        }
      }

      cart.products = [];
      await cart.save(session ? { session } : undefined);

      if (appliedCoupon) {
        const couponUpdates = { $inc: { usedCount: 1 } };
        if (appliedCoupon.isPointCoupon) couponUpdates.$set = { isUsedOnce: true, isActive: false, isDeleted: true };
        await couponModel.findByIdAndUpdate(appliedCoupon._id, couponUpdates, session ? { new: true, session } : { new: true });
      }

      let userQuery = userModel.findById(req.user.id);
      if (session) userQuery = userQuery.session(session);
      const user = await userQuery;
      if (user) {
        user.loyaltyPoints = Math.max(0, Number(user.loyaltyPoints || 0) + earnedPoints);
        await user.save(session ? { session } : undefined);
        await pointTransactionModel.create([{
          user: user._id,
          type: 'earn',
          points: earnedPoints,
          source: 'order',
          order: order._id,
          description: `Tích ${earnedPoints} điểm từ đơn ${orderNumber}`
        }], session ? { session } : undefined);
      }

      return { order, payment, discountAmount, earnedPoints, orderItems, finalAmount, checkoutEmail };
    });

    try {
      const latestUser = await userModel.findById(req.user.id).select('email fullName username');
      const toEmail = String(latestUser?.email || result.checkoutEmail || result.order?.email || '').trim().toLowerCase();
      if (toEmail) {
        await sendOrderSuccessMail({
          to: toEmail,
          customerName: latestUser?.fullName || latestUser?.username || req.user.fullName || req.user.username || fullName,
          orderNumber: result.order.orderNumber || result.order._id,
          items: result.orderItems || [],
          originalAmount: result.order?.originalAmount || 0,
          discountAmount: result.order?.discountAmount || 0,
          shippingFee: 0,
          totalAmount: result.finalAmount || result.order.amount || 0,
          address: result.order?.address || address,
          phone: result.order?.phone || phone,
          note: result.order?.note || ''
        });
      } else {
        console.warn('Khong gui duoc email xac nhan don hang vi khong tim thay email nguoi dung');
      }
    } catch (mailError) {
      console.error('Khong gui duoc email xac nhan don hang', mailError.message || mailError);
    }

    broadcast('order.created', { orderId: String(result.order._id), userId: String(req.user.id) });
    broadcast('order.updated', { orderId: String(result.order._id), userId: String(req.user.id) });
    broadcast('cart.updated', { userId: String(req.user.id) });
    broadcast('inventory.updated', {});
    broadcast('dashboard.updated', {});
    broadcast('loyalty.updated', { userId: String(req.user.id) });
    if (couponCode) broadcast('coupon.updated', {});

    res.send({
      message: paymentMethod === 'bank' ? 'tao don hang thanh cong, vui long chuyen khoan theo thong tin cung cap' : 'dat hang thanh cong',
      order: result.order,
      payment: result.payment,
      earnedPoints: result.earnedPoints || 0
    });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
