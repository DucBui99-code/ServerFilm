const router = require("express").Router();

const authRoute = require("./authRouters");
const userRoute = require("./userRouters");
const movieRoute = require("./movieRouters");
const moviePackPaymentRoute = require("./moviePackageRouters");

router.use("/auth", authRoute);
router.use("/user", userRoute);
router.use("/movie", movieRoute);
router.use("/payment", moviePackPaymentRoute);

module.exports = router;
