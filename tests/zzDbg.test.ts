import { it } from "vitest";
import { QueueMode } from "@/types/enums";
import { runLateScenario } from "./lateArrivals.test";
it("dbg", () => {
  for (let i = 0; i < 10; i++) {
    const r = runLateScenario({ mode: QueueMode.HYBRID, mixEveryone: true, balanceTeams: true }, `grp-${i}`, 36, [{ afterMin: 1, count: 3 }]);
    if (r.late.some((l) => l.gamesAtEnd < 7)) { console.log("DBG", i, JSON.stringify(r.late), JSON.stringify(r.originalsAtEnd)); console.log(r.log.slice(8).join("\n")); }
  }
});
