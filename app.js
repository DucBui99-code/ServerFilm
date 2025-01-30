const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/database");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const rateLimiter = require("./middlewares/rateLimiter");

dotenv.config({ path: "./config.env" });

connectDB();

const app = express();
app.use(express.json());

app.use(requestLogger);
app.use(rateLimiter);

app.use(errorHandler);

app.use("/v1/movie", require("./routes/index"));

module.exports = app;
