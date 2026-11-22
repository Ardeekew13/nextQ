/** Reading a public Reclub event: players by their permanent Reclub id, +1 guests, statuses. */
import { describe, expect, it, vi } from "vitest";
import { fetchReclubMeet, parseReclubMeet, reclubCode } from "@/lib/reclub";

/** Encodes a value the way Nuxt's payload does: one flat array, objects point at entries by index. */
function devalue(value: unknown): string {
  const out: unknown[] = [];
  const put = (v: unknown): number => {
    const i = out.length;
    out.push(null);
    if (Array.isArray(v)) out[i] = v.map(put);
    else if (v && typeof v === "object") out[i] = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, put(x)]));
    else out[i] = v;
    return i;
  };
  const root = out.length;
  out.push(["ShallowReactive", 1]);
  put(value);
  void root;
  return JSON.stringify(out);
}

const page = (payload: unknown) =>
  `<html><body><div id="__nuxt"></div><script type="application/json" data-nuxt-data="nuxt-app" id="__NUXT_DATA__">${devalue(payload)}</script></body></html>`;

const event = {
  data: {
    "meet-3PA3KP": {
      meet: {
        name: "Sunday rally",
        startDatetime: 1795348800,
        participants: [
          { referenceType: 2, referenceId: 101, externalReference: null, status: 1, isHost: true },
          { referenceType: 1, referenceId: 102, externalReference: null, status: 1, isHost: false },
          { referenceType: 3, referenceId: 102, externalReference: { level: 383, name: "Guesty" }, status: 1, isHost: false },
          { referenceType: 1, referenceId: 103, externalReference: null, status: 2, isHost: false },
          { referenceType: 1, referenceId: 104, externalReference: null, status: 3, isHost: false },
        ],
      },
      usersMap: {
        101: { userId: 101, username: "host-1", name: "Host" },
        102: { userId: 102, username: "ann-22", name: " Ann " },
        103: { userId: 103, username: "waity", name: "Waity" },
        104: { userId: 104, username: "invi", name: "Invi" },
      },
      group: { name: "The Club" },
    },
  },
};

describe("Reclub event pages", () => {
  it("takes a link or a bare code, nothing else", () => {
    expect(reclubCode("https://reclub.co/m/3PA3KP")).toBe("3PA3KP");
    expect(reclubCode("reclub.co/m/3PA3KP?ref=share")).toBe("3PA3KP");
    expect(reclubCode("3PA3KP")).toBe("3PA3KP");
    expect(reclubCode("https://evil.example/m/3PA3KP")).toBeNull();
    expect(reclubCode("http://reclub.co.evil/m/3PA3KP")).toBeNull();
  });

  it("reads players with their permanent Reclub id, guests with who brought them, and statuses", () => {
    const meet = parseReclubMeet(page(event), "3PA3KP");
    expect(meet.name).toBe("Sunday rally");
    expect(meet.clubName).toBe("The Club");
    expect(meet.participants.map((p) => [p.key, p.kind, p.status, p.name, p.username, p.guestOfName])).toEqual([
      ["u:101", "PLAYER", "CONFIRMED", "Host", "host-1", null],
      ["u:102", "PLAYER", "CONFIRMED", "Ann", "ann-22", null],
      ["g:102:guesty", "GUEST", "CONFIRMED", "Guesty", null, "Ann"],
      ["u:103", "PLAYER", "WAITLISTED", "Waity", "waity", null],
      ["u:104", "PLAYER", "INVITED", "Invi", "invi", null],
    ]);
    expect(meet.participants[0].isHost).toBe(true);
  });

  it("says so clearly when the page format changes", () => {
    expect(() => parseReclubMeet("<html>no data</html>", "3PA3KP")).toThrow(/changed their site/);
    expect(() => parseReclubMeet(page({ data: {} }), "3PA3KP")).toThrow(/wasn't found/);
  });

  it("only ever requests reclub.co/m/<code>", async () => {
    const fetchImpl = vi.fn(async () => new Response(page(event), { status: 200 }));
    await fetchReclubMeet("https://reclub.co/m/3PA3KP", fetchImpl as never);
    expect(fetchImpl).toHaveBeenCalledWith("https://reclub.co/m/3PA3KP", expect.anything());
    await expect(fetchReclubMeet("https://example.com/whatever", fetchImpl as never)).rejects.toThrow(/Reclub event link/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
