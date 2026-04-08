var express = require('express');
var router = express.Router();
let bannerModel = require('../schemas/banners');

router.get('/', async function (req, res) {
  try {
    const banners = await bannerModel.find({ isDeleted: false, isActive: true }).sort({ sortOrder: 1, createdAt: -1 });
    res.send(banners);
  } catch (error) {
    res.status(400).send({ message: error.message });
  }
});

module.exports = router;
