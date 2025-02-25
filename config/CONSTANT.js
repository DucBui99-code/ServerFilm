const EXPIRED_TIME_OTP = 1;
const LIMIT_DEVICE = 3;
const EXPIRED_TIME_TOKEN = "1h";
const NUMBER_OTP_GENERATE = 6;
const PATH_IMAGE = "https://img.ophim.live/uploads/movies/";
const DEV_URL = "http://localhost:3000";
const EXPIRED_TIME_ORDER = 5 * 60; // 5 minutes
const TYPE_LOGIN = {
  byGoogle: "byGoogle",
  byPass: "byPass",
};
const URL_CHECK_BILL = "https://sb-openapi.zalopay.vn/v2/query";
const URL_CREATE_BILL = "https://sb-openapi.zalopay.vn/v2/create";
const PAYMENT_METHODS = ["ZaloPay", "MoMo", "ATMCard"];
const PACKAGE_TYPE = ["packageMonth", "packageRent"];
const STATUS = ["pending", "completed", "failed"];

module.exports = {
  EXPIRED_TIME_OTP,
  LIMIT_DEVICE,
  EXPIRED_TIME_TOKEN,
  NUMBER_OTP_GENERATE,
  PATH_IMAGE,
  DEV_URL,
  TYPE_LOGIN,
  EXPIRED_TIME_ORDER,
  URL_CREATE_BILL,
  URL_CHECK_BILL,
  PAYMENT_METHODS,
  PACKAGE_TYPE,
  STATUS,
};
