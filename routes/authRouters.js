const router = require("express").Router();

const authController = require("../controllers/authController");

router.post("/login", authController.login);

router.post("/register", authController.register);

router.post("/sendOTP", authController.sendOTP);

router.post("/verify", authController.verifyOTP);

router.post("/forgotPassword", authController.forgotPassword);

router.post("/resetPassword", authController.resetPassword);

module.exports = router;
