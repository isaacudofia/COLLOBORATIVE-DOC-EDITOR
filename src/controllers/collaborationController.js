import { PrismaClient, Role } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

// Helper function to check if user is owner of a document
const isOwner = async (documentId, userId) => {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: { ownerId: true },
  });
  return document && document.ownerId === userId;
};

// Helper function to get user's role on a document
const getUserRoleOnDocument = async (documentId, userId) => {
  if (await isOwner(documentId, userId)) {
    return Role.OWNER;
  }
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

// 1. Add a collaborator to a document
export const addCollaborator = async (req, res) => {
  const { documentId } = req.params;
  const { email, role } = req.body; // email of the collaborator, and their desired role

  if (!email || !role || !Object.values(Role).includes(role)) {
    return res.status(400).json({
      message: "Email and a valid role (OWNER, EDITOR, VIEWER) are required.",
    });
  }

  try {
    // 1. Check if the authenticated user is the OWNER of the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      return res.status(404).json({ message: "Document not found." });
    }
    if (document.ownerId !== req.user.userID) {
      return res.status(403).json({
        message: "Access Denied: Only the owner can add collaborators.",
      });
    }

    // 2. Find the target user (collaborator) by email
    const targetUser = await prisma.user.findUnique({ where: { email } });
    if (!targetUser) {
      return res.status(404).json({ message: "Collaborator user not found." });
    }

    // 3. Prevent adding owner as collaborator (they are already owner)
    if (targetUser.id === document.ownerId) {
      return res
        .status(400)
        .json({ message: "Owner cannot be added as a collaborator." });
    }

    // 4. Create or update the collaboration
    const collaboration = await prisma.collaboration.upsert({
      where: {
        userId_documentId: {
          userId: targetUser.id,
          documentId: documentId,
        },
      },
      update: { role: role },
      create: {
        userId: targetUser.id,
        documentId: documentId,
        role: role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(200).json({
      message: "Collaborator added/updated successfully!",
      collaboration,
    });
  } catch (error) {
    console.error("Error adding collaborator:", error);
    // Handle unique constraint error if upsert fails for other reasons (e.g., race condition)
    if (
      error.code === "P2002" &&
      error.meta?.target?.includes("userId_documentId")
    ) {
      return res
        .status(409)
        .json({ message: "User is already a collaborator on this document." });
    }
    res
      .status(500)
      .json({ message: "Internal server error during adding collaborator." });
  }
};

// 2. Remove a collaborator from a document
export const removeCollaborator = async (req, res) => {
  const { documentId, collaboratorId } = req.params; // collaboratorId is the ID of the user to remove

  try {
    // 1. Check if the authenticated user is the OWNER of the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document) {
      return res.status(404).json({ message: "Document not found." });
    }
    if (document.ownerId !== req.user.userID) {
      return res.status(403).json({
        message: "Access Denied: Only the owner can remove collaborators.",
      });
    }

    // 2. Prevent owner from removing themselves through this route (they can delete the doc)
    if (collaboratorId === document.ownerId) {
      return res.status(400).json({
        message: "Owner cannot be removed as a collaborator via this route.",
      });
    }

    // 3. Delete the collaboration entry
    const deletedCollaboration = await prisma.collaboration.deleteMany({
      where: {
        documentId: documentId,
        userId: collaboratorId,
      },
    });

    if (deletedCollaboration.count === 0) {
      return res
        .status(404)
        .json({ message: "Collaborator not found for this document." });
    }

    res.status(204).send(); // No Content
  } catch (error) {
    console.error("Error removing collaborator:", error);
    res
      .status(500)
      .json({ message: "Internal server error during removing collaborator." });
  }
};

// 3. Get all collaborators for a document
export const getDocumentCollaborators = async (req, res) => {
  const { documentId } = req.params;

  try {
    // Check if the authenticated user has access to view collaborators (OWNER, EDITOR, VIEWER)
    const userRole = await getUserRoleOnDocument(documentId, req.user.userID);
    const isDocOwner = await isOwner(documentId, req.user.userID);

    if (!userRole && !isDocOwner) {
      // If not owner and not collaborator
      return res.status(403).json({
        message:
          "Access Denied: You are not authorized to view collaborators for this document.",
      });
    }

    // Fixed: Remove the conflicting include/select issue
    const collaborators = await prisma.collaboration.findMany({
      where: { documentId: documentId },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Add the owner to the list of collaborators with OWNER role
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: { owner: { select: { id: true, name: true, email: true } } },
    });

    if (!document) {
      // Should not happen if userRole check passed, but for safety
      return res.status(404).json({ message: "Document not found." });
    }

    const allCollaborators = [
      { role: Role.OWNER, user: document.owner },
      ...collaborators.map((collab) => ({
        role: collab.role,
        user: collab.user,
      })),
    ];

    // Deduplicate in case owner is also listed as a collaborator (should be prevented by upsert logic)
    const uniqueAllCollaborators = Array.from(
      new Map(allCollaborators.map((col) => [col.user.id, col])).values()
    );

    res.status(200).json({ collaborators: uniqueAllCollaborators });
  } catch (error) {
    console.error("Error fetching document collaborators:", error);
    res.status(500).json({
      message: "Internal server error during fetching collaborators.",
    });
  }
};
