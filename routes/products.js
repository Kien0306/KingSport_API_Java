var express = require('express');
var router = express.Router();
let slugify = require('slugify');
let productModel = require('../schemas/products');
let inventoryModel = require('../schemas/inventories');
let { CheckLogin, CheckRole } = require('../utils/authHandler');
const { broadcast } = require('../utils/realtime');

function buildSlug(value) {
  return slugify(value, { replacement: '-', lower: true, trim: true });
}

function normalizeColors(colors = []) {
  if (!Array.isArray(colors)) return [];
  return colors.map((item) => ({ name: String(item?.name || '').trim(), hex: String(item?.hex || '').trim() })).filter((item) => item.name && item.hex);
}

function normalizeSizes(sizes = []) {
  if (!Array.isArray(sizes)) return [];
  return sizes.map((item) => String(item || '').trim()).filter(Boolean);
}

function normalizeSizePrices(sizePrices = [], sizes = [], fallbackPrice = 0) {
  const normalizedSizes = normalizeSizes(sizes);
  const map = new Map();
  if (Array.isArray(sizePrices)) {
    sizePrices.forEach((item) => {
      const size = String(item?.size || '').trim();
      const price = Number(item?.price);
      if (!size || Number.isNaN(price) || price < 0) return;
      map.set(size.toLowerCase(), { size, price });
    });
  }
  return normalizedSizes.map((size) => map.get(size.toLowerCase()) || { size, price: Number(fallbackPrice || 0) });
}



function normalizeSizeStocks(sizeStocks = [], sizes = [], soldSource = []) {
  const normalizedSizes = normalizeSizes(sizes);
  const stockMap = new Map();
  if (Array.isArray(sizeStocks)) {
    sizeStocks.forEach((item) => {
      const size = String(item?.size || '').trim();
      const stock = Math.max(0, Number(item?.stock || 0));
      if (!size) return;
      stockMap.set(size.toLowerCase(), { size, stock });
    });
  }
  const soldMap = new Map();
  if (Array.isArray(soldSource)) {
    soldSource.forEach((item) => {
      const size = String(item?.size || '').trim();
      if (!size) return;
      soldMap.set(size.toLowerCase(), Math.max(0, Number(item?.soldCount || 0)));
    });
  }
  return normalizedSizes.map((size) => {
    const stockInfo = stockMap.get(size.toLowerCase());
    return {
      size,
      stock: Math.max(0, Number(stockInfo?.stock || 0)),
      soldCount: Math.max(0, Number(soldMap.get(size.toLowerCase()) || 0)),
    };
  });
}

function resolvePriceBySize(product, selectedSize = '') {
  const fallbackPrice = Number(product?.price || 0);
  if (!selectedSize) return fallbackPrice;
  const found = Array.isArray(product?.sizePrices)
    ? product.sizePrices.find((item) => String(item?.size || '').trim() === String(selectedSize || '').trim())
    : null;
  return Number(found?.price ?? fallbackPrice);
}

function buildSizeStocks(product, inventory) {
  const sizes = Array.isArray(product?.sizes) ? product.sizes : [];
  const existing = Array.isArray(inventory?.sizeStocks) ? inventory.sizeStocks.map((item) => ({ size: String(item.size || '').trim(), stock: Number(item.stock || 0), soldCount: Number(item.soldCount || 0) })) : [];
  if (!sizes.length) return existing;
  if (existing.length) {
    const map = new Map(existing.map((item) => [item.size, item]));
    return sizes.map((size) => map.get(size) || { size, stock: 0, soldCount: 0 });
  }
  const totalStock = Number(inventory?.stock || 0);
  const totalSold = Number(inventory?.soldCount || 0);
  const baseStock = sizes.length ? Math.floor(totalStock / sizes.length) : 0;
  const remainStock = sizes.length ? totalStock % sizes.length : 0;
  const baseSold = sizes.length ? Math.floor(totalSold / sizes.length) : 0;
  const remainSold = sizes.length ? totalSold % sizes.length : 0;
  return sizes.map((size, index) => ({ size, stock: baseStock + (index < remainStock ? 1 : 0), soldCount: baseSold + (index < remainSold ? 1 : 0) }));
}

