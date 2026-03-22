var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var mongoose = require("mongoose");
var swaggerUi = require("swagger-ui-express");
var swaggerSpec = require("./swagger.config");
var cors = require("cors");
require("dotenv").config();

var app = express();

/* =========================
   DATABASE CONNECTION
========================= */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected!!"))
  .catch((err) => console.error("MongoDB error:", err));

/* =========================
   VIEW ENGINE SETUP (Pug)
========================= */
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");

/* =========================
   MIDDLEWARE
========================= */
// CORS Configuration
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*", //CORS_ORIGIN=http://localhost:5713
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   SWAGGER DOCUMENTATION
========================= */
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "WDP301 API Documentation",
  }),
);

/* =========================
   ROUTES
========================= */
app.use("/api/favourite", require("./routes/favourite.routes"));
app.use("/api/sepay", require("./routes/sepay.routes"));
app.use("/api/packages", require("./routes/package.routes"));
app.use("/api/auth", require("./routes/auth.routes")); // login / register
app.use("/api/admin", require("./routes/admin.routes")); // admin CRUD accounts
app.use("/api/users", require("./routes/user.routes")); // User explicit profile management and admin CRUD
app.use("/api/drones", require("./routes/drone.routes")); // drone CRUD
app.use("/api/zones", require("./routes/zone.routes")); // zone CRUD
app.use("/api/flights", require("./routes/flight.routes")); // flight history
app.use(
  "/api/flight-plans",
  require("./src/modules/flightPlan/flightPlan.routes"),
); // flight plan route templates CRUD
app.use("/api/missions", require("./src/modules/mission/mission.routes")); // mission + mission plans scheduling
app.use("/api/conflicts", require("./src/modules/conflict/conflict.routes")); // conflict management (admin)
app.use(
  "/api/flight-sessions",
  require("./src/modules/flightSession/flightSession.routes"),
); // flight session management
app.use("/api/telemetry", require("./src/modules/telemetry/telemetry.routes")); // telemetry REST fallback
app.use("/api/alerts", require("./src/modules/alert/alert.routes")); // alert management

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
    error: req.app.get("env") === "development" ? err : {},
  });
});

module.exports = app;
