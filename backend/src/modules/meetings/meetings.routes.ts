import express, { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import * as meetingsController from "./meetings.controller";
import * as recordingsController from "../recordings/recordings.controller";
import * as transcriptionController from "../transcription/transcription.controller";
import * as captionsController from "../captions/captions.controller";

const router = Router();

router.post("/", requireAuth, meetingsController.createMeetingHandler);
router.get("/:meetingCode", meetingsController.getMeetingHandler);
router.post("/:meetingCode/join", requireAuth, meetingsController.joinMeetingHandler);
router.post("/:meetingCode/leave", requireAuth, meetingsController.leaveMeetingHandler);
router.post("/:meetingCode/end", requireAuth, meetingsController.endMeetingHandler);
router.get("/:meetingCode/participants", meetingsController.getParticipantsHandler);
router.post("/:meetingCode/recording/start", requireAuth, recordingsController.startRecordingHandler);
router.post("/:meetingCode/recording/stop", requireAuth, recordingsController.stopRecordingHandler);
router.get("/:meetingCode/recordings", recordingsController.listRecordingsHandler);
router.delete(
  "/:meetingCode/recordings/:recordingId",
  requireAuth,
  recordingsController.deleteRecordingHandler,
);
router.get("/:meetingCode/recap", transcriptionController.getRecapHandler);
router.post(
  "/:meetingCode/caption-chunk",
  requireAuth,
  express.raw({ type: "audio/webm", limit: "10mb" }),
  captionsController.captionChunkHandler,
);

export default router;
