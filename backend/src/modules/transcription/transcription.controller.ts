import { NextFunction, Request, Response } from "express";
import * as transcriptionService from "./transcription.service";

export async function getRecapHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await transcriptionService.getRecap(req.params.meetingCode);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
