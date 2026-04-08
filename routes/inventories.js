var express = require('express');
var router = express.Router();
let inventoryModel = require('../schemas/inventories');
let productModel = require('../schemas/products');
let stockMovementModel = require('../schemas/stockmovements');
let { CheckLogin, CheckRole } = require('../utils/authHandler');
const { broadcast } = require('../utils/realtime');

function ensureSizeStocks(product, inventory) {
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const existing = Array.isArray(inventory?.sizeStocks) ? inventory.sizeStocks.map((item) => ({ size: String(item.size || '').trim(), stock: Number(item.stock || 0), soldCount: Number(item.soldCount || 0) })) : [];
  const map = new Map(existing.map((item) => [item.size, item]));
  if (!sizes.length) return existing;
  return sizes.map((size) => map.get(size) || { size, stock: 0, soldCount: 0 });
}

async function getInventoryRows() {
  const inventories = await inventoryModel.find({}).populate({ path: 'product', match: { isDeleted: false }, populate: { path: 'category', select: 'name' } });
  return inventories.filter(item => item.product).sort((a, b) => String(a.product?.title || '').localeCompare(String(b.product?.title || ''), 'vi')).map(item => {
    const sizeStocks = ensureSizeStocks(item.product, item);
    const totalStock = sizeStocks.length ? sizeStocks.reduce((sum, current) => sum + Number(current.stock || 0), 0) : Number(item.stock || 0);
    const totalSold = sizeStocks.length ? sizeStocks.reduce((sum, current) => sum + Number(current.soldCount || 0), 0) : Number(item.soldCount || 0);
    return {
      _id: item._id, productId: item.product._id, title: item.product.title,
      category: item.product.category?.name || 'Khác', stock: totalStock, reserved: Number(item.reserved || 0), soldCount: totalSold,
      sizeStocks
    };
  });
}

router.get('/', CheckLogin, CheckRole('ADMIN'), async function(req, res) {
  try { res.send(await getInventoryRows()); } catch (error) { res.status(400).send({ message: error.message }); }
});

router.get('/movements', CheckLogin, CheckRole('ADMIN'), async function(req, res) {
  try {
    const data = await stockMovementModel.find({}).populate({ path: 'product', select: 'title' }).populate({ path: 'createdBy', select: 'fullName username' }).sort({ createdAt: -1 }).limit(50);
    res.send(data.map(item => ({ _id: item._id, productTitle: item.product?.title || 'Sản phẩm', size: item.size || '', type: item.type, quantity: item.quantity, stockBefore: item.stockBefore, stockAfter: item.stockAfter, actor: item.createdBy?.fullName || item.createdBy?.username || 'Admin', createdAt: item.createdAt })));
  } catch (error) { res.status(400).send({ message: error.message }); }
});

async function adjustStock(req, res, type) {
  try {
    const quantity = Number(req.body.quantity || 0);
    const size = String(req.body.size || '').trim();
    if (!quantity || quantity < 1) return res.status(400).send({ message: 'Số lượng phải lớn hơn 0' });
    const product = await productModel.findById(req.params.productId).populate('category', 'name');
    if (!product || product.isDeleted) return res.status(404).send({ message: 'Không tìm thấy sản phẩm' });
    let inventory = await inventoryModel.findOne({ product: req.params.productId });
    if (!inventory) inventory = await inventoryModel.create({ product: req.params.productId, stock: 0, reserved: 0, soldCount: 0, sizeStocks: [] });
    let sizeStocks = ensureSizeStocks(product, inventory);
    let stockBefore = 0, stockAfter = 0;
    if (size) {
      const idx = sizeStocks.findIndex((item) => item.size === size);
      if (idx < 0) return res.status(400).send({ message: 'Size không hợp lệ' });
      stockBefore = Number(sizeStocks[idx].stock || 0);
      stockAfter = type === 'in' ? stockBefore + quantity : stockBefore - quantity;
      if (stockAfter < 0) return res.status(400).send({ message: 'Tồn kho size không đủ để xuất' });
      sizeStocks[idx].stock = stockAfter;
    } else {
      stockBefore = Number(inventory.stock || 0);
      stockAfter = type === 'in' ? stockBefore + quantity : stockBefore - quantity;
      if (stockAfter < 0) return res.status(400).send({ message: 'Tồn kho không đủ để xuất' });
      inventory.stock = stockAfter;
    }
    inventory.sizeStocks = sizeStocks;
    inventory.stock = sizeStocks.length ? sizeStocks.reduce((sum, current) => sum + Number(current.stock || 0), 0) : Number(inventory.stock || 0);
    inventory.soldCount = sizeStocks.length ? sizeStocks.reduce((sum, current) => sum + Number(current.soldCount || 0), 0) : Number(inventory.soldCount || 0);
    await inventory.save();
    await stockMovementModel.create({ product: inventory.product, size, type, quantity, stockBefore, stockAfter, createdBy: req.user?._id });
    broadcast('inventory.updated', { productId: String(inventory.product) });
    res.send({ productId: inventory.product, title: product.title, category: product.category?.name || 'Khác', stock: inventory.stock, soldCount: inventory.soldCount, sizeStocks });
  } catch (error) { res.status(400).send({ message: error.message }); }
}

router.post('/:productId/inbound', CheckLogin, CheckRole('ADMIN'), async function(req, res) { await adjustStock(req, res, 'in'); });
router.post('/:productId/outbound', CheckLogin, CheckRole('ADMIN'), async function(req, res) { await adjustStock(req, res, 'out'); });
module.exports = router;
