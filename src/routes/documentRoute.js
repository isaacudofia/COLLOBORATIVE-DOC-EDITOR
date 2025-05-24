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

router.get("/", authMiddleware, getAllDocuments);
router.get("/:id", authMiddleware, getDocument);
router.post("/", authMiddleware, postDocument);
router.put("/:id", authMiddleware, updateDocument);
router.delete("/:id", authMiddleware, deleteDocument);

export default router;
