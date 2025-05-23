import express from "express";
import dotenv from "dotenv";
import userRoutes from "./src/routes/userRoute.js";
import authMiddleware from "./src/middlewares/protected.js";
import errorHandler from "./src/middlewares/errorhandler.js";
dotenv.config();
const app = express();

//GLOBAL MIDDLEWARES
app.use(express.json());

app.get("/", authMiddleware, (req, res) => {
  res.status(200);
});

//ENDPOINT ROUTE
app.use("/api/auth", userRoutes);

//ERROR HANDLER MIDDLEWARER
app.use(errorHandler);

app.listen(process.env.PORT, () =>
  console.log(`Server: Server spinning on port ${process.env.PORT}...`)
);
