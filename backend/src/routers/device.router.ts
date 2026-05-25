import { Router } from "express";
import {
  createDeviceHandler,
  deleteDeviceHandler,
  getDeviceHandler,
  getDeviceStatsHandler,
  listDevicesHandler,
  sendCommandHandler,
  updateDeviceHandler,
} from "../controllers/device.controller";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.get("/stats", authMiddleware, getDeviceStatsHandler);
router.post("/", authMiddleware, createDeviceHandler);
router.get("/", authMiddleware, listDevicesHandler);
router.get("/:id", authMiddleware, getDeviceHandler);
router.patch("/:id", authMiddleware, updateDeviceHandler);
router.post("/:id/command", authMiddleware, sendCommandHandler);
router.delete("/:id", authMiddleware, deleteDeviceHandler);

export default router;
