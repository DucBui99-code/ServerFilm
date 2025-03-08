const mongoose = require("mongoose");

// Kết nối với MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(`${process.env.DATABASE_URL}`);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Dừng ứng dụng nếu không kết nối được
  }
};

module.exports = connectDB;
