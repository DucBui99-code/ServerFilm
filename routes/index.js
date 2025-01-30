const router = require("express").Router();

const authRoute = require("./authRouters");
const userRoute = require("./userRouters");

router.use("/auth", authRoute);
router.use("/user", userRoute);

module.exports = router;
