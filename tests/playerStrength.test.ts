import { describe, it, expect } from "vitest";
import { blendedStrength, strengthTier } from "@/lib/playerStrength";

const r = (n: number) => Math.round(n);

describe("blendedStrength", () => {
  it("starts unrated newcomers at 50%, not 0%", () => {
    expect(blendedStrength({ wins: 0, games: 0 })).toBe(50);
  });

  it("starts rated newcomers at their skill-level prior", () => {
    expect(r(blendedStrength({ skillLevel: "NOVICE", wins: 0, games: 0 }))).toBe(30);
    expect(r(blendedStrength({ skillLevel: "ADVANCED", wins: 0, games: 0 }))).toBe(70);
  });

  it("smooths early results instead of jumping to 0% or 100%", () => {
    expect(r(blendedStrength({ wins: 1, games: 1 }))).toBe(60);
    expect(r(blendedStrength({ skillLevel: "NOVICE", wins: 2, games: 2 }))).toBe(53);
  });

  it("classifies regulars from club history before they play tonight", () => {
    // 45-15 with no skill level: (45 + 4*0.5) / 64 = 73%
    expect(r(blendedStrength({ club: { wins: 45, games: 60 }, wins: 0, games: 0 }))).toBe(73);
    // 12-28: (12 + 2) / 44 = 32%
    expect(r(blendedStrength({ club: { wins: 12, games: 40 }, wins: 0, games: 0 }))).toBe(32);
  });

  it("lets tonight's results move a regular, but not wildly", () => {
    const start = blendedStrength({ club: { wins: 45, games: 60 }, wins: 0, games: 0 });
    const afterTwoLosses = blendedStrength({ club: { wins: 45, games: 60 }, wins: 0, games: 2 });
    expect(afterTwoLosses).toBeLessThan(start);
    expect(afterTwoLosses).toBeGreaterThan(55);
  });

  it("ignores an empty club record", () => {
    expect(blendedStrength({ club: { wins: 0, games: 0 }, wins: 0, games: 0 })).toBe(50);
  });
});

describe("strengthTier", () => {
  it("labels the examples sensibly", () => {
    const tier = (input: Parameters<typeof blendedStrength>[0]) => strengthTier(blendedStrength(input));
    expect(tier({ wins: 0, games: 0 })).toBe("MID"); // unrated newcomer
    expect(tier({ wins: 1, games: 1 })).toBe("MID"); // one lucky win isn't enough
    expect(tier({ skillLevel: "ADVANCED", wins: 0, games: 0 })).toBe("STRONG");
    expect(tier({ skillLevel: "NOVICE", wins: 0, games: 0 })).toBe("DEVELOPING");
    expect(tier({ club: { wins: 45, games: 60 }, wins: 0, games: 0 })).toBe("STRONG");
    expect(tier({ club: { wins: 12, games: 40 }, wins: 0, games: 0 })).toBe("DEVELOPING");
  });
});
