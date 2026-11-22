"use client";

import { useState } from "react";
import { useApolloClient, useMutation } from "@apollo/client";
import { App, Button, Checkbox, Input, Select, Typography } from "antd";
import { IMPORT_RECLUB_PLAYERS, RECLUB_IMPORT_PREVIEW } from "@/graphql/documents/organiser";

const { Text } = Typography;

type Match = { memberId: string; name: string; how: string; reclubName?: string | null };
type MemberOption = { memberId: string; name: string; reclubUsername?: string | null; linked: boolean; inSessionAs?: string | null };
type Row = {
  key: string;
  kind: "PLAYER" | "GUEST";
  status: string;
  name: string;
  username?: string | null;
  guestOfName?: string | null;
  isHost: boolean;
  inSessionAs?: string | null;
  match?: Match | null;
  candidates: Match[];
};

const NEW = "__new__";

/**
 * "From Reclub": paste a Reclub event link, review who each player is in the club, add them.
 * Players are matched by their Reclub account (certain, even after a name change), otherwise by
 * name for the organiser to confirm. +1 guests have no Reclub account, so they match by name.
 */
export function ReclubImport({ sessionId, onDone }: { sessionId: string; onDone: () => void }) {
  const { message } = App.useApp();
  const apollo = useApolloClient();
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);
  const [preview, setPreview] = useState<{ eventName: string; clubName?: string | null; rows: Row[]; members: MemberOption[] } | null>(null);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [who, setWho] = useState<Record<string, string>>({}); // row key -> memberId or NEW
  const [importPlayers, { loading: importing }] = useMutation(IMPORT_RECLUB_PLAYERS);

  async function read() {
    setReading(true);
    try {
      const res = await apollo.query({ query: RECLUB_IMPORT_PREVIEW, variables: { sessionId, link }, fetchPolicy: "network-only" });
      const p = res.data.reclubImportPreview;
      setPreview(p);
      const nextPicked: Record<string, boolean> = {};
      const nextWho: Record<string, string> = {};
      for (const r of p.rows as Row[]) {
        nextPicked[r.key] = !r.inSessionAs;
        nextWho[r.key] = r.match ? r.match.memberId : NEW;
      }
      setPicked(nextPicked);
      setWho(nextWho);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Couldn't read that Reclub event");
    } finally {
      setReading(false);
    }
  }

  async function doImport() {
    if (!preview) return;
    const picks = preview.rows
      .filter((r) => picked[r.key] && !inSessionAs(r))
      .map((r) => (who[r.key] === NEW ? { key: r.key, newMember: true } : { key: r.key, memberId: who[r.key] }));
    if (picks.length === 0) return;
    try {
      const res = await importPlayers({ variables: { sessionId, link, picks } });
      const n = res.data?.importReclubPlayers?.length ?? 0;
      message.success(`${n} player${n === 1 ? "" : "s"} added from Reclub — sitting out until checked in`);
      setPreview(null);
      setLink("");
      onDone();
    } catch (e) {
      message.error(e instanceof Error ? e.message : "Couldn't add those players");
    }
  }

  /** Already in this session: as the matched member, or as the member picked in the dropdown. */
  const inSessionAs = (r: Row) => {
    if (r.inSessionAs) return r.inSessionAs;
    const chosen = who[r.key];
    return chosen && chosen !== NEW ? preview?.members.find((m) => m.memberId === chosen)?.inSessionAs ?? null : null;
  };
  const count = preview ? preview.rows.filter((r) => picked[r.key] && !inSessionAs(r)).length : 0;

  return (
    <div>
      <div style={{ display: "flex", gap: 8 }}>
        <Input
          placeholder="reclub.co/m/… event link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onPressEnter={() => link.trim() && read()}
          aria-label="Reclub event link"
        />
        <Button onClick={read} loading={reading} disabled={!link.trim()}>
          Read
        </Button>
      </div>
      {!preview && (
        <Text type="secondary" style={{ display: "block", fontSize: 12, marginTop: 8 }}>
          Adds the event's confirmed players (not the waitlist). Players are linked by their Reclub account, so they stay the same person here even if they change their name on Reclub.
        </Text>
      )}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <Text strong style={{ display: "block" }}>{preview.eventName}</Text>
          {preview.clubName && <Text type="secondary" style={{ fontSize: 12 }}>{preview.clubName}</Text>}
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
            {preview.rows.map((r) => {
              // Suggestions first, then any club member (for someone called differently in NextQ,
              // e.g. "Pong" on Reclub is "JHON" here). A member already linked to another Reclub
              // account can't be a different Reclub player.
              const suggested = [...(r.match ? [r.match] : []), ...r.candidates];
              const suggestedIds = new Set(suggested.map((m) => m.memberId));
              const options = [
                ...suggested.map((m) => ({
                  value: m.memberId,
                  label: m.how === "RECLUB" ? `${m.name} (linked)` : `${m.name} (same name)`,
                  disabled: false,
                })),
                { value: NEW, label: "New player", disabled: false },
                ...preview.members
                  .filter((m) => !suggestedIds.has(m.memberId))
                  .map((m) => ({
                    value: m.memberId,
                    label: `${m.name}${m.reclubUsername ? ` @${m.reclubUsername}` : ""}${m.inSessionAs ? " (in session)" : ""}`,
                    disabled: r.kind === "PLAYER" && m.linked,
                  })),
              ];
              const already = inSessionAs(r);
              return (
                <div
                  key={r.key}
                  data-testid="reclub-row"
                  style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", borderRadius: 6, background: picked[r.key] ? "#fff0f5" : "#fafafa", border: "1px solid #eee" }}
                >
                  <Checkbox
                    checked={!!picked[r.key] && !already}
                    disabled={!!already}
                    onChange={(e) => setPicked((p) => ({ ...p, [r.key]: e.target.checked }))}
                    aria-label={`Add ${r.name}`}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div>
                      <Text strong>{r.name}</Text>
                      {r.username && <Text type="secondary" style={{ fontSize: 11, marginLeft: 6 }}>@{r.username}</Text>}
                    </div>
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {already
                        ? `Already in this session as ${already}`
                        : r.kind === "GUEST"
                          ? `+1 guest${r.guestOfName ? ` of ${r.guestOfName}` : ""}`
                          : r.match?.how === "RECLUB" && r.match.name !== r.name
                            ? `Linked to ${r.match.name} (Reclub name changed)`
                            : ""}
                    </Text>
                  </div>
                  {!r.inSessionAs && (
                    <Select
                      size="small"
                      style={{ width: 190 }}
                      value={who[r.key]}
                      onChange={(v) => setWho((w) => ({ ...w, [r.key]: v }))}
                      options={options}
                      showSearch
                      optionFilterProp="label"
                      popupMatchSelectWidth={260}
                      disabled={r.match?.how === "RECLUB"}
                      aria-label={`Who ${r.name} is`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <Button
            type="primary"
            block
            size="large"
            style={{ marginTop: 12, background: "#e11d74", borderColor: "#e11d74" }}
            disabled={count === 0}
            loading={importing}
            onClick={doImport}
          >
            Add {count} player{count === 1 ? "" : "s"}
          </Button>
        </div>
      )}
    </div>
  );
}
