const mongoose = require("mongoose");

// Kết nối với MongoDB
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(
      `mongodb+srv://${process.env.DATABASE_USERNAME}:${process.env.DATABASE_PASSWORD}@${process.env.DATABASE_CLUSTER}/${process.env.DATABASE_NAME}?retryWrites=true&w=majority`
    );

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1); // Dừng ứng dụng nếu không kết nối được
  }
};

module.exports = connectDB;
