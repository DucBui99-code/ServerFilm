const router = require("express").Router();

const authRoute = require("./authRouters");
const adminRoute = require("./adminRouters");
const userRoute = require("./userRouters");
const movieRoute = require("./movieRouters");
const moviePackPaymentRoute = require("./moviePackageRouters");
const paymentRoute = require("./paymentRouters");

router.use("/auth", authRoute);
router.use("/admin", adminRoute);
router.use("/user", userRoute);
router.use("/movie", movieRoute);
router.use("/payment", moviePackPaymentRoute);
router.use("/bill", paymentRoute);

module.exports = router;
