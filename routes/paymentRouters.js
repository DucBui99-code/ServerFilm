const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const payment = require("../controllers/paymentController");

router.post(
  "/createBillPackMonth",
  authMiddleware,
  payment.createBillPackMonth
);
router.post("/createBillPackRent", authMiddleware, payment.createBillPackRent);
router.post("/cancelBill", authMiddleware, payment.cancelBill);
router.post("/resultBillFromZalo", payment.resultBillFromZalo);
router.post("/resultBillFromSepay", payment.resultBillFromSepay);

module.exports = router;
