const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const userController = require("../controllers/userController");
const { createUploader } = require("../services/uploadImage");

router.post("/updateInfo", authMiddleware, userController.updateInformation);

router.get("/profile", authMiddleware, userController.getProfile);

router.post(
  "/uploadAvatar",
  authMiddleware,
  createUploader("MovieAvatar"),
  userController.upLoadAvatar
);

router.post(
  "/toggleFavoriteMovie",
  authMiddleware,
  userController.toggleFavoriteMovie
);

router.post(
  "/remmoveDeivce",
  authMiddleware,
  userController.removeDeviceManagement
);

router.post("/commentMovie", authMiddleware, userController.commentMovie);

router.post(
  "/editCommentMovie",
  authMiddleware,
  userController.editCommentMovie
);
router.post(
  "/deleteCommentMovie",
  authMiddleware,
  userController.deleteCommentMovie
);

router.post("/replyComment", authMiddleware, userController.replyComment);

module.exports = router;
