import { Router } from "express";
import { requireAuth } from "../auth/auth.middleware";
import * as meetingsController from "./meetings.controller";

const router = Router();

router.post("/", requireAuth, meetingsController.createMeetingHandler);
router.get("/:meetingCode", meetingsController.getMeetingHandler);
router.post("/:meetingCode/join", requireAuth, meetingsController.joinMeetingHandler);
router.post("/:meetingCode/leave", requireAuth, meetingsController.leaveMeetingHandler);
router.post("/:meetingCode/end", requireAuth, meetingsController.endMeetingHandler);
router.get("/:meetingCode/participants", meetingsController.getParticipantsHandler);

export default router;
