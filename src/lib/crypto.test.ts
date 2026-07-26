import { beforeAll, describe, expect, it } from "vitest";
import { decryptToken, encryptToken } from "./crypto";

describe("Spotify token encryption", () => {
  beforeAll(() => { process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64"); });
  it("round-trips using authenticated encryption", () => {
    const encrypted = encryptToken("secret-token");
    expect(encrypted).not.toContain("secret-token");
    expect(decryptToken(encrypted)).toBe("secret-token");
  });
});
