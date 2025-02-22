const throwError = (message, statusCode = 400, returnCode = null) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.returnCode = returnCode;
  throw error;
};

module.exports = throwError;
