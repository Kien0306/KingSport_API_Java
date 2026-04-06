var express = require('express');
var router = express.Router();
let slugify = require('slugify');
let categoryModel = require('../schemas/categories');
let { CheckLogin, CheckRole } = require('../utils/authHandler');
const { broadcast } = require('../utils/realtime');

function buildSlug(value) {
  return slugify(value, { replacement: '-', lower: true, trim: true });
}

router.get('/', async function (req, res) {
  let data = await categoryModel.find({ isDeleted: false }).sort({ createdAt: -1 });
  res.send(data);
});

router.get('/:id', async function (req, res) {
  try {
    let result = await categoryModel.findOne({ isDeleted: false, _id: req.params.id });
    if (result) {
      broadcast('category.updated', { categoryId: String(req.params.id) });
    res.send(result);
    } else {
      res.status(404).send('ID NOT FOUND');
    }
  } catch (error) {
    res.status(404).send(error.message);
  }
});

router.post('/', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    const name = (req.body.name || '').trim();
    const slug = buildSlug(name);
    const existed = await categoryModel.findOne({ name });
    let savedCategory;

    if (existed && existed.isDeleted) {
      existed.name = name;
      existed.slug = slug;
      existed.image = req.body.image;
      existed.isDeleted = false;
      savedCategory = await existed.save();
    } else if (existed) {
      return res.status(400).send({ message: 'ten danh muc da ton tai' });
    } else {
      let newCate = new categoryModel({ name, slug, image: req.body.image });
      savedCategory = await newCate.save();
    }
    broadcast('category.updated', { categoryId: String(savedCategory._id) });
    res.send(savedCategory);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.put('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    let payload = { ...req.body };
    if (payload.name) {
      payload.name = payload.name.trim();
      const duplicated = await categoryModel.findOne({ name: payload.name, _id: { $ne: req.params.id }, isDeleted: false });
      if (duplicated) {
        return res.status(400).send({ message: 'ten danh muc da ton tai' });
      }
      payload.slug = buildSlug(payload.name);
    }
    let result = await categoryModel.findByIdAndUpdate(req.params.id, payload, { new: true });
    broadcast('category.updated', { categoryId: String(req.params.id) });
    res.send(result);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

router.delete('/:id', CheckLogin, CheckRole('ADMIN'), async function (req, res) {
  try {
    let result = await categoryModel.findById(req.params.id);
    if (!result) return res.status(404).send({ message: 'id not found' });
    const stamp = Date.now();
    result.name = result.name + '__deleted__' + stamp;
    result.slug = (result.slug || buildSlug(result.name)) + '--deleted--' + stamp;
    result.isDeleted = true;
    await result.save();
    broadcast('category.updated', { categoryId: String(req.params.id) });
    res.send({ message: 'da xoa' });
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
