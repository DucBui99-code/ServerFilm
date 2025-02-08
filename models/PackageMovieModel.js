const mongoose = require("mongoose");

const packageSchema = new mongoose.Schema({
  name: String,
  price: Number,
  duration: Number,
});

const PackagePrice = mongoose.model("PackagesPrice", packageSchema);

module.exports = { PackagePrice };
