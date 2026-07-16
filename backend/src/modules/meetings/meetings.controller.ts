import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getIO } from "../../realtime/socket";
import { parseBody } from "../../shared/utils";
import * as meetingsService from "./meetings.service";

const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  hourlyRate: z.number().positive("Hourly rate must be a positive number").optional(),
  priceCents: z.number().int().nonnegative("Price must be zero or positive").optional(),
});

export async function createMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, hourlyRate, priceCents } = parseBody(createMeetingSchema, req.body ?? {});
    const meeting = await meetingsService.createMeeting(req.user!.id, title, hourlyRate, priceCents);
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
    getIO().to(req.params.meetingCode).emit("meeting-ended", { totalCost: result.totalCost });
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
