import express, { Router } from "express";
import { optionalAuth, requireAuth } from "../auth/auth.middleware";
import * as meetingsController from "./meetings.controller";
import * as recordingsController from "../recordings/recordings.controller";
import * as transcriptionController from "../transcription/transcription.controller";
import * as captionsController from "../captions/captions.controller";
import * as paymentsController from "../payments/payments.controller";

const router = Router();

// Instant meetings can be created/joined/left as a guest (no account) — these
// use optionalAuth so signed-in users still get their real identity attached.
router.post("/", optionalAuth, meetingsController.createMeetingHandler);
// Must be registered before the bare "/:meetingCode" route below, or Express
// would match "mine" as a meeting code instead of routing here.
router.get("/mine", requireAuth, meetingsController.listMyMeetingsHandler);
router.get("/:meetingCode", meetingsController.getMeetingHandler);
router.post("/:meetingCode/join", optionalAuth, meetingsController.joinMeetingHandler);
router.post("/:meetingCode/leave", optionalAuth, meetingsController.leaveMeetingHandler);
router.post("/:meetingCode/end", optionalAuth, meetingsController.endMeetingHandler);
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
router.post("/:meetingCode/checkout", requireAuth, paymentsController.createCheckoutSessionHandler);
router.post("/:meetingCode/confirm-payment", requireAuth, paymentsController.confirmPaymentHandler);

export default router;
