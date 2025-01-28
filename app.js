const express = require("express");
const dotenv = require("dotenv");
const connectDB = require("./config/database");

dotenv.config({ path: "./config.env" });

connectDB();

const app = express();
app.use(express.json());

app.use((err, req, res, next) => {
  res.status(500).json({ message: err.message });
});

app.use("/v1/movie", require("./routes/index"));

module.exports = app;
