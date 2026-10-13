import { describe, expect, it } from "vitest";
import { findTogetherGroups } from "@/lib/togetherGroups";

const g = (n: number, ids: string[]) => ({ id: `g${n}`, gameNumber: n, playerIds: ids });

describe("findTogetherGroups", () => {
  it("reports a trio that shared 3 games and hides the pairs inside it", () => {
    const games = [g(1, ["a", "b", "c", "x"]), g(2, ["a", "b", "c", "y"]), g(3, ["a", "b", "c", "z"]), g(4, ["x", "y", "z", "w"])];
    const groups = findTogetherGroups(games);
    expect(groups[0].playerIds).toEqual(["a", "b", "c"]);
    expect(groups[0].gamesTogether).toBe(3);
    expect(groups[0].gameIds).toEqual(["g1", "g2", "g3"]);
    expect(groups.filter((x) => x.playerIds.length === 2 && x.playerIds.every((i) => "abc".includes(i)))).toHaveLength(0);
  });

  it("reports pairs that shared 2 games", () => {
    const groups = findTogetherGroups([g(1, ["a", "b", "c", "d"]), g(2, ["a", "b", "e", "f"])]);
    expect(groups.map((x) => x.key)).toContain("a:b");
  });

  it("ignores groups seen only once and groups already separated", () => {
    const games = [g(1, ["a", "b", "c", "d"]), g(2, ["a", "b", "e", "f"])];
    expect(findTogetherGroups([games[0]])).toHaveLength(0);
    expect(findTogetherGroups(games, { separated: [["a", "b"]] })).toHaveLength(0);
  });
});

describe("fixed partners", () => {
  const g = (n: number, ids: string[]) => ({ id: `g${n}`, gameNumber: n, playerIds: ids });

  it("never warns about a fixed pair playing together, however often", () => {
    const games = [g(1, ["joie", "primie", "a", "b"]), g(2, ["joie", "primie", "c", "d"]), g(3, ["joie", "primie", "e", "f"])];
    const groups = findTogetherGroups(games, { fixedPairs: [["joie", "primie"], ["primie", "joie"]] });
    expect(groups.map((x) => x.key)).not.toContain("joie:primie");
  });

  it("still warns when someone else keeps landing with the fixed pair", () => {
    const games = [g(1, ["joie", "primie", "x", "b"]), g(2, ["joie", "primie", "x", "d"]), g(3, ["joie", "primie", "e", "f"])];
    const groups = findTogetherGroups(games, { fixedPairs: [["joie", "primie"]] });
    expect(groups.map((x) => x.key)).toContain("joie:primie:x");
  });

  it("still warns about a pair that isn't fixed", () => {
    const games = [g(1, ["gio", "kj", "a", "b"]), g(2, ["gio", "kj", "c", "d"]), g(3, ["gio", "kj", "e", "f"])];
    expect(findTogetherGroups(games, { fixedPairs: [["joie", "primie"]] }).map((x) => x.key)).toContain("gio:kj");
  });
});
