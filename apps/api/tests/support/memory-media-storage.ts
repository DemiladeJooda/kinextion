import type { MediaStorage, PresignedRequest } from "../../src/lib/media/storage.js";

/**
 * Object storage in a Map. Uploads are simulated with `put`; `deleted`
 * records every key a test can assert was really removed.
 */
export class MemoryMediaStorage implements MediaStorage {
  objects = new Map<string, number>();
  deleted: string[] = [];
  failDeletes = false;

  constructor(private readonly now: () => Date) {}

  put(key: string, bytes: number): void {
    this.objects.set(key, bytes);
  }

  private presign(verb: string, key: string, expiresSeconds: number): PresignedRequest {
    const expiresAt = new Date(this.now().getTime() + expiresSeconds * 1000);
    return { url: `https://storage.test/${verb}/${key}?expires=${expiresAt.toISOString()}`, expiresAt };
  }

  presignUpload(key: string, expiresSeconds: number) {
    return this.presign("put", key, expiresSeconds);
  }

  presignDownload(key: string, expiresSeconds: number) {
    return this.presign("get", key, expiresSeconds);
  }

  async head(key: string) {
    const bytes = this.objects.get(key);
    return bytes === undefined ? null : { bytes };
  }

  async delete(key: string) {
    if (this.failDeletes) throw new Error("storage unavailable");
    this.objects.delete(key);
    this.deleted.push(key);
  }
}
