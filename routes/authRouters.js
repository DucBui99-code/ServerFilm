const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const authController = require("../controllers/authController");

router.post("/login", authController.login);

router.post("/loginByGoogle", authController.loginWithGoogle);

router.post("/register", authController.register);

router.post("/sendOTP", authController.sendOTP);

router.post("/verifyOTP", authController.verifyOTP);

router.post("/forgotPassword", authController.forgotPassword);

router.post("/resetPassword", authController.resetPassword);

router.post("/changePassword", authMiddleware, authController.updatePassword);

router.post("/removeMySelf", authMiddleware, authController.deleteAccount);

router.post("/logout", authMiddleware, authController.logout);

module.exports = router;
