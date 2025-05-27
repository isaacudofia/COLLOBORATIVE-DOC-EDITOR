// src/socket/socketHandler.js

import jwt from "jsonwebtoken";
import { PrismaClient } from "../../generated/prisma/client.js";

const prisma = new PrismaClient();

// In-memory store for debouncing document saves
// Structure: { documentId: { content: string, timeoutId: NodeJS.Timeout } }
const documentSaveQueue = new Map();

// Helper to get user's role on a document (duplicated from collaborationController for now to avoid circular dependencies)
const getUserRoleOnDocument = async (documentId, userId) => {
  // Check if user is the owner
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true },
  });
  if (document && document.ownerId === userId) {
    return "OWNER"; // This should match the Prisma Role enum value
  }

  // Check if user is a collaborator
  const collaboration = await prisma.collaboration.findUnique({
    where: {
      userId_documentId: {
        userId,
        documentId,
      },
    },
    select: { role: true },
  });
  return collaboration ? collaboration.role : null;
};

// Function to debounce and save document content to DB
const debounceSaveDocument = (documentId, content) => {
  if (documentSaveQueue.has(documentId)) {
    clearTimeout(documentSaveQueue.get(documentId).timeoutId);
  }

  const timeoutId = setTimeout(async () => {
    try {
      await prisma.document.update({
        where: { id: documentId },
        data: { content: content, updatedAt: new Date() },
      });
    } catch (error) {
      // Error saving will be handled by auto-retry on next content change
    } finally {
      documentSaveQueue.delete(documentId); // Clear from queue after saving
    }
  }, 1000); // Save after 1 second of no new changes

  documentSaveQueue.set(documentId, { content, timeoutId });
};

