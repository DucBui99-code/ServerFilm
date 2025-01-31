const router = require("express").Router();

const authRoute = require("./authRouters");
const userRoute = require("./userRouters");
const movieRoute = require("./movieRouters");

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/movie", movieRoute);

module.exports = router;
