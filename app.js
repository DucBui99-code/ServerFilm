const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const http = require("http");
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const connectDB = require("./config/database");
const errorHandler = require("./middlewares/errorHandler");
const requestLogger = require("./middlewares/requestLogger");
const rateLimiter = require("./middlewares/rateLimiter");
const commentSocket = require("./sockets/commentSocket");

dotenv.config({ path: "./config.env" });

connectDB();

const app = express();
const server = http.createServer(app);

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

const pubClient = createClient({
  host: process.env.REDIS_HOST,
  port: process.env.REDIS_PORT,
});
const subClient = pubClient.duplicate();

io.adapter(createAdapter(pubClient, subClient));

app.use(express.json());

app.set("trust proxy", 1);

app.use(
  cors({
    origin: "*",
    methods: ["GET", "PATCH", "POST", "DELETE", "PUT"],
    credentials: true,
  })
);
commentSocket(io);

app.use(requestLogger);
app.use(rateLimiter);

app.use("/v1/MovieApp", require("./routes/index"));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
