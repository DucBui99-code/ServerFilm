const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const rateLimiter = require("./middlewares/rateLimiter");
const cors = require("cors");

dotenv.config({ path: "./config.env" });

connectDB();

const app = express();
app.use(express.json());

app.use(
  cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);
app.use(requestLogger);
app.use(rateLimiter);
app.use(errorHandler);

app.use("/v1/MovieApp", require("./routes/index"));

module.exports = app;
