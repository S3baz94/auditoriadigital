import { describe, expect, it } from "vitest";
import { isValidSyntax, verifyEmail } from "./emailVerify.js";

describe("emailVerify", () => {
  it("rejects invalid syntax", () => {
    expect(isValidSyntax("not-an-email")).toBe(false);
  });

  it("accepts valid syntax", () => {
    expect(isValidSyntax("test@example.com")).toBe(true);
  });

  it("marks invalid domain", async () => {
    const r = await verifyEmail("user@this-domain-definitely-does-not-exist-xyz123.invalid");
    expect(r.status).toBe("invalid");
  });
});
