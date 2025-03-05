const { getCommentsFromCache } = require("../sockets/dataComments");

exports.getCommentLive = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const comments = await getCommentsFromCache(movieId);
    return res.status(200).json({
      status: true,
      message: "Get comment live successfully",
      data: comments,
    });
  } catch (error) {
    next(error);
  }
};
