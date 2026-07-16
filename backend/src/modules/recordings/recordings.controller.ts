import { NextFunction, Request, Response } from "express";
import * as recordingsService from "./recordings.service";

export async function startRecordingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recordingsService.startRecording(req.params.meetingCode, req.user!.id);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function stopRecordingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recordingsService.stopRecording(req.params.meetingCode, req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function listRecordingsHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recordingsService.listRecordings(req.params.meetingCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function deleteRecordingHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await recordingsService.deleteRecording(
      req.params.meetingCode,
      req.params.recordingId,
      req.user!.id,
    );
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
