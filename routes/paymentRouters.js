const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const payment = require("../controllers/paymentController");

router.post("/checkPayment", payment.getPayMent);
router.post(
  "/createBillPackMonth",
  authMiddleware,
  payment.createBillPackMonth
);

router.post("/createBillPackRent", authMiddleware, payment.createBillPackRent);

router.post("/checkBill", authMiddleware, payment.checkBill);
router.post("/cancelBill", authMiddleware, payment.cancelBill);
router.post("/resultBillFromZalo", payment.resultBillFromZalo);

module.exports = router;
