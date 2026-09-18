import { NextFunction, Request, Response } from "express";
import * as transcriptionService from "./transcription.service";
import * as meetingsService from "../meetings/meetings.service";
import { AppError } from "../../shared/errors";

export async function getRecapHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const guestId = typeof req.query.guestId === "string" ? req.query.guestId : null;
    const allowed = await meetingsService.canAccessMeetingHistory(
      req.params.meetingCode,
      req.user?.id ?? null,
      guestId,
    );
    if (!allowed) throw new AppError(403, "You weren't a participant in this meeting");
    const result = await transcriptionService.getRecap(req.params.meetingCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
