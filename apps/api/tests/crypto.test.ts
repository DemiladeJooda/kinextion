import { beforeAll, describe, expect, it } from "vitest";

// The module reads the key lazily, per call, so setting it here is enough.
beforeAll(() => {
  process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-key-not-a-real-secret";
});

const { encryptToken, decryptToken } = await import("../src/lib/crypto.js");

describe("token encryption", () => {
  it("round-trips a token", () => {
    const token = "strava_access_token_abc123";
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("round-trips unicode and long values", () => {
    const token = `${"x".repeat(2000)}—🔐—ü`;
    expect(decryptToken(encryptToken(token))).toBe(token);
  });

  it("round-trips an empty string", () => {
    expect(decryptToken(encryptToken(""))).toBe("");
  });

  it("never stores the plaintext", () => {
    const encrypted = encryptToken("super_secret_value");
    expect(encrypted).not.toContain("super_secret_value");
  });

  it("produces a different ciphertext each time (random IV)", () => {
    const a = encryptToken("same input");
    const b = encryptToken("same input");
    expect(a).not.toBe(b);
    // Both still decrypt — the difference is the IV, not the payload.
    expect(decryptToken(a)).toBe(decryptToken(b));
  });

  it("rejects a tampered ciphertext instead of returning garbage", () => {
    const [iv, tag, data] = encryptToken("original").split(":");
    const flipped = Buffer.from(data, "base64");
    flipped[0] ^= 0xff;
    const tampered = [iv, tag, flipped.toString("base64")].join(":");

    expect(() => decryptToken(tampered)).toThrow();
  });

  it("rejects a tampered auth tag", () => {
    const [iv, tag, data] = encryptToken("original").split(":");
    const flipped = Buffer.from(tag, "base64");
    flipped[0] ^= 0xff;

    expect(() => decryptToken([iv, flipped.toString("base64"), data].join(":"))).toThrow();
  });

  it("rejects a malformed stored value", () => {
    expect(() => decryptToken("not-a-valid-token")).toThrow(/Malformed/);
    expect(() => decryptToken("only:two")).toThrow(/Malformed/);
  });

  it("cannot decrypt with a different key", async () => {
    const encrypted = encryptToken("secret");
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "a-completely-different-key";
    expect(() => decryptToken(encrypted)).toThrow();
    process.env.INTEGRATIONS_ENCRYPTION_KEY = "test-key-not-a-real-secret";
  });

  it("refuses to operate with no key configured", () => {
    const saved = process.env.INTEGRATIONS_ENCRYPTION_KEY;
    delete process.env.INTEGRATIONS_ENCRYPTION_KEY;
    expect(() => encryptToken("x")).toThrow(/INTEGRATIONS_ENCRYPTION_KEY/);
    process.env.INTEGRATIONS_ENCRYPTION_KEY = saved;
  });
});
