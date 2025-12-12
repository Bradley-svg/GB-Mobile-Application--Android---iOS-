import { describe, expect, it } from "vitest";
import { sanitizeReturnTo, DEFAULT_RETURN_TO } from "@/lib/returnTo";

describe("sanitizeReturnTo", () => {
  it("allows relative in-app paths with query and hash", () => {
    const result = sanitizeReturnTo("/app/devices?embed=true#details");
    expect(result).toBe("/app/devices?embed=true#details");
  });

  it("decodes and normalizes encoded returnTo values", () => {
    const result = sanitizeReturnTo("%2Fapp%2Fprofile%3Ftab%3Dsecurity");
    expect(result).toBe("/app/profile?tab=security");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(sanitizeReturnTo("https://evil.com/callback")).toBe(DEFAULT_RETURN_TO);
    expect(sanitizeReturnTo("//evil.com/other")).toBe(DEFAULT_RETURN_TO);
  });

  it("falls back when missing a leading slash", () => {
    expect(sanitizeReturnTo("app/profile")).toBe(DEFAULT_RETURN_TO);
  });
});
