import { describe, expect, it, vi } from "vitest";
import { amzDate, presignUrl, uriEncode } from "../src/lib/media/sigv4.js";
import { R2MediaStorage, r2StorageFromEnv } from "../src/lib/media/storage.js";
import { ManualClock } from "../src/modules/community/clock.js";

describe("SigV4 presigning", () => {
  it("matches AWS's published presigned-URL example exactly", () => {
    // From AWS's "Authenticating Requests: Using Query Parameters" documentation.
    const url = presignUrl({
      method: "GET",
      host: "examplebucket.s3.amazonaws.com",
      path: "/test.txt",
      region: "us-east-1",
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      expiresSeconds: 86400,
      now: new Date("2013-05-24T00:00:00Z"),
    });
    expect(url).toBe(
      "https://examplebucket.s3.amazonaws.com/test.txt" +
        "?X-Amz-Algorithm=AWS4-HMAC-SHA256" +
        "&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request" +
        "&X-Amz-Date=20130524T000000Z" +
        "&X-Amz-Expires=86400" +
        "&X-Amz-SignedHeaders=host" +
        "&X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
    );
  });

  it("formats the timestamp the way SigV4 expects", () => {
    expect(amzDate(new Date("2026-09-14T17:05:09.123Z"))).toBe("20260914T170509Z");
  });

  it("encodes to RFC 3986, stricter than encodeURIComponent", () => {
    expect(uriEncode("a b!'()*~")).toBe("a%20b%21%27%28%29%2A~");
  });

  it("changes the signature with the method, so a GET URL can't be used to upload", () => {
    const base = {
      host: "acct.r2.cloudflarestorage.com",
      path: "/kinextion/media/a.mp4",
      region: "auto",
      accessKeyId: "id",
      secretAccessKey: "secret",
      expiresSeconds: 60,
      now: new Date("2026-09-14T00:00:00Z"),
    };
    const sig = (u: string) => new URL(u).searchParams.get("X-Amz-Signature");
    expect(sig(presignUrl({ ...base, method: "GET" }))).not.toBe(sig(presignUrl({ ...base, method: "PUT" })));
  });
});

describe("R2MediaStorage", () => {
  const config = { accountId: "acct", accessKeyId: "id", secretAccessKey: "secret", bucket: "kinextion" };
  const clock = new ManualClock("2026-09-14T17:00:00Z");

  it("presigns path-style URLs against the account's R2 host", () => {
    const storage = new R2MediaStorage(config, clock);
    const { url, expiresAt } = storage.presignUpload("media/2026/09/abc.mp4", 3600);
    const parsed = new URL(url);
    expect(parsed.host).toBe("acct.r2.cloudflarestorage.com");
    expect(parsed.pathname).toBe("/kinextion/media/2026/09/abc.mp4");
    expect(parsed.searchParams.get("X-Amz-Credential")).toBe("id/20260914/auto/s3/aws4_request");
    expect(expiresAt.toISOString()).toBe("2026-09-14T18:00:00.000Z");
  });

  it("reads an object's size, and treats a missing object as null", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 200, headers: { "content-length": "1234" } }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }));
    const storage = new R2MediaStorage(config, clock, fetchImpl);
    expect(await storage.head("present.mp4")).toEqual({ bytes: 1234 });
    expect(await storage.head("missing.mp4")).toBeNull();
  });

  /**
   * Cloudflare gzips responses for compressible content types, and a
   * compressed response has no Content-Length — which once made head() report
   * every such object as 0 bytes, quietly defeating the upload size limit.
   */
  it("asks for the object uncompressed, so the size is really the size", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200, headers: { "content-length": "51" } }));
    await new R2MediaStorage(config, clock, fetchImpl).head("note.txt");
    expect(fetchImpl.mock.calls[0][1]).toEqual({
      method: "HEAD",
      headers: { "Accept-Encoding": "identity" },
    });
  });

  it("reports an unmeasurable object as unknown, never as empty", async () => {
    // What a compressed response looks like: 200, but no content-length.
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 200, headers: { "content-encoding": "gzip" } }));
    expect(await new R2MediaStorage(config, clock, fetchImpl).head("note.txt")).toEqual({ bytes: null });
  });

  it("deletes idempotently, but surfaces a real failure", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response(null, { status: 500 }));
    const storage = new R2MediaStorage(config, clock, fetchImpl);
    await expect(storage.delete("a.mp4")).resolves.toBeUndefined();
    await expect(storage.delete("a.mp4")).resolves.toBeUndefined();
    await expect(storage.delete("a.mp4")).rejects.toThrow(/500/);
  });

  it("is null until every R2 variable is set, so the API still boots without it", () => {
    expect(r2StorageFromEnv(clock, {})).toBeNull();
    expect(r2StorageFromEnv(clock, { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c" })).toBeNull();
    expect(
      r2StorageFromEnv(clock, { R2_ACCOUNT_ID: "a", R2_ACCESS_KEY_ID: "b", R2_SECRET_ACCESS_KEY: "c", R2_BUCKET_NAME: "d" })
    ).toBeInstanceOf(R2MediaStorage);
  });
});
