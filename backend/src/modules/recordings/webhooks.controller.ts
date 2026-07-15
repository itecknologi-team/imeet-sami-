import { Request, Response } from "express";
import { EgressStatus, WebhookReceiver } from "livekit-server-sdk";
import { env } from "../../config/env";
import * as recordingsService from "./recordings.service";
import * as transcriptionService from "../transcription/transcription.service";

const webhookReceiver = new WebhookReceiver(env.livekitApiKey, env.livekitApiSecret);

// Egress reports the file location with its own assumed scheme/host, which
// doesn't necessarily match the S3 endpoint we actually configured (e.g. it
// defaults to https even for a plain-http local MinIO). Rewrite it to match.
function normalizeFileUrl(rawUrl: string): string {
  try {
    const configured = new URL(env.s3Endpoint);
    const actual = new URL(rawUrl);
    actual.protocol = configured.protocol;
    actual.host = configured.host;
    return actual.toString();
  } catch {
    return rawUrl;
  }
}

export async function livekitWebhookHandler(req: Request, res: Response) {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : "";
    const event = await webhookReceiver.receive(rawBody, req.headers.authorization);

    if (event.event === "egress_ended" && event.egressInfo) {
      const info = event.egressInfo;
      const fileResult = info.fileResults[0];
      const completed = info.status === EgressStatus.EGRESS_COMPLETE;
      const recording = await recordingsService.completeRecording(
        info.egressId,
        completed ? "completed" : "failed",
        fileResult ? normalizeFileUrl(fileResult.location) : null,
        fileResult ? Number(fileResult.duration / 1_000_000_000n) : null,
      );

      if (completed && recording) {
        // Fire-and-forget: transcription can take a while and must not
        // delay or fail this webhook response (LiveKit retries on error).
        transcriptionService.transcribeRecording(recording.id).catch((err) => {
          console.error(`Failed to kick off transcription for recording ${recording.id}:`, err);
        });
      }
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error("LiveKit webhook verification failed", err);
    res.status(400).json({ error: "Invalid webhook payload" });
  }
}
