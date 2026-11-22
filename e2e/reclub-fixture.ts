/**
 * A stand-in for reclub.co during browser tests: serves event pages in Reclub's format (a Nuxt
 * payload in <script id="__NUXT_DATA__">) so the "From Reclub" import can be tested without the
 * real site. The app is pointed at it with RECLUB_BASE_URL (see playwright.config.ts).
 */
import http from "node:http";

export const RECLUB_FIXTURE_PORT = 3199;
export const RECLUB_FIXTURE_URL = `http://127.0.0.1:${RECLUB_FIXTURE_PORT}`;

/** Encodes a value the way Nuxt's payload does: one flat array, objects point at entries by index. */
function devalue(value: unknown): string {
  const out: unknown[] = [["ShallowReactive", 1]];
  const put = (v: unknown): number => {
    const i = out.length;
    out.push(null);
    if (Array.isArray(v)) out[i] = v.map(put);
    else if (v && typeof v === "object") out[i] = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, put(x)]));
    else out[i] = v;
    return i;
  };
  put(value);
  return JSON.stringify(out);
}

/** Pong (Reclub user 777) brings a +1; Waity is on the waitlist. In E2E002 Pong has renamed himself. */
function event(code: string, pongName: string) {
  return {
    data: {
      [`meet-${code}`]: {
        meet: {
          name: `E2E rally ${code}`,
          startDatetime: 1795348800,
          participants: [
            { referenceType: 1, referenceId: 777, externalReference: null, status: 1, isHost: false },
            { referenceType: 3, referenceId: 777, externalReference: { name: "Guesty" }, status: 1, isHost: false },
            { referenceType: 1, referenceId: 778, externalReference: null, status: 2, isHost: false },
          ],
        },
        usersMap: {
          777: { userId: 777, username: "jhon-382", name: pongName },
          778: { userId: 778, username: "waity-1", name: "Waity" },
        },
        group: { name: "E2E Club" },
      },
    },
  };
}

const EVENTS: Record<string, unknown> = { E2E001: event("E2E001", "Pong"), E2E002: event("E2E002", "Jhon P") };

export function startReclubFixture(): Promise<() => Promise<void>> {
  const server = http.createServer((req, res) => {
    const code = /^\/m\/([A-Za-z0-9]+)/.exec(req.url ?? "")?.[1];
    const data = code ? EVENTS[code] : undefined;
    if (!data) {
      res.writeHead(404).end("not found");
      return;
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<html><body><div id="__nuxt"></div><script type="application/json" id="__NUXT_DATA__">${devalue(data)}</script></body></html>`);
  });
  return new Promise((resolve) =>
    server.listen(RECLUB_FIXTURE_PORT, "127.0.0.1", () => resolve(() => new Promise((done) => server.close(() => done()))))
  );
}
