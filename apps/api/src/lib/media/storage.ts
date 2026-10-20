/**
 * Object storage for community media.
 *
 * Storage-only by decision: R2 holds progressive MP4/M4A files, and every
 * playback URL is produced by `resolvePlayback`. If a managed video service
 * is added later, it slots in behind that one function and
 * `MediaAsset.playbackId`, rather than through every route that plays media.
 */

import type { Clock } from "../../modules/community/clock.js";
import { presignUrl } from "./sigv4.js";

export interface PresignedRequest {
  url: string;
  expiresAt: Date;
}

export interface MediaStorage {
  presignUpload(key: string, expiresSeconds: number): PresignedRequest;
  presignDownload(key: string, expiresSeconds: number): PresignedRequest;
  /**
   * Size of a stored object, or null if it isn't there.
   *
   * `bytes` is null when the store answered but wouldn't say how big the
   * object is. Callers must treat that as "unverified" rather than as zero —
   * a size that silently reads 0 turns a size limit into no limit at all.
   */
  head(key: string): Promise<{ bytes: number | null } | null>;
  /** Idempotent: deleting something already gone succeeds. */
  delete(key: string): Promise<void>;
}

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export class R2MediaStorage implements MediaStorage {
  private readonly host: string;

  constructor(
    private readonly config: R2Config,
    private readonly clock: Clock,
    private readonly fetchImpl: typeof fetch = fetch
  ) {
    this.host = `${config.accountId}.r2.cloudflarestorage.com`;
  }

  private sign(method: "GET" | "PUT" | "HEAD" | "DELETE", key: string, expiresSeconds: number): PresignedRequest {
    const now = this.clock.now();
    return {
      url: presignUrl({
        method,
        host: this.host,
        path: `/${this.config.bucket}/${key}`,
        region: "auto",
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
        expiresSeconds,
        now,
      }),
      expiresAt: new Date(now.getTime() + expiresSeconds * 1000),
    };
  }

  presignUpload(key: string, expiresSeconds: number): PresignedRequest {
    return this.sign("PUT", key, expiresSeconds);
  }

  presignDownload(key: string, expiresSeconds: number): PresignedRequest {
    return this.sign("GET", key, expiresSeconds);
  }

  async head(key: string): Promise<{ bytes: number | null } | null> {
    const res = await this.fetchImpl(this.sign("HEAD", key, 60).url, {
      method: "HEAD",
      // Cloudflare compresses responses for compressible content types, and a
      // compressed response carries no Content-Length (and only a weak ETag).
      // We want the stored object's real size, so ask for it uncompressed.
      headers: { "Accept-Encoding": "identity" },
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Storage HEAD failed with ${res.status}`);

    const length = res.headers.get("content-length");
    return { bytes: length === null ? null : Number(length) };
  }

  async delete(key: string): Promise<void> {
    const res = await this.fetchImpl(this.sign("DELETE", key, 60).url, { method: "DELETE" });
    if (!res.ok && res.status !== 404) throw new Error(`Storage DELETE failed with ${res.status}`);
  }
}

/**
 * R2 from the environment, or null when it isn't configured. Media routes
 * then answer a clear 503 rather than the server refusing to boot — the rest
 * of Kinextion shouldn't go down because video storage isn't set up yet.
 */
export function r2StorageFromEnv(clock: Clock, env: NodeJS.ProcessEnv = process.env): MediaStorage | null {
  const accountId = env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = env.R2_BUCKET_NAME?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return new R2MediaStorage({ accountId, accessKeyId, secretAccessKey, bucket }, clock);
}
