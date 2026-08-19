import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env";

export const s3Client = new S3Client({
  region: env.s3Region,
  endpoint: env.s3Endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.s3AccessKey,
    secretAccessKey: env.s3SecretKey,
  },
});

// Stored file_url values are bucket-in-path URLs (e.g.
// http://host:9000/recordings/foo.mp4) — the S3 key is the path with the
// bucket prefix stripped.
export function extractS3Key(fileUrl: string): string | null {
  try {
    const pathname = new URL(fileUrl).pathname;
    const prefix = `/${env.s3Bucket}/`;
    if (!pathname.startsWith(prefix)) return null;
    return decodeURIComponent(pathname.slice(prefix.length));
  } catch {
    return null;
  }
}

// Recordings and async videos are meeting content — often the most sensitive
// thing this app holds. The local dev stack marks the bucket anonymous-read so
// a plain <video src> works out of the box, but doing that in production means
// every object is downloadable by anyone who learns (or enumerates) its URL,
// with no login and no expiry. In production the bucket stays private and the
// browser gets a short-lived presigned URL instead.
export async function toDownloadUrl(fileUrl: string | null): Promise<string | null> {
  if (!fileUrl) return null;
  if (env.s3PublicRead) return fileUrl;

  const key = extractS3Key(fileUrl);
  if (!key) return null;

  try {
    return await getSignedUrl(
      s3Client,
      new GetObjectCommand({ Bucket: env.s3Bucket, Key: key }),
      { expiresIn: env.s3PresignTtlSeconds },
    );
  } catch (err) {
    console.error(`Failed to presign ${key}:`, err);
    return null;
  }
}

export async function deleteS3Object(fileUrl: string | null): Promise<void> {
  if (!fileUrl) return;
  const key = extractS3Key(fileUrl);
  if (!key) return;
  await s3Client.send(new DeleteObjectCommand({ Bucket: env.s3Bucket, Key: key }));
}
