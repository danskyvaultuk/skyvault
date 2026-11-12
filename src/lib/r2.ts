import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

// AWS S3 client — credentials come from environment variables set by Terraform output
export const r2 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.AWS_S3_BUCKET_NAME!;

export function generateS3Key(surveyId: string, filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "jpg";
  return `surveys/${surveyId}/images/${randomUUID()}.${ext}`;
}

export function generatePdfKey(surveyId: string): string {
  return `surveys/${surveyId}/report.pdf`;
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 900
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

export async function getPresignedReadUrl(
  key: string,
  expiresInSeconds = 3600
): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(r2, command, { expiresIn: expiresInSeconds });
}

/** Reads a stored object into memory, e.g. a report PDF to attach to an email (BL-022). */
export async function downloadBuffer(key: string): Promise<Buffer> {
  const result = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  if (!result.Body) throw new Error(`Stored object is empty: ${key}`);
  return Buffer.from(await result.Body.transformToByteArray());
}

export async function uploadBuffer(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}
