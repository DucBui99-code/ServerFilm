const EXPIRED_TIME_OTP = 1;
const LIMIT_DEVICE = 3;
const EXPIRED_TIME_TOKEN = "2m";
const NUMBER_OTP_GENERATE = 6;
const PATH_IMAGE = "https://img.ophim.live/uploads/movies/";
const DEV_URL = "http://localhost:3000";
const EXPIRED_TIME_ORDER = 5; // 5 minutes
const TIME_CHECK_BILL = 10;
const TYPE_LOGIN = {
  byGoogle: "byGoogle",
  byPass: "byPass",
};
const URL_CHECK_BILL = "https://sb-openapi.zalopay.vn/v2/query";
const URL_CREATE_BILL = "https://sb-openapi.zalopay.vn/v2/create";
const PAYMENT_METHODS = ["ZaloPay", "MoMo", "ATMCard", "Bank"];
const PACKAGE_TYPE = ["packageMonth", "packageRent"];
const STATUS = ["pending", "completed", "failed"];
const ACTION_COMMENT_TYPE = {
  like: "like",
  disLike: "disLike",
};
const COMMENT_TYPE = {
  comment: "comment",
  reply: "reply",
};

const LINK_AVATAR_DEFAULT =
  "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";

const LIMIT_CHAT_LIVE = 3;
const TIME_WINDOW = 20; // giây
const MAX_AGE_COOKIE = 7 * 24 * 60 * 60 * 1000;
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
  ACTION_COMMENT_TYPE,
  COMMENT_TYPE,
  LINK_AVATAR_DEFAULT,
  LIMIT_CHAT_LIVE,
  TIME_WINDOW,
  TIME_CHECK_BILL,
  MAX_AGE_COOKIE,
};
