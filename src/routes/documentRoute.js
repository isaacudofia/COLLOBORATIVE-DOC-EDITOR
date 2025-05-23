//DOCUMENT ROUTES
import express from "express";
import authMiddleware from "../middlewares/protected.js";
import {
  deleteDocument,
  getAllDocuments,
  getDocument,
  postDocument,
  updateDocument,
} from "../controllers/documentController.js";
const router = express.Router();

router.get("/documents", authMiddleware, getAllDocuments);
router.get("/document/:id", authMiddleware, getDocument);
router.post("/document/:id", authMiddleware, postDocument);
router.put("/document/:id", authMiddleware, updateDocument);
router.delete("/document/:id", authMiddleware, deleteDocument);

export default router;
