import { describe, expect, it } from "vitest";
import { mergeWithFullName, parseNameFromUsername } from "./nameAi.js";

describe("parseNameFromUsername", () => {
  it("parses dot-separated names", () => {
    const r = parseNameFromUsername("ana.garcia.fit");
    expect(r.firstName).toBe("Ana");
    expect(r.lastName).toBe("Garcia");
    expect(r.confidence).toBe("high");
  });

  it("parses camelCase", () => {
    const r = parseNameFromUsername("diegoMartinez");
    expect(r.firstName).toBe("Diego");
    expect(r.lastName).toBe("Martinez");
  });

  it("merges full name from profile", () => {
    const r = mergeWithFullName(parseNameFromUsername("coach_mx"), "María López");
    expect(r.firstName).toBe("María");
    expect(r.lastName).toBe("López");
  });
});
