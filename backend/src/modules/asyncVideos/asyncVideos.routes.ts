import express, { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import * as asyncVideosController from "./asyncVideos.controller";

const router = Router();

router.post(
  "/",
  requireAuth,
  express.raw({ type: "video/webm", limit: "500mb" }),
  asyncVideosController.uploadVideoHandler,
);
router.get("/mine", requireAuth, asyncVideosController.listMyVideosHandler);
router.get("/:videoId", asyncVideosController.getVideoHandler);

export default router;
