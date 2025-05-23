import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1]; // Extract token from "Bearer TOKEN"
    if (!token)
      return res
        .status(401)
        .json({ message: "Access Denied: No token provided..." });
    //VERIFY TOKEN CREATED WHEN USER LOGIN TO CHECK THEY AUTHORIZED OR AUTHENTICATED
    jwt.verify(token, process.env.JWT_PRIVATE_KEY, (error, decoded) => {
      if (error)
        return res
          .status(404)
          .json({ message: "Invalidating token failed..." });
      req.user = decoded;
      console.log("Req.user", req.user);
    });
    next(); // Proceed to the next middleware/route handler
  } catch (error) {
    res.status(500).json({
      message: "Internal server error in authentication...",
      error: error.message,
    });
  }
};

export default authMiddleware;