const initializeSocketHandlers = (io, prismaClient, RoleEnum, jwtSecret) => {
  io.on("connection", (socket) => {
    // --- Authentication for Socket.IO connection ---
    // This event should be emitted by the client right after `connect`
    socket.on("authenticate", (data) => {
      const { token } = data;
      if (!token) {
        socket.emit("authenticated", {
          success: false,
          message: "No token provided.",
        });
        socket.disconnect(true); // Disconnect unauthenticated sockets
        return;
      }
      try {
        const decoded = jwt.verify(token, jwtSecret);
        socket.user = decoded; // Attach user info to the socket (userId, userEmail from JWT)
        socket.emit("authenticated", {
          success: true,
          userId: socket.user.userID,
        });
      } catch (error) {
        socket.emit("authenticated", {
          success: false,
          message: "Invalid token.",
        });
        socket.disconnect(true); // Disconnect on failed auth
      }
    });

    // --- Join Document Room ---
    socket.on("join-document", async ({ documentId }) => {
      // Token should ideally be sent once via "authenticate"
      const user = socket.user;
      if (!user) {
        socket.emit("document-join-error", {
          message: "Authentication required before joining a document.",
        });
        return;
      }

      // Check user permissions for the document
      const userRole = await getUserRoleOnDocument(documentId, user.userID);
      if (!userRole) {
        socket.emit("document-join-error", {
          message:
            "Access Denied: You do not have permission to view this document.",
        });
        return;
      }

      // Leave any previously joined document room (for single document focus per socket)
      // This ensures a user is only actively collaborating on one document at a time per tab/socket.
      // If a user can edit multiple documents simultaneously on different tabs, each tab needs its own socket.
      socket.rooms.forEach((room) => {
        if (room !== socket.id) {
          // Don't leave the default personal room
          socket.leave(room);
          // Emit user:left-document for the old document (Day 9 concept)
          io.to(room).emit("user:left-document", {
            documentId: room, // The room name is the documentId
            userId: user.userID,
            userName: user.userName,
          });
        }
      });

      socket.join(documentId);

      // Fetch and send initial document content to the joining client
      try {
        const document = await prismaClient.document.findUnique({
          where: { id: documentId },
          select: { content: true },
        });
        if (document) {
          socket.emit("document:loaded", {
            documentId: documentId,
            content: document.content,
            userRole: userRole,
          });
          // Inform others in the room about the new user joining (Day 9 concept)
          io.to(documentId).emit("user:joined-document", {
            // Use io.to() to include the sender for presence updates, or socket.to() to exclude
            documentId: documentId,
            userId: user.userID,
            // Assuming user.userName exists in the decoded JWT payload
            userName: user.userName || user.userEmail.split("@")[0], // Fallback to part of email
          });
        } else {
          socket.emit("document-join-error", {
            message: "Document not found.",
          });
        }
      } catch (error) {
        socket.emit("document-join-error", {
          message: "Error loading document.",
        });
      }
    });

    // --- Real-time Document Content Change ---
    socket.on("document-content-change", async (data) => {
      const { documentId, content } = data;
      if (!documentId || content === undefined || content === null) {
        return;
      }

      const user = socket.user;
      if (!user) {
        return;
      } // Ensure the socket is actually in the room for the document they are trying to change
      if (!socket.rooms.has(documentId)) {
        socket.emit("permission-denied", {
          message: "You are not an active collaborator in this document.",
        });
        return;
      } // Check permissions for content modification (OWNER or EDITOR)
      const userRole = await getUserRoleOnDocument(documentId, user.userID);
      if (userRole !== RoleEnum.OWNER && userRole !== RoleEnum.EDITOR) {
        socket.emit("permission-denied", {
          message: "You do not have permission to edit this document.",
        });
        return;
      }

      // Broadcast changes to all other clients in the same room
      socket.to(documentId).emit("document:content-updated", {
        documentId: documentId,
        content: content,
        userId: user.userID, // Who made the change (for future UI)
        userName: user.userName || user.userEmail.split("@")[0],
      });

      // Debounced persistence to database
      debounceSaveDocument(documentId, content);
    });

    // --- Real-time Cursor & Presence (Day 9) ---
    socket.on("document:cursor-move", (data) => {
      const { documentId, position } = data;
      const user = socket.user;
      if (
        !user ||
        !documentId ||
        position === undefined ||
        !socket.rooms.has(documentId)
      ) {
        return; // Ignore if not authenticated, no docId, or not in room
      }

      // Broadcast cursor position to others in the same room
      socket.to(documentId).emit("document:cursor-updated", {
        documentId: documentId,
        userId: user.userID,
        userName: user.userName || user.userEmail.split("@")[0],
        position: position,
      });
    });

    socket.on("leave-document", async ({ documentId }) => {
      const user = socket.user;
      if (!user || !documentId || !socket.rooms.has(documentId)) {
        return;
      }
      socket.leave(documentId);
      // Inform others in the room about the user leaving
      io.to(documentId).emit("user:left-document", {
        documentId: documentId,
        userId: user.userID,
        userName: user.userName || user.userEmail.split("@")[0],
      });
      // Optionally, trigger an immediate save if user was the last active editor in this session
      // (More complex logic needed here)
    });

    // --- Handle Disconnect ---
    socket.on("disconnect", () => {
      const user = socket.user;
      if (user) {
        // Find which document rooms this user was in and emit a "user:left-document" event
        // Iterate through all rooms the socket was in (excluding its own ID room)
        socket.rooms.forEach((room) => {
          if (room !== socket.id) {
            // 'room' here would be the documentId
            // Ensure this is a document room and not some other internal room
            // A more robust way might be to keep a map of `socket.id -> activeDocumentId`
            io.to(room).emit("user:left-document", {
              documentId: room,
              userId: user.userID,
              userName: user.userName || user.userEmail.split("@")[0],
            });
          }
        });
      }
      // Any pending debounced saves will still complete if their timeout hasn't expired.
      // If immediate save on disconnect is critical, you'd need to track active documents per socket.
    });
  });
};

export default initializeSocketHandlers;