async function attachInventory(products) {
  const ids = products.map((item) => item._id);
  const inventories = await inventoryModel.find({ product: { $in: ids } });
  const map = new Map(inventories.map((item) => [String(item.product), item]));
  return products.map((item) => {
    const product = item.toObject();
    const inventory = map.get(String(item._id));
    const sizeStocks = buildSizeStocks(product, inventory);
    product.sizeStocks = sizeStocks;
    product.sizePrices = normalizeSizePrices(product.sizePrices, product.sizes, product.price);
    product.stock = sizeStocks.length ? sizeStocks.reduce((sum, current) => sum + Number(current.stock || 0), 0) : Number(inventory?.stock || 0);
    product.reserved = inventory ? inventory.reserved : 0;
    product.soldCount = sizeStocks.length ? sizeStocks.reduce((sum, current) => sum + Number(current.soldCount || 0), 0) : Number(inventory?.soldCount || 0);
    return product;
  });
}

router.get('/', async function (req, res) {
  let queries = req.query;
  let titleQ = queries.title ? queries.title.toLowerCase() : '';
  let min = Number(queries.minprice || 0);
  let max = Number(queries.maxprice || 1000000000);
  let filter = { isDeleted: false, title: new RegExp(titleQ, 'i'), price: { $gte: min, $lte: max } };
  if (queries.category) filter.category = queries.category;
  if (queries.featured === 'true') filter.isFeatured = true;
  if (queries.gender) filter.gender = queries.gender;
  if (queries.size) {
    const sizes = String(queries.size).split(',').map((item) => item.trim()).filter(Boolean);
    if (sizes.length) filter.sizes = { $in: sizes };
  }
  if (queries.color) {
    const colors = String(queries.color).split(',').map((item) => item.trim()).filter(Boolean);
    if (colors.length) filter['colors.name'] = { $in: colors };
  }
  let sort = { createdAt: -1 };
  if (queries.sort === 'price_asc') sort = { price: 1 };
  if (queries.sort === 'price_desc') sort = { price: -1 };
  if (queries.sort === 'name_asc') sort = { title: 1 };
  let data = await productModel.find(filter).populate({ path: 'category', select: 'name slug' }).sort(sort);
  res.send(await attachInventory(data));
});

router.get('/:id', async function (req, res) {
  try {
    let result = await productModel.findOne({ isDeleted: false, _id: req.params.id }).populate({ path: 'category', select: 'name slug' });
    if (result) {
      let [withInventory] = await attachInventory([result]);
      return res.send(withInventory);
    }
    return res.status(404).send('ID NOT FOUND');
  } catch (error) {
    return res.status(404).send(error.message);
  }
});

router.post('/', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const title = (req.body.title || '').trim();
    const slug = buildSlug(title);
    const existed = await productModel.findOne({ title });
    const payload = {
      title, slug, price: req.body.price,
      images: Array.isArray(req.body.images) ? req.body.images : [],
      description: req.body.description,
      category: req.body.category,
      gender: req.body.gender || 'unisex',
      sizes: normalizeSizes(req.body.sizes),
      sizePrices: normalizeSizePrices(req.body.sizePrices, req.body.sizes, req.body.price),
      colors: normalizeColors(req.body.colors),
      isFeatured: Boolean(req.body.isFeatured)
    };
    let savedProduct;
    if (existed && existed.isDeleted) { Object.assign(existed, payload, { isDeleted: false }); savedProduct = await existed.save(); }
    else if (existed) return res.status(400).send({ message: 'ten san pham da ton tai' });
    else savedProduct = await new productModel(payload).save();

    const requestedSizeStocks = normalizeSizeStocks(req.body.sizeStocks, req.body.sizes);
    const sizeStocks = requestedSizeStocks.length
      ? requestedSizeStocks
      : buildInitialSizeStocks(req.body.sizes, req.body.initialStock || 0);
    const initialStock = sizeStocks.reduce((sum, current) => sum + Number(current.stock || 0), 0);
    await inventoryModel.findOneAndUpdate({ product: savedProduct._id }, { stock: initialStock, soldCount: 0, sizeStocks }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const result = await productModel.findById(savedProduct._id).populate('category', 'name slug');
    const [withInventory] = await attachInventory([result]);
    broadcast('product.updated', { productId: String(savedProduct._id) });
    res.send(withInventory);
  } catch (error) { res.status(400).send({ message: error.message }); }
});

