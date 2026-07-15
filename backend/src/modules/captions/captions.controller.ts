import { Request, Response } from "express";
import { pool } from "../../config/db";
import { getIO } from "../../realtime/socket";
import * as captionsService from "./captions.service";

export async function captionChunkHandler(req: Request, res: Response) {
  try {
    const meetingCode = req.params.meetingCode;
    const userId = req.user!.id;
    const audioBuffer = req.body as Buffer;

    if (!audioBuffer || audioBuffer.length === 0) {
      res.status(204).end();
      return;
    }

    const text = await captionsService.transcribeChunk(audioBuffer);
    if (!text.trim()) {
      res.status(204).end();
      return;
    }

    const { rows } = await pool.query<{ name: string }>("SELECT name FROM users WHERE id = $1", [userId]);
    const name = rows[0]?.name ?? "Guest";

    const targetLanguages = captionsService.getDistinctLanguages(meetingCode);
    const translations = await captionsService.translate(text, targetLanguages);

    getIO().to(meetingCode).emit("caption", {
      userId,
      name,
      sourceText: text,
      translations,
      timestamp: new Date().toISOString(),
    });

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`Caption chunk processing failed for meeting ${req.params.meetingCode}:`, err);
    res.status(200).json({ received: true });
  }
}
