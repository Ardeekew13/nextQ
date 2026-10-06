import { describe, expect, it } from "vitest";
import { isSameName, isSimilarName } from "@/lib/playerNames";

describe("player name matching", () => {
  it("treats case, spacing, accents and punctuation as the same name", () => {
    expect(isSameName("Rodel", "RODEL")).toBe(true);
    expect(isSameName("  joy   ann ", "JOY ANN")).toBe(true);
    expect(isSameName("José", "JOSE")).toBe(true);
    expect(isSameName("RD", "RODEL")).toBe(false);
  });
  it("flags small typos and spacing slips as similar, not identical", () => {
    expect(isSimilarName("RODELL", "RODEL")).toBe(true);
    expect(isSimilarName("JOYANN", "JOY ANN")).toBe(true);
    expect(isSimilarName("RODEL", "RODEL")).toBe(false);
  });
  it("does not flag different people", () => {
    expect(isSimilarName("DAVE", "DAVE AMATONG")).toBe(false);
    expect(isSimilarName("KJ", "KY")).toBe(false);
    expect(isSimilarName("LEO", "LEA")).toBe(false);
    expect(isSimilarName("ANNA", "ANNE")).toBe(true);
  });
});
