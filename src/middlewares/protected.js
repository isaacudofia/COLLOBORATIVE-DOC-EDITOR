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
          .status(403) // Changed from 404 to 403 for invalid token
          .json({ message: "Invalid token..." });

      req.user = decoded;

      next(); // Move next() inside the callback after successful verification
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error in authentication...",
      error: error.message,
    });
  }
};

export default authMiddleware;
