// The main function that initializes Socket.IO event handlers
const initializeSocketHandlers = (io, prisma, Role, jwtSecret) => {
  io.on("connection", async (socket) => {
    console.log(`A user connected: ${socket.id}`);

    // 1. Authenticate the WebSocket connection using JWT
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      console.log(`Socket ${socket.id} disconnected: No token provided.`);
      return socket.disconnect(true); // Disconnect without valid token
    }

    try {
      const decoded = jwt.verify(token, jwtSecret); // Use passed jwtSecret
      socket.userId = decoded.userID; // Attach userId to the socket object for later use
      console.log(`User ${socket.userId} connected via socket ${socket.id}`);
    } catch (error) {
      console.error(
        `Socket ${socket.id} - JWT verification failed:`,
        error.message
      );
      // *** ADDED THIS LINE: Emit a specific error message before disconnecting ***
      socket.emit(
        "error",
        "Authentication failed: Invalid or expired token. Please log in again."
      );
      return socket.disconnect(true); // Disconnect on invalid token
    }

    // 2. Handle 'join-document' event
    // When a client wants to join a specific document's room
    socket.on("join-document", async (documentId) => {
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

        // Leave any previous document room the user might be in (important for single-document focus)
        // Filter out the socket's own ID which is always a room
        Array.from(socket.rooms)
          .filter((room) => room !== socket.id)
          .forEach((room) => socket.leave(room));

        // Join the document-specific room
        socket.join(documentId);
        console.log(
          `User ${socket.userId} (socket ${socket.id}) joined document room: ${documentId}`
        );

        // Send the current document content to the newly joined client
        socket.emit("document-loaded", document.content); // Send initial content
        socket.documentId = documentId; // Store document ID on the socket for later use
      } catch (error) {
        console.error(
          `Error joining document ${documentId} for user ${socket.userId}:`,
          error
        );
        socket.emit("document-error", "Server error while joining document.");
      }
    });

    // 3. Handle 'document-content-change' event
    // When a client sends updated content for the document they are in
    socket.on("document-content-change", async (newContent) => {
      const documentId = socket.documentId; // Get the document ID from the socket
      const userId = socket.userId; // Get the user ID from the authenticated socket

      if (!documentId) {
        console.warn(
          `User ${userId} attempted to change content without being in a document room.`
        );
        return socket.emit(
          "document-error",
          "Not in a document to update content."
        );
      }

      // Basic validation for content
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
          // Use Role.EDITOR from imported enum
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

        // Broadcast the change to all other clients in the same document room
        // `socket.to(documentId)` sends to everyone in the room EXCEPT the sender
        io.to(documentId).emit("document-content-update", newContent);
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

    // 4. Handle 'disconnect' event
    socket.on("disconnect", (reason) => {
      console.log(
        `User ${socket.userId || socket.id} disconnected. Reason: ${reason}`
      );
      // When a user disconnects, they automatically leave all rooms they were in.
    });
  });
};

export default initializeSocketHandlers; // Export the function
