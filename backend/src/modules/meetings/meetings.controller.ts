import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { getIO } from "../../realtime/socket";
import { AppError } from "../../shared/errors";
import { parseBody } from "../../shared/utils";
import * as meetingsService from "./meetings.service";

const createMeetingSchema = z.object({
  title: z.string().min(1, "Title is required").optional(),
  hourlyRate: z.number().positive("Hourly rate must be a positive number").optional(),
  priceCents: z.number().int().nonnegative("Price must be zero or positive").optional(),
  passcode: z.string().min(4, "Passcode must be at least 4 characters").optional(),
  guestId: z.string().min(1).max(64).optional(),
  guestName: z.string().min(1, "Name is required").max(100).optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().positive().optional(),
});

const joinMeetingSchema = z.object({
  guestId: z.string().min(1).max(64).optional(),
  guestName: z.string().min(1, "Name is required").max(100).optional(),
  passcode: z.string().optional(),
});

const guestIdOnlySchema = z.object({
  guestId: z.string().min(1).max(64).optional(),
});

export async function createMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { title, hourlyRate, priceCents, passcode, guestId, guestName, scheduledAt, durationMinutes } = parseBody(
      createMeetingSchema,
      req.body ?? {},
    );
    if (!req.user && (!guestId || !guestName?.trim())) {
      throw new AppError(400, "Enter your name to start a meeting");
    }
    const meeting = await meetingsService.createMeeting(
      req.user?.id ?? null,
      req.user ? null : guestId!,
      req.user ? undefined : guestName,
      title,
      hourlyRate,
      priceCents,
      passcode,
      scheduledAt,
      durationMinutes,
    );
    res.status(201).json(meeting);
  } catch (err) {
    next(err);
  }
}

export async function listMyMeetingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await meetingsService.listMyMeetings(req.user!.id);
    res.status(200).json(result);
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
    const { guestId, guestName, passcode } = parseBody(joinMeetingSchema, req.body ?? {});
    if (!req.user && (!guestId || !guestName?.trim())) {
      throw new AppError(400, "Enter your name to join");
    }
    const result = await meetingsService.joinMeeting(
      req.params.meetingCode,
      req.user?.id ?? null,
      req.user ? null : guestId,
      req.user ? undefined : guestName,
      passcode,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function leaveMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { guestId } = parseBody(guestIdOnlySchema, req.body ?? {});
    const result = await meetingsService.leaveMeeting(
      req.params.meetingCode,
      req.user?.id ?? null,
      req.user ? null : guestId,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function endMeetingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const { guestId } = parseBody(guestIdOnlySchema, req.body ?? {});
    const result = await meetingsService.endMeeting(
      req.params.meetingCode,
      req.user?.id ?? null,
      req.user ? null : guestId,
    );
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
