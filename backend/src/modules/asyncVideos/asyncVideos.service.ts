import crypto from "crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";
import { s3Client, toDownloadUrl } from "../../shared/storage";

interface AsyncVideoRow {
  id: string;
  title: string;
  file_url: string;
  duration: number | null;
  created_at: string;
}

async function toAsyncVideo(row: AsyncVideoRow) {
  return {
    id: row.id,
    title: row.title,
    // Presigned and short-lived in production — see shared/storage.ts.
    fileUrl: await toDownloadUrl(row.file_url),
    duration: row.duration,
    createdAt: row.created_at,
  };
}

export async function uploadVideo(
  ownerId: string,
  title: string,
  videoBuffer: Buffer,
  durationSeconds: number | null,
) {
  // A random suffix rather than a timestamp: `${ownerId}-${Date.now()}` is
  // guessable, which matters because the object key is the only thing standing
  // between a video and anyone who can reach the bucket.
  const key = `async-videos/${ownerId}-${crypto.randomBytes(16).toString("hex")}.webm`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.s3Bucket,
      Key: key,
      Body: videoBuffer,
      ContentType: "video/webm",
    }),
  );
  const fileUrl = `${env.s3Endpoint}/${env.s3Bucket}/${key}`;

  const { rows } = await pool.query<AsyncVideoRow>(
    `INSERT INTO async_videos (owner_id, title, file_url, duration)
     VALUES ($1, $2, $3, $4)
     RETURNING id, title, file_url, duration, created_at`,
    [ownerId, title, fileUrl, durationSeconds],
  );
  return toAsyncVideo(rows[0]);
}

export async function listMyVideos(ownerId: string) {
  const { rows } = await pool.query<AsyncVideoRow>(
    `SELECT id, title, file_url, duration, created_at
     FROM async_videos
     WHERE owner_id = $1
     ORDER BY created_at DESC`,
    [ownerId],
  );
  return { videos: await Promise.all(rows.map(toAsyncVideo)) };
}

export async function getVideo(videoId: string) {
  const { rows } = await pool.query<AsyncVideoRow>(
    `SELECT id, title, file_url, duration, created_at FROM async_videos WHERE id = $1`,
    [videoId],
  );
  const row = rows[0];
  if (!row) {
    throw new AppError(404, "Video not found");
  }
  return toAsyncVideo(row);
}
