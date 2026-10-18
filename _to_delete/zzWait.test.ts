import { describe, it } from "vitest";
import { QueueMode } from "@/types/enums";
import { runLateScenario } from "./lateArrivals.test";
describe("wait", () => { it("prints", () => {
  for (const [count, when] of [[6,1],[7,2],[3,2],[5,1]] as const) {
  const runs = Array.from({ length: 30 }, (_, i) => runLateScenario({ mode: QueueMode.HYBRID, mixEveryone: true, balanceTeams: true }, `early-${i}`, 36, [{ afterMin: 1, count }], when));
  const fw = runs.flatMap((r) => r.late.map((l) => l.minutesToFirstGame));
  console.log(`RES ${count}@${when} avgFirst=${(fw.reduce((a,b)=>a+b,0)/fw.length).toFixed(1)} worstFirst=${Math.max(...fw)} bunched=${runs.reduce((a,r)=>a+r.lateBunchedGames,0)} maxShared=${Math.max(...runs.map(r=>r.maxSharedByTwoLate))} 3row=${runs.reduce((a,r)=>a+r.threeInARow,0)} origWait=${Math.max(...runs.map(r=>r.longestOriginalWait))} lateMin=${Math.min(...runs.flatMap(r=>r.late.map(l=>l.gamesAtEnd)))} origSpread=${Math.max(...runs.map(r=>r.originalsAtEnd.max-r.originalsAtEnd.min))}`);
  }
});});
