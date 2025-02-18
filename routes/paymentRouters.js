const router = require("express").Router();
// const authMiddleware = require("../middlewares/authMiddleware");

const payment = require("../controllers/paymentController");

router.post("/checkPayment", payment.getPayMent);

module.exports = router;
