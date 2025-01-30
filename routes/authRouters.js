const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const authController = require("../controllers/authController");

router.post("/login", authController.login);

router.post("/register", authController.register);

router.post("/sendOTP", authController.sendOTP);

router.post("/verify", authController.verifyOTP);

router.post("/forgotPassword", authMiddleware, authController.forgotPassword);

router.post("/resetPassword", authMiddleware, authController.resetPassword);

router.post("/changePassword", authMiddleware, authController.updatePassword);

module.exports = router;
