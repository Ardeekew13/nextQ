import { describe, expect, it } from "vitest";
import { pickTopFour } from "@/lib/topFour";

const standings = ["a", "b", "c", "d", "e", "f"].map((id, i) => ({ rank: i + 1, player: { id } }));

describe("pickTopFour", () => {
  it("takes ranks 1-4 and splits 1+4 vs 2+3", () => {
    const m = pickTopFour(standings, ["a", "b", "c", "d", "e", "f"])!;
    expect(m.teamA.map((p) => p.id)).toEqual(["a", "d"]);
    expect(m.teamB.map((p) => p.id)).toEqual(["b", "c"]);
  });

  it("skips ranked players who are not waiting (on court)", () => {
    const m = pickTopFour(standings, ["b", "c", "d", "e", "f"])!;
    expect(m.players.map((p) => p.id)).toEqual(["b", "c", "d", "e"]);
    expect(m.teamA.map((p) => p.id)).toEqual(["b", "e"]);
  });

  it("works on unsorted standings", () => {
    const m = pickTopFour([...standings].reverse(), ["a", "b", "c", "d"])!;
    expect(m.players.map((p) => p.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("returns null with fewer than four waiting", () => {
    expect(pickTopFour(standings, ["a", "b", "c"])).toBeNull();
  });
});
