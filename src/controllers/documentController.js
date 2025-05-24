import { PrismaClient, Role } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

//CONTROLLER TO GET ALL DOCUMENTS
// Fix for the getAllDocuments function in documentController.js
export const getAllDocuments = async (req, res) => {
  try {
    const ownedDocuments = await prisma.document.findMany({
      where: { ownerId: req.user.userID }, // Only fetch documents owned by the current user
      orderBy: { updatedAt: "desc" }, // Order by most recently updated (descendind order)
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { id: true, name: true, email: true } },
        collaborators: {
          select: {
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });

    // Fetch documents where the user is a collaborator (excluding owned ones to avoid duplicates)
    const collaboratedDocuments = await prisma.collaboration.findMany({
      where: {
        userId: req.user.userID,
        NOT: { document: { ownerId: req.user.userID } },
      },
      include: {
        document: {
          select: {
            id: true,
            title: true,
            createdAt: true,
            updatedAt: true,
            owner: { select: { id: true, name: true, email: true } },
            collaborators: {
              select: {
                role: true,
                user: { select: { id: true, name: true, email: true } },
              },
            },
          },
        },
        role: true,
      },
      orderBy: { document: { updatedAt: "desc" } },
    });

    // Map collaborated documents to the same structure as ownedDocuments
    const mappedCollaboratedDocs = collaboratedDocuments.map((collab) => ({
      ...collab.document,
      userRole: collab.role, // Add the user's specific role on this document
    }));

    // Combine and potentially deduplicate (though NOT clause helps)
    const combinedDocuments = [...ownedDocuments, ...mappedCollaboratedDocs];

    // Basic deduplication if needed (by ID) - for safety
    const uniqueDocuments = Array.from(
      new Map(combinedDocuments.map((doc) => [doc.id, doc])).values()
    );

    // FIXED: Return all documents (owned + collaborated), not just owned
    // Also handle the case when there are no documents at all
    if (uniqueDocuments.length === 0) {
      return res.status(200).json({
        message: "No documents found for this user",
        data: [],
      });
    }

    res.status(200).json({
      message: "Successfully retrieved all documents for the current user",
      data: uniqueDocuments, // Return the combined list, not just ownedDocuments
    });
  } catch (error) {
    console.error("Error in getAllDocuments:", error);
    res.status(500).json({
      message: "Error occurred while fetching all documents",
      error: error.message,
    });
  }
};

//CONTROLLER TO A SPECIFIC DOCUMENT
export const getDocument = async (req, res) => {
  const { id } = req.params;
  try {
    //CHECKING IF DOCUMENT BY THE IDENTIFIER EXIST IN THE DATABASE
    const findDocument = await prisma.document.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        collaborators: {
          where: { userId: req.user.userID }, // Only include the current user's collaboration if exists
          select: { role: true },
        },
      }, // Optionally include owner details
    });

    if (!findDocument)
      return res
        .status(400)
        .json({ message: "No document by such identifier" });

    // Determine the user's role
    let userRole = null;
    if (findDocument.ownerId === req.user.userID) {
      userRole = Role.OWNER;
    } else if (findDocument.collaborators.length > 0) {
      userRole = findDocument.collaborators[0].role; // Get the role from the specific collaboration
    }

    // If user is neither owner nor collaborator, deny access
    if (!userRole) {
      return res.status(403).json({
        message: "Access Denied: You are not authorized to view this document.",
      });
    }

    // Attach the user's role to the document object
    const documentWithRole = { ...findDocument, userRole };

    res.status(203).json({
      message: "get document successfully",
      data: documentWithRole,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error occured while updating document",
      error: error.message,
    });
  }
};

//CONTROLLER TO CREATE A DOCUMENT
export const postDocument = async (req, res) => {
  const { title, content } = req.body; // content is optional for creation
  if (!title)
    return res.status(404).json({
      message: "'Document title is required for creating of document",
    });

  try {
    const createdDocument = await prisma.document.create({
      data: {
        title,
        content: content || "", // Ensure content is at least an empty string
        ownerId: req.user.userID, // Link document to the authenticated user
      },
    });

    res.status(201).json({
      message: "Created document successfully",
      data: createdDocument,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error occured while creating a document" });
  }
};

//CONTROLLER TO UPDATE DOCUMENT THAT EXIST ALREADY
export const updateDocument = async (req, res) => {
  const { id } = req.params;
  const { title, content } = req.body;
  if (!title && content === undefined)
    return res
      .status(400)
      .json({ message: "At least title or content is required for update." });

  try {
    //CHECKING IF DOCUMENT BY THE IDENTIFIER EXIST IN THE DATABASE
    const findDocument = await prisma.document.findUnique({
      where: { id },
      include: {
        collaborators: {
          where: { userId: req.user.userID },
          select: { role: true },
        },
      },
    });

    if (!findDocument)
      return res
        .status(400)
        .json({ message: "No such document by identifier for updating" });

    // Authorization check: Only OWNER or EDITOR can update
    let userRole = null;
    if (findDocument.ownerId === req.user.userID) {
      userRole = Role.OWNER;
    } else if (findDocument.collaborators.length > 0) {
      userRole = findDocument.collaborators[0].role;
    }

    if (userRole !== Role.OWNER && userRole !== Role.EDITOR) {
      return res.status(403).json({
        message:
          "Access Denied: You do not have permission to edit this document.",
      });
    }

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        title: title !== undefined ? title : findDocument.title, // Update title if provided, else keep existing,
        content: content !== undefined ? content : findDocument.content, // Update content if provided, else keep existing,
      },
    });
    res.status(200).json({
      message: "Updated document successfully",
      data: updatedDocument,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error occured while updating document",
      error: error.message,
    });
  }
};

//CONTROLLER TO DELETE DOCUMENT THAT EXIST ALREADY
export const deleteDocument = async (req, res) => {
  const { id } = req.params;
  try {
    //CHECKING IF DOCUMENT BY THE IDENTIFIER EXIST IN THE DATABASE
    const findDocument = await prisma.document.findUnique({
      where: { id },
      include: {
        collaborators: {
          where: { userId: req.user.userID },
          select: { role: true },
        },
      },
    });

    if (!findDocument)
      return res
        .status(400)
        .json({ message: "No such document by identifier for deleting" });

    // Authorization check: Only OWNER can delete
    let userRole = null;
    if (findDocument.ownerId === req.user.userID) {
      userRole = Role.OWNER;
    } else if (findDocument.collaborators.length > 0) {
      userRole = findDocument.collaborators[0].role;
    }

    if (userRole !== Role.OWNER) {
      return res.status(403).json({
        message: "Access Denied: Only the owner can delete this document.",
      });
    }

    // Before deleting the document, delete all associated collaborations
    await prisma.collaboration.deleteMany({
      where: { documentId: id },
    });

    const deletedDocument = await prisma.document.delete({ where: { id } });

    res.status(204).json({
      message: "Deleted document successfully",
      deleted: deletedDocument,
    }); // 204 No Content for successful deletion. So no content will show
  } catch (error) {
    res.status(500).json({
      message: "Error occured while deleting document",
      error: error.message,
    });
  }
};
