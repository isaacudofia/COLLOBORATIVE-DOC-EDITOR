const errorHandler = async (error, req, res, next) => {
  console.log("error:", error.stack);
  if (error)
    return res.status(500).json({
      message: "Internal Error: Try again, error fired by error middleware",
      error: error.message,
    });
};

export default errorHandler;
