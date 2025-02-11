const moment = require("moment");

exports.checkPackMonthExpiration = (user) => {
  if (user.purchasedMoviesMonth.length === 0) {
    return true;
  }

  const now = moment();
  let maxExpirationDate = null;

  user.purchasedMoviesMonth.forEach((pkg) => {
    const expiration = moment(pkg.exprationDate, "DD/MM/YYYY");
    if (!maxExpirationDate || expiration.isAfter(maxExpirationDate)) {
      maxExpirationDate = expiration;
    }
  });

  const isExpired = !maxExpirationDate || maxExpirationDate.isBefore(now);

  return isExpired;
};

exports.checkRentExpiration = (user, movieId) => {
  if (!user.purchasedMoviesRent.length) {
    return true;
  }

  const now = moment();
  const rentedMovie = user.purchasedMoviesRent.find(
    (rent) => rent.movieId.toString() === movieId.toString()
  );

  if (!rentedMovie) {
    return true;
  }

  const expirationDate = moment(rentedMovie.exprationDate, "DD/MM/YYYY");
  const isExpired = expirationDate.isBefore(now);

  return isExpired;
};
