import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getIO } from "../../realtime/socket";
import { parseBody } from "../../shared/utils";
import * as meetingsService from "./meetings.service";

const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
});

export async function createMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { title } = parseBody(createMeetingSchema, req.body ?? {});
    const meeting = await meetingsService.createMeeting(req.user!.id, title);
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function getMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const meeting = await meetingsService.getMeetingByCode(req.params.meetingCode);
    res.status(200).json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function joinMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await meetingsService.joinMeeting(req.params.meetingCode, req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function leaveMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await meetingsService.leaveMeeting(req.params.meetingCode, req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function endMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await meetingsService.endMeeting(req.params.meetingCode, req.user!.id);
    getIO().to(req.params.meetingCode).emit("meeting-ended");
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getParticipantsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await meetingsService.getParticipants(req.params.meetingCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
