import express from "express";
import dotenv from "dotenv";
import userRoutes from "./src/routes/userRoute.js";
import errorHandler from "./src/middlewares/errorhandler.js";
import documentRoutes from "./src/routes/documentRoute.js";
dotenv.config();
const app = express();

//GLOBAL MIDDLEWARES
app.use(express.json());

app.get("/", (req, res) => {
  res
    .status(200)
    .json({ message: "Welcome to the Collaborative Document Editor Backend!" });
});

//ENDPOINT ROUTE
app.use("/api/auth", userRoutes);
app.use("/api", documentRoutes);

// ERROR HANDLER MIDDLEWARER
app.use(errorHandler);

app.listen(process.env.PORT, () =>
  console.log(`Server: Server spinning on port ${process.env.PORT}...`)
);
