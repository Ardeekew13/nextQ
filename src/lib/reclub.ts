/**
 * Reads the player list of a public Reclub event ("meet") page, e.g. https://reclub.co/m/3PA3KP.
 * Reclub has no public API: its event page is a Nuxt app that embeds the event's data as a
 * serialized payload (<script id="__NUXT_DATA__">). Each participant references a Reclub user by
 * a numeric id that never changes; usernames and names can change. "+1" guests have no account
 * of their own: they're entries owned by the player who brought them, with just a name.
 *
 * This depends on Reclub's page format, not a contract, so parsing is defensive and returns a
 * clear error when the format changes.
 */

export type ReclubStatus = "CONFIRMED" | "WAITLISTED" | "INVITED" | "OTHER";

export interface ReclubParticipant {
  /** Stable key for this row within the event: "u:<userId>" or "g:<ownerUserId>:<name>". */
  key: string;
  kind: "PLAYER" | "GUEST";
  status: ReclubStatus;
  /** Name to use: the player's Reclub name, or the guest's name. */
  name: string;
  /** Reclub user id (players only). */
  userId: number | null;
  username: string | null;
  /** Guests: who brought them. */
  guestOfUserId: number | null;
  guestOfName: string | null;
  isHost: boolean;
}

export interface ReclubMeet {
  code: string;
  name: string;
  startsAt: string | null;
  clubName: string | null;
  participants: ReclubParticipant[];
}

/** The event code from a Reclub link or a bare code ("3PA3KP"); null when it isn't one. */
export function reclubCode(input: string): string | null {
  const trimmed = input.trim();
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?reclub\.co\/m\/([A-Za-z0-9]{4,16})(?:[/?#].*)?$/i.exec(trimmed);
  if (fromUrl) return fromUrl[1];
  return /^[A-Za-z0-9]{4,16}$/.test(trimmed) ? trimmed : null;
}

const WRAPPERS = new Set(["ShallowReactive", "Reactive", "Ref", "ShallowRef", "EmptyRef", "NuxtError"]);

/** Revives a Nuxt "devalue" payload (a flat array where objects point at other entries by index). */
function revive(payload: unknown[]): unknown {
  const cache = new Map<number, unknown>();
  const at = (i: number): unknown => {
    if (cache.has(i)) return cache.get(i);
    const v = payload[i];
    if (Array.isArray(v)) {
      if (typeof v[0] === "string" && WRAPPERS.has(v[0])) {
        const out = typeof v[1] === "number" ? at(v[1]) : v[1];
        cache.set(i, out);
        return out;
      }
      if (v[0] === "Date") return v[1];
      if (v[0] === "Set" || v[0] === "Map") return v.slice(1).map((x) => (typeof x === "number" ? at(x) : x));
      const out: unknown[] = [];
      cache.set(i, out);
      for (const x of v) out.push(typeof x === "number" ? at(x) : x);
      return out;
    }
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      cache.set(i, out);
      for (const [k, x] of Object.entries(v)) out[k] = typeof x === "number" ? at(x) : x;
      return out;
    }
    return v;
  };
  return at(0);
}

const STATUS: Record<number, ReclubStatus> = { 1: "CONFIRMED", 2: "WAITLISTED", 3: "INVITED" };

/** Parses a Reclub event page. Throws with a readable message when the data isn't there. */
export function parseReclubMeet(html: string, code: string): ReclubMeet {
  const m = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error("Couldn't find the player list on that Reclub page. Reclub may have changed their site.");
  let root: any;
  try {
    root = revive(JSON.parse(m[1]));
  } catch {
    throw new Error("Couldn't read that Reclub page. Reclub may have changed their site.");
  }
  const data = root?.data ?? {};
  const entry: any = data[`meet-${code}`] ?? Object.entries(data).find(([k]) => k.toLowerCase() === `meet-${code.toLowerCase()}`)?.[1];
  const meet = entry?.meet;
  if (!meet || !Array.isArray(meet.participants)) {
    throw new Error("That Reclub event wasn't found, or its player list is private.");
  }
  const users: Record<string, any> = entry.usersMap ?? {};
  const userName = (id: number) => (typeof users[id]?.name === "string" ? users[id].name.trim() : null);

  const participants: ReclubParticipant[] = [];
  const seen = new Set<string>();
  for (const p of meet.participants as any[]) {
    const status = STATUS[p?.status as number] ?? "OTHER";
    const ownerId = typeof p?.referenceId === "number" ? p.referenceId : null;
    const guestName = typeof p?.externalReference?.name === "string" ? p.externalReference.name.trim() : null;
    if (guestName) {
      const key = `g:${ownerId ?? "?"}:${guestName.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      participants.push({
        key, kind: "GUEST", status, name: guestName, userId: null, username: null,
        guestOfUserId: ownerId, guestOfName: ownerId ? userName(ownerId) : null, isHost: false,
      });
      continue;
    }
    if (ownerId === null) continue;
    const key = `u:${ownerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    participants.push({
      key, kind: "PLAYER", status, name: userName(ownerId) ?? `Reclub player ${ownerId}`, userId: ownerId,
      username: typeof users[ownerId]?.username === "string" ? users[ownerId].username : null,
      guestOfUserId: null, guestOfName: null, isHost: Boolean(p.isHost),
    });
  }
  return {
    code,
    name: typeof meet.name === "string" ? meet.name : "",
    startsAt: typeof meet.startDatetime === "number" ? new Date(meet.startDatetime * 1000).toISOString() : null,
    clubName: typeof entry.group?.name === "string" ? entry.group.name : null,
    participants,
  };
}

/** Fetches and parses a Reclub event. Only ever requests reclub.co/m/<code>. */
export async function fetchReclubMeet(link: string, fetchImpl: typeof fetch = fetch): Promise<ReclubMeet> {
  const code = reclubCode(link);
  if (!code) throw new Error("That doesn't look like a Reclub event link (reclub.co/m/…).");
  const res = await fetchImpl(`https://reclub.co/m/${encodeURIComponent(code)}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; NextQueue/1.0; +https://nextqueue.online)", accept: "text/html" },
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404) throw new Error("That Reclub event wasn't found.");
  if (!res.ok) throw new Error(`Reclub didn't answer (${res.status}). Try again in a moment.`);
  return parseReclubMeet(await res.text(), code);
}
