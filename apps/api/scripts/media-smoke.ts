/**
 * Prove the media pipeline works against a real bucket.
 *
 *   pnpm --filter @kinextion/api media:smoke
 *
 * Round-trips one small file the way the app does — presign a PUT, upload,
 * check the size, fetch it back through a signed GET, delete it, confirm it's
 * gone. Everything else about media is unit-tested; this is the part only real
 * credentials can answer, so it isn't part of `pnpm test`.
 *
 * Writes and deletes exactly one object under `smoke-test/`.
 */

import { r2StorageFromEnv } from "../src/lib/media/storage.js";
import { systemClock } from "../src/modules/community/clock.js";

const BODY = `kinextion media smoke test ${new Date().toISOString()}`;

async function main() {
  const storage = r2StorageFromEnv(systemClock);
  if (!storage) {
    console.error(
      "R2 isn't configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and\n" +
        "R2_BUCKET_NAME in .env, then run this again."
    );
    process.exitCode = 1;
    return;
  }

  const key = `smoke-test/${Date.now()}.txt`;
  const step = (name: string, detail = "") => console.log(`  ✓ ${name}${detail ? ` — ${detail}` : ""}`);

  console.log(`Round-tripping ${key}\n`);

  const upload = storage.presignUpload(key, 300);
  const put = await fetch(upload.url, {
    method: "PUT",
    body: BODY,
    headers: { "Content-Type": "text/plain" },
  });
  if (!put.ok) {
    throw new Error(
      `Upload failed with ${put.status}. ${
        put.status === 403
          ? "That usually means the access key, secret or account id is wrong, or the token lacks write access to this bucket."
          : put.status === 404
            ? "That usually means the bucket name doesn't exist on this account."
            : await put.text().catch(() => "")
      }`
    );
  }
  step("uploaded with a presigned PUT");

  const head = await storage.head(key);
  if (!head) throw new Error("The object isn't there after uploading it.");
  if (head.bytes !== Buffer.byteLength(BODY)) {
    throw new Error(`Stored size is ${head.bytes}, expected ${Buffer.byteLength(BODY)}.`);
  }
  step("size checked", `${head.bytes} bytes`);

  const download = storage.presignDownload(key, 300);
  const got = await fetch(download.url);
  if (!got.ok) throw new Error(`Playback fetch failed with ${got.status}.`);
  if ((await got.text()) !== BODY) throw new Error("What came back isn't what went up.");
  step("read back through a signed GET");

  await storage.delete(key);
  if (await storage.head(key)) throw new Error("The object survived being deleted.");
  step("deleted, and confirmed gone");

  console.log("\nR2 is configured correctly. Recording and playback will work.");
}

main().catch((err) => {
  console.error(`\n✗ ${err instanceof Error ? err.message : err}`);
  process.exitCode = 1;
});
