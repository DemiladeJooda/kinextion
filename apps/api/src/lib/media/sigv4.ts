/**
 * AWS Signature Version 4, query-string presigning.
 *
 * Cloudflare R2 speaks the S3 API, and a presigned URL is the whole of what
 * the media pipeline needs: the client PUTs straight to storage, plays back
 * straight from it, and the API signs. Hand-rolled on node:crypto rather than
 * pulling in the AWS SDK for one function — and pinned to AWS's own published
 * example in tests/media-storage.test.ts, so a mistake here fails loudly.
 */

import { createHash, createHmac } from "node:crypto";

export interface PresignInput {
  method: "GET" | "PUT" | "HEAD" | "DELETE";
  /** e.g. "abc123.r2.cloudflarestorage.com" */
  host: string;
  /** Already includes the bucket for path-style hosts, e.g. "/kinextion/media/x.mp4". Unencoded. */
  path: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  expiresSeconds: number;
  now: Date;
  service?: string;
}

/** RFC 3986 encoding, as SigV4 requires — stricter than encodeURIComponent. */
export function uriEncode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
}

const hmac = (key: Buffer | string, data: string) => createHmac("sha256", key).update(data, "utf8").digest();
const sha256Hex = (data: string) => createHash("sha256").update(data, "utf8").digest("hex");

/** "20130524T000000Z" */
export function amzDate(now: Date): string {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function presignUrl(input: PresignInput): string {
  const service = input.service ?? "s3";
  const timestamp = amzDate(input.now);
  const date = timestamp.slice(0, 8);
  const scope = `${date}/${input.region}/${service}/aws4_request`;

  const canonicalUri = input.path
    .split("/")
    .map((segment) => uriEncode(segment))
    .join("/");

  const query: Record<string, string> = {
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${input.accessKeyId}/${scope}`,
    "X-Amz-Date": timestamp,
    "X-Amz-Expires": String(input.expiresSeconds),
    "X-Amz-SignedHeaders": "host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${uriEncode(k)}=${uriEncode(query[k])}`)
    .join("&");

  const canonicalRequest = [
    input.method,
    canonicalUri,
    canonicalQuery,
    `host:${input.host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const stringToSign = ["AWS4-HMAC-SHA256", timestamp, scope, sha256Hex(canonicalRequest)].join("\n");

  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${input.secretAccessKey}`, date), input.region), service),
    "aws4_request"
  );
  const signature = createHmac("sha256", signingKey).update(stringToSign, "utf8").digest("hex");

  return `https://${input.host}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}
