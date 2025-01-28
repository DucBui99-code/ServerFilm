const router = require("express").Router();

const authRoute = require("./authRouters");

router.use("/auth", authRoute);

module.exports = router;
