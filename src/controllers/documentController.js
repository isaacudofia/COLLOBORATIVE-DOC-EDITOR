import { PrismaClient } from "../../generated/prisma/client.js";
const prisma = new PrismaClient();

//CONTROLLER TO GET ALL DOCUMENTS
export const getAllDocuments = async (req, res) => {
  try {
    const documents = await prisma.document.findMany({
      where: { ownerId: req.user.userID }, // Only fetch documents owned by the current user
      orderBy: { updatedAt: "desc" }, // Order by most recently updated (descendind order)
    });

    if (!documents || documents.length === 0)
      return res
        .status(404)
        .json({ message: "No document created by user..." });

    res.status(200).json({
      message: "Get all documents successfully owned by the current user",
      data: documents,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error occured while fetching all documents" });
  }
};

//CONTROLLER TO A SPECIFIC DOCUMENT
export const getDocument = async (req, res) => {
  const { id } = req.params;
  try {
    //CHECKING IF DOCUMENT BY THE IDENTIFIER EXIST IN THE DATABASE
    const findDocument = await prisma.document.findUnique({
      where: { id },
      include: { owner: { select: { id: true, name: true, email: true } } },
    }); // Optionally include owner details

    if (!findDocument)
      return res
        .status(400)
        .json({ message: "No document by such identifier" });

    // Authorization check: Only the owner can access their document for now
    // (We'll expand on this for collaborators on Day 5)
    if (findDocument.ownerId !== req.user.userID)
      return res
        .status(404)
        .json({ message: "Access Denied: You do not own this document." });

    res.status(203).json({
      message: "Updated document successfully",
      data: findDocument,
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
  try {
    //CHECKING IF DOCUMENT BY THE IDENTIFIER EXIST IN THE DATABASE
    const findDocument = await prisma.document.findUnique({ where: { id } });
    if (!findDocument)
      return res
        .status(400)
        .json({ message: "No such document by identifier for updating" });

    // Authorization check: Only the owner can access their document for now
    // (We'll expand on this for collaborators on Day 5)
    if (findDocument.ownerId !== req.user.userID) {
      return res.status(403).json({
        message:
          "Access Denied: You do not own this document you want to update.",
      });
    }

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        title: title || document.title, // Update title if provided, else keep existing,
        content: content !== undefined ? content : document.content, // Update content if provided, else keep existing,
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
    const findDocument = await prisma.document.findUnique({ where: { id } });
    if (!findDocument)
      return res
        .status(400)
        .json({ message: "No such document by identifier for deleting" });

    // Authorization check: Only the owner can delete
    if (findDocument.ownerId !== req.user.userID) {
      return res.status(403).json({
        message:
          "Access Denied: You do not own this document you want to delete",
      });
    }

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
