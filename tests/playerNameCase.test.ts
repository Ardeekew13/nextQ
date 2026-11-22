/** Every player name is stored in UPPERCASE, however it was typed or imported. */
import { describe, expect, it } from "vitest";
import { SessionPlayer } from "@/models/SessionPlayer";
import { ClubMember } from "@/models/ClubMember";
import { toPlayerName } from "@/lib/playerNames";

describe("player names are uppercase", () => {
  it("trims, collapses spaces and uppercases", () => {
    expect(toPlayerName("  leo   oba ")).toBe("LEO OBA");
    expect(toPlayerName("Zeus Tworres")).toBe("ZEUS TWORRES");
  });

  it("applies to session players and club members, whichever way they're created", () => {
    expect(new SessionPlayer({ sessionId: "6a61d057f0d040b70e67cab9", name: "Leo Oba" }).name).toBe("LEO OBA");
    expect(new ClubMember({ clubId: "6a61d057f0d040b70e67cab9", organiserId: "6a61d057f0d040b70e67cab9", name: "valie" }).name).toBe("VALIE");
    const p = new SessionPlayer({ sessionId: "6a61d057f0d040b70e67cab9", name: "x" });
    p.name = "christian l";
    expect(p.name).toBe("CHRISTIAN L");
  });
});
