import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { pool } from "../../config/db";
import { env } from "../../config/env";
import { AppError } from "../../shared/errors";

const s3Client = new S3Client({
  region: env.s3Region,
  endpoint: env.s3Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey,
  },
});

interface AsyncVideoRow {
  id: string;
  title: string;
  file_url: string;
  duration: number | null;
  created_at: string;
}

function toAsyncVideo(row: AsyncVideoRow) {
  return {
    id: row.id,
    title: row.title,
    fileUrl: row.file_url,
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
  const key = `async-videos/${ownerId}-${Date.now()}.webm`;
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
  return { videos: rows.map(toAsyncVideo) };
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
