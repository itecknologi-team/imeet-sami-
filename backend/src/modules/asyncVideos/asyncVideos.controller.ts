import { NextFunction, Request, Response } from "express";
import { AppError } from "../../shared/errors";
import * as asyncVideosService from "./asyncVideos.service";

export async function uploadVideoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const videoBuffer = req.body as Buffer;
    if (!videoBuffer || videoBuffer.length === 0) {
      throw new AppError(400, "No video data received");
    }

    const title = typeof req.query.title === "string" && req.query.title.trim() ? req.query.title.trim() : "Untitled";
    const durationRaw = typeof req.query.duration === "string" ? Number(req.query.duration) : NaN;
    const duration = Number.isFinite(durationRaw) ? Math.round(durationRaw) : null;

    const video = await asyncVideosService.uploadVideo(req.user!.id, title, videoBuffer, duration);
    res.status(201).json(video);
  } catch (err) {
    next(err);
  }
}

export async function listMyVideosHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await asyncVideosService.listMyVideos(req.user!.id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getVideoHandler(req: Request, res: Response, next: NextFunction) {
  try {
    const video = await asyncVideosService.getVideo(req.params.videoId);
    res.status(200).json(video);
  } catch (err) {
    next(err);
  }
}
