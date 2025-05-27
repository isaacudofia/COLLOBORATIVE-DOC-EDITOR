import express from "express";
import dotenv from "dotenv";
import userRoutes from "./src/routes/userRoute.js";
import errorHandler from "./src/middlewares/errorhandler.js";
import documentRoutes from "./src/routes/documentRoute.js";
import collaborationRoutes from "./src/routes/collaborationRoutes.js";
import http from "http";
import { Server } from "socket.io"; // Import Server from socket.io
import cors from "cors"; // Essential for frontend connections
import initializeSocketHandlers from "./src/socket/socketHandler.js";
import { PrismaClient, Role } from "./generated/prisma/client.js";

dotenv.config();
const prisma = new PrismaClient(); // Initialize Prisma client once globally
const app = express();
// Create an HTTP server from the Express app
const server = http.createServer(app); // IMPORTANT: Create HTTP server

// Create a Socket.IO server attached to the HTTP server
const io = new Server(server, {
  // IMPORTANT: Attach Socket.IO to the HTTP server
  cors: {
    origin: "*", // Allow all origins for development. In production, specify your frontend URL.
    methods: ["GET", "POST"],
  },
});

//GLOBAL MIDDLEWARES
app.use(express.json());
app.use(cors());

app.get("/", (req, res) => {
  res
    .status(200)
    .json({ message: "Welcome to the Collaborative Document Editor Backend!" });
});

//ENDPOINT ROUTE
app.use("/api/auth", userRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/documents", collaborationRoutes);

// ERROR HANDLER MIDDLEWARER
app.use(errorHandler);

// *** Initialize Socket.IO Connection Handling ***
// Pass the io instance, prisma client, and JWT secret to the handler function
initializeSocketHandlers(io, prisma, Role, process.env.JWT_PRIVATE_KEY); // Initialize socket handlers

// Start the server (use the http server, not just the Express app)
server.listen(process.env.PORT, () => {
  // IMPORTANT: The HTTP server listens
  // Server is now running
});

// Add a process exit handler for Prisma client disconnect
process.on("beforeExit", async () => {
  await prisma.$disconnect();
});
