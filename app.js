const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");

const connectDB = require("./config/database");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const rateLimiter = require("./middlewares/rateLimiter");
const commentSocket = require("./sockets/commentSocket");
const notificationSocket = require("./sockets/notificationSocket");

dotenv.config({ path: ".env" });

connectDB();

const app = express();
const server = http.createServer(app);

const allowedOrigins = ["https://movie-night-vn.netlify.app"];

app.use(
  cors({
    origin: allowedOrigins, // Chỉ chấp nhận origin từ danh sách
    credentials: true,
  })
);

app.options("*", (req, res) => {
  console.log("OPTIONS request:", req.headers);
  res.header(
    "Access-Control-Allow-Origin",
    "https://movie-night-vn.netlify.app"
  );
  res.header(
    "Access-Control-Allow-Methods",
    "GET, PATCH, POST, DELETE, PUT, OPTIONS"
  );
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.header("Access-Control-Allow-Credentials", "true");
  res.sendStatus(204);
});

const io = require("socket.io")(server, {
  cors: {
    origin: "https://movie-night-vn.netlify.app",
    methods: ["GET", "POST"],
    credentials: true,
  },
});

app.use(express.json());

app.set("trust proxy", 1);

commentSocket(io);
notificationSocket(io);

app.use(requestLogger);
app.use(rateLimiter);

app.use("/v1/MovieApp", require("./routes/index"));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
