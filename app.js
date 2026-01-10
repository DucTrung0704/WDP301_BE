var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var swaggerUi = require('swagger-ui-express');
var swaggerSpec = require('./swagger.config');
require('dotenv').config();

var app = express();

/* =========================
   DATABASE CONNECTION
========================= */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.error("MongoDB error:", err));

/* =========================
   VIEW ENGINE SETUP
========================= */
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

/* =========================
   MIDDLEWARE
========================= */
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* =========================
   SWAGGER DOCUMENTATION
========================= */
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'WDP301 API Documentation'
}));

/* =========================
   ROUTES
========================= */
app.use('/api/auth', require('./routes/auth.routes')); // login / register

/* =========================
   404 HANDLER
========================= */
app.use(function (req, res, next) {
  next(createError(404));
});

/* =========================
   ERROR HANDLER
========================= */
app.use(function (err, req, res, next) {
  res.status(err.status || 500);
  res.json({
    message: err.message,
    error: req.app.get('env') === 'development' ? err : {}
  });
});

module.exports = app;
