require('dotenv').config();
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
let mongoose = require('mongoose');

var app = express();
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/NNPTUD-S4';
const uploadsDir = path.join(__dirname, 'uploads');

app.use(logger('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.use(function (req, res, next) {
  const origin = req.headers.origin || '';
  const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  }
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use('/uploads', express.static(uploadsDir));

app.use('/api/v1/users', require('./routes/users'));
app.use('/api/v1/roles', require('./routes/roles'));
app.use('/api/v1/products', require('./routes/products'));
app.use('/api/v1/categories', require('./routes/categories'));
app.use('/api/v1/auth', require('./routes/auth'));
app.use('/api/v1/carts', require('./routes/carts'));
app.use('/api/v1/dashboard', require('./routes/dashboard'));
app.use('/api/v1/payments', require('./routes/payments'));
app.use('/api/v1/banners', require('./routes/banners'));
app.use('/api/v1/coupons', require('./routes/coupons'));
app.use('/api/v1/uploads', require('./routes/uploads'));
app.use('/api/v1/inventories', require('./routes/inventories'));
app.use('/api/v1/loyalty', require('./routes/loyalty'));
app.use('/api/v1/events', require('./routes/events'));

mongoose.connect(MONGO_URI);
mongoose.connection.on('connected', function () {
  console.log('MongoDB connected');
});
mongoose.connection.on('disconnected', function () {
  console.log('MongoDB disconnected');
});


app.use(function (req, res, next) {
  next(createError(404));
});

app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.send({ message: err.message || 'Server error' });
});

module.exports = app;
