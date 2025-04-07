const requestLogger = (req, res, next) => {
  next();
};

module.exports = requestLogger;
