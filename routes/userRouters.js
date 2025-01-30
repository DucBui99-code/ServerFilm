const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const userController = require("../controllers/userController");

router.post("/updateInfo", authMiddleware, userController.updateInfomation);
router.get("/profile", authMiddleware, userController.getProfile);

module.exports = router;
