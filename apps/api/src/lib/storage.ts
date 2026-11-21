import { S3Client, PutObjectCommand, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const BUCKET = process.env.S3_BUCKET ?? "assets";

function isS3Configured(): boolean {
  return Boolean(process.env.AWS_ENDPOINT_URL_S3);
}

function getS3Client(): S3Client {
  return new S3Client({ forcePathStyle: true });
}

/**
 * Returns the S3 object key for a ticket PDF given a PNR.
 * Exported so tests can assert the correct key without duplicating the pattern.
 */
export function ticketKey(pnr: string): string {
  return `tickets/${pnr}.pdf`;
}

/**
 * Ensures the S3 bucket exists. No-op if S3 is not configured.
 */
export async function ensureBucket(): Promise<void> {
  if (!isS3Configured()) return;
  const s3 = getS3Client();
  try {
    await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  } catch {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
  }
}

/**
 * Uploads an object to S3. Returns the key on success, null if S3 is not configured.
 */
export async function putObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<string | null> {
  if (!isS3Configured()) return null;
  const s3 = getS3Client();
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
  return key;
}

/**
 * Generates a presigned GET URL for an S3 object.
 * Returns null if S3 is not configured or key is null/empty.
 */
export async function presignGet(
  key: string | null | undefined,
  expiresIn = 3600
): Promise<string | null> {
  if (!isS3Configured() || !key) return null;
  const s3 = getS3Client();
  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, cmd, { expiresIn });
}
