import express from "express";

import {
  addCollaborator,
  removeCollaborator,
  getDocumentCollaborators,
} from "../controllers/collaborationController.js";

import authenticateToken from "../middlewares/protected.js";

const router = express.Router();

// Routes are nested under /api/documents/:documentId/collaborators
router.post("/:documentId/collaborators", authenticateToken, addCollaborator);
router.delete(
  "/:documentId/collaborators/:collaboratorId",
  authenticateToken,
  removeCollaborator
);
router.get(
  "/:documentId/collaborators",
  authenticateToken,
  getDocumentCollaborators
);

export default router;
