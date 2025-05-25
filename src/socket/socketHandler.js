// FIXED: Added missing JWT import
import jwt from "jsonwebtoken";

// The main function that initializes Socket.IO event handlers
const initializeSocketHandlers = (io, prisma, Role, jwtSecret) => {
  io.on("connection", async (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // 1. Authenticate the WebSocket connection using JWT
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      console.log(`Socket ${socket.id} disconnected: No token provided.`);
      // FIXED: Emit error before disconnecting and add delay
      socket.emit("error", "No authentication token provided");
      setTimeout(() => socket.disconnect(true), 100);
      return;
    }

    try {
      const decoded = jwt.verify(token, jwtSecret);
      socket.userId = decoded.userID;
      console.log(`User ${socket.userId} connected via socket ${socket.id}`);

      // FIXED: Emit successful connection event
      socket.emit("connected", {
        message: "Successfully connected and authenticated",
        userId: socket.userId,
      });
    } catch (error) {
      console.error(
        `Socket ${socket.id} - JWT verification failed:`,
        error.message
      );

      // FIXED: Emit error with delay before disconnecting
      socket.emit("error", {
        type: "authentication_failed",
        message:
          "Authentication failed: Invalid or expired token. Please log in again.",
      });

      setTimeout(() => socket.disconnect(true), 100);
      return;
    }

    // 2. Handle 'join-document' event
    socket.on("join-document", async (documentId) => {
      console.log(
        `User ${socket.userId} attempting to join document: ${documentId}`
      );

      if (!documentId) {
        console.warn(
          `User ${socket.userId} attempted to join document with no ID.`
        );
        return socket.emit(
          "document-error",
          "Document ID is required to join."
        );
      }

      try {
        // Before joining, verify if the user has access to this document
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          include: {
            collaborators: {
              where: { userId: socket.userId },
              select: { role: true },
            },
          },
        });

        if (!document) {
          console.warn(
            `User ${socket.userId} tried to join non-existent document: ${documentId}`
          );
          return socket.emit("document-error", "Document not found.");
        }

        // Check if user is owner or collaborator
        const isOwner = document.ownerId === socket.userId;
        const isCollaborator = document.collaborators.length > 0;

        if (!isOwner && !isCollaborator) {
          console.warn(
            `User ${socket.userId} unauthorized to join document: ${documentId}`
          );
          return socket.emit(
            "document-error",
            "Access Denied: You are not authorized to view this document."
          );
        }

        // Leave any previous document room
        Array.from(socket.rooms)
          .filter((room) => room !== socket.id)
          .forEach((room) => {
            console.log(`User ${socket.userId} leaving room: ${room}`);
            socket.leave(room);
          });

        // Join the document-specific room
        socket.join(documentId);
        console.log(
          `User ${socket.userId} (socket ${socket.id}) joined document room: ${documentId}`
        );

        // FIXED: Send more comprehensive document data
        socket.emit("document-loaded", {
          documentId: documentId,
          content: document.content,
          title: document.title,
          message: "Successfully joined document",
        });

        socket.documentId = documentId;

        // FIXED: Notify other users in the room about new user joining
        socket.to(documentId).emit("user-joined", {
          userId: socket.userId,
          message: `User ${socket.userId} joined the document`,
        });
      } catch (error) {
        console.error(
          `Error joining document ${documentId} for user ${socket.userId}:`,
          error
        );
        socket.emit("document-error", "Server error while joining document.");
      }
    });

    // 3. Handle 'document-content-change' event
    socket.on("document-content-change", async (newContent) => {
      const documentId = socket.documentId;
      const userId = socket.userId;

      console.log(
        `User ${userId} attempting to change content in document: ${documentId}`
      );

      if (!documentId) {
        console.warn(
          `User ${userId} attempted to change content without being in a document room.`
        );
        return socket.emit(
          "document-error",
          "Not in a document to update content."
        );
      }

      if (typeof newContent !== "string") {
        return socket.emit("document-error", "Invalid content format.");
      }

      try {
        // Fetch document to verify ownership/editor role
        const document = await prisma.document.findUnique({
          where: { id: documentId },
          include: {
            collaborators: {
              where: { userId: userId },
              select: { role: true },
            },
          },
        });

        if (!document) {
          return socket.emit(
            "document-error",
            "Document not found during content update."
          );
        }

        const isOwner = document.ownerId === userId;
        const userRole =
          document.collaborators.length > 0
            ? document.collaborators[0].role
            : null;

        // Check if user has permission to edit (OWNER or EDITOR)
        if (!isOwner && userRole !== Role.EDITOR) {
          console.warn(
            `User ${userId} (role: ${userRole}) unauthorized to edit document: ${documentId}`
          );
          return socket.emit(
            "document-error",
            "Access Denied: You do not have permission to edit this document."
          );
        }

        // Update the document content in the database
        await prisma.document.update({
          where: { id: documentId },
          data: { content: newContent },
        });

        // FIXED: Broadcast to all clients in the room INCLUDING the sender
        io.to(documentId).emit("document-content-update", {
          content: newContent,
          updatedBy: userId,
          timestamp: new Date().toISOString(),
        });

        console.log(
          `Document ${documentId} content updated by ${userId} and broadcasted.`
        );
      } catch (error) {
        console.error(
          `Error updating document ${documentId} content for user ${userId}:`,
          error
        );
        socket.emit(
          "document-error",
          "Server error while updating document content."
        );
      }
    });

    // FIXED: Add a test event handler
    socket.on("test", (data) => {
      console.log(`Test event received from user ${socket.userId}:`, data);
      socket.emit("test-response", {
        message: "Test successful",
        receivedData: data,
        timestamp: new Date().toISOString(),
      });
    });

    // 4. Handle 'disconnect' event
    socket.on("disconnect", (reason) => {
      console.log(
        `User ${socket.userId || socket.id} disconnected. Reason: ${reason}`
      );

      // FIXED: Notify other users if the user was in a document room
      if (socket.documentId) {
        socket.to(socket.documentId).emit("user-left", {
          userId: socket.userId,
          message: `User ${socket.userId} left the document`,
        });
      }
    });

    // FIXED: Add error handler for socket errors
    socket.on("error", (error) => {
      console.error(`Socket error for user ${socket.userId}:`, error);
    });
  });
};

export default initializeSocketHandlers;
