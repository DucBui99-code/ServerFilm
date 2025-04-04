const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const cookieParser = require("cookie-parser");

const connectDB = require("./config/database");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const rateLimiter = require("./middlewares/rateLimiter");
const { initSocket } = require("./config/socket"); // Import socket
const { commentLiveSocket } = require("./sockets/commentSocket");
const checkExpiredBills = require("./jobs/cronJobCheckPayment");

dotenv.config({ path: ".env" });

connectDB();
const isDevelopment = process.env.NODE_ENV === "development";

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "10mb" })); // Giới hạn request body tối đa 10MB
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use(cookieParser());
app.use(
  cors({
    origin: isDevelopment
      ? process.env.DEV_ALLOW_URL
      : process.env.PRODUCTION_ALLOW_URL, // Chỉ chấp nhận origin từ danh sách
    credentials: true,
    exposedHeaders: ["set-cookie"],
  })
);

// Khởi động Socket.io
initSocket(server);
commentLiveSocket();
checkExpiredBills();

app.use(express.json());

app.set("trust proxy", 1);

app.use(requestLogger);
app.use(rateLimiter);

app.use("/v1/MovieApp", require("./routes/index"));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
