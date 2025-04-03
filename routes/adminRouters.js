const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const adminController = require("../controllers/adminController");

router.post("/toggleBanUser", authMiddleware, adminController.toggleBanUser);
router.post("/setRoleUser", authMiddleware, adminController.setRoleUser);
router.post(
  "/sendNotification",
  authMiddleware,
  adminController.sendGlobalNotification
);
router.delete("/clearCache", authMiddleware, adminController.clearCache);
module.exports = router;
