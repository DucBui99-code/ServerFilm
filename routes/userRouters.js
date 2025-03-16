const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const userController = require("../controllers/userController");
const notificationController = require("../controllers/notificationController");
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
  "/removeDevice",
  authMiddleware,
  userController.removeDeviceManagement
);

router.post("/addCommentMovie", authMiddleware, userController.commentMovie);

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

router.post(
  "/actionCommentMovie",
  authMiddleware,
  userController.likeOrDislikeComment
);

router.get(
  "/getMyNotification",
  authMiddleware,
  notificationController.getNotification
);

router.get(
  "/getCountNotification",
  authMiddleware,
  notificationController.getCountNotification
);

router.post(
  "/readNotification",
  authMiddleware,
  notificationController.updateIsRead
);

router.post(
  "/hidenNotification",
  authMiddleware,
  notificationController.updateIsHiden
);

module.exports = router;