router.put('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    let payload = { ...req.body };
    if (payload.title) {
      const duplicated = await productModel.findOne({ title: payload.title.trim(), _id: { $ne: req.params.id }, isDeleted: false });
      if (duplicated) return res.status(400).send({ message: 'ten san pham da ton tai' });
      payload.title = payload.title.trim(); payload.slug = buildSlug(payload.title);
    }
    if (payload.isFeatured !== undefined) payload.isFeatured = Boolean(payload.isFeatured);
    if (payload.gender !== undefined) payload.gender = payload.gender || 'unisex';
    if (payload.sizes !== undefined) payload.sizes = normalizeSizes(payload.sizes);
    if (payload.sizePrices !== undefined || payload.sizes !== undefined || payload.price !== undefined) {
      const existingProduct = await productModel.findById(req.params.id);
      const sizesForPrices = payload.sizes !== undefined ? payload.sizes : (existingProduct?.sizes || []);
      const fallbackPrice = payload.price !== undefined ? payload.price : (existingProduct?.price || 0);
      const sourcePrices = payload.sizePrices !== undefined ? payload.sizePrices : (existingProduct?.sizePrices || []);
      payload.sizePrices = normalizeSizePrices(sourcePrices, sizesForPrices, fallbackPrice);
    }
    if (payload.colors !== undefined) payload.colors = normalizeColors(payload.colors);
    let result = await productModel.findByIdAndUpdate(req.params.id, payload, { new: true }).populate('category', 'name slug');
    if (payload.sizes !== undefined || payload.sizeStocks !== undefined) {
      const inventory = await inventoryModel.findOne({ product: req.params.id });
      const productSizes = payload.sizes !== undefined ? payload.sizes : (result?.sizes || []);
      const existing = Array.isArray(inventory?.sizeStocks) ? inventory.sizeStocks : [];
      const next = payload.sizeStocks !== undefined
        ? normalizeSizeStocks(payload.sizeStocks, productSizes, existing)
        : normalizeSizeStocks(existing, productSizes, existing);
      const totalStock = next.reduce((s, i) => s + Number(i.stock || 0), 0);
      const totalSold = next.reduce((s, i) => s + Number(i.soldCount || 0), 0);
      await inventoryModel.findOneAndUpdate({ product: req.params.id }, { stock: totalStock, soldCount: totalSold, sizeStocks: next }, { new: true, upsert: true });
    }
    const [withInventory] = await attachInventory([result]);
    broadcast('product.updated', { productId: String(req.params.id) });
    res.send(withInventory);
  } catch (error) { res.status(400).send({ message: error.message }); }
});

router.delete('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    let result = await productModel.findById(req.params.id);
    if (!result) return res.status(404).send({ message: 'id not found' });
    const stamp = Date.now();
    result.title = result.title + '__deleted__' + stamp;
    result.slug = (result.slug || buildSlug(result.title)) + '--deleted--' + stamp;
    result.isFeatured = false; result.isDeleted = true; await result.save();
    broadcast('product.updated', { productId: String(req.params.id) });
    res.send({ message: 'da xoa' });
  } catch (error) { res.status(400).send({ message: error.message }); }
});

module.exports = router;
