var express = require('express');
var router = express.Router();
var auth = require('../utils/authHandler');

function normalizeBase64(input) {
  if (!input || typeof input !== 'string') return null;
  if (input.startsWith('data:')) return input;
  return `data:application/octet-stream;base64,${input}`;
}

router.get('/', auth.CheckLogin, auth.CheckRole('ADMIN'), function (req, res) {
  res.send({ message: 'upload route ready' });
});

router.post('/', auth.CheckLogin, auth.CheckRole('ADMIN'), function (req, res) {
  try {
    var body = req.body || {};
    var fileName = body.fileName || 'upload.bin';
    var mimeType = body.mimeType || 'application/octet-stream';
    var data = normalizeBase64(body.data || body.base64 || '');

    if (!data) {
      return res.status(400).send({ message: 'thieu du lieu file' });
    }

    res.send({
      message: 'tai len thanh cong',
      file: {
        fileName: fileName,
        mimeType: mimeType,
        data: data
      }
    });
  } catch (error) {
    res.status(500).send({ message: error.message || 'khong the tai len file' });
  }
});

module.exports = router;
