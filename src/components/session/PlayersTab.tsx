"use client";

import { useState, useEffect, type CSSProperties } from "react";
import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import { gql } from "@apollo/client";
import {
  Button, Modal, Form, Input, Select,
  App, Tabs, Typography, Checkbox, Empty, Spin, Dropdown, Popconfirm,
} from "antd";
import { PlusOutlined, TeamOutlined } from "@ant-design/icons";
import {
  ADD_SESSION_PLAYER,
  ADD_SESSION_PLAYERS,
  UPDATE_SESSION_PLAYER,
  REMOVE_SESSION_PLAYER,
  CHECK_IN_PLAYER,
  SET_PLAYER_ACTIVE_STATUS,
  CLUB_MEMBERS_QUERY,
  IMPORT_CLUB_MEMBERS_TO_SESSION,
  SESSION_PLAYERS_ALLTIME_QUERY,
} from "@/graphql/documents/organiser";

const { Text } = Typography;

export type PlayerTabStats = {
  onRoster: number;
  checkedIn: number;
  sittingOut: number;
  unrated: number;
};

const SKILL_OPTIONS = [
  { value: "NOVICE", label: "Novice" },
  { value: "BEGINNER_LOW", label: "Beginner (low)" },
  { value: "BEGINNER_HIGH", label: "Beginner (high)" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

const SKILL_LABEL: Record<string, string> = {
  NOVICE: "Novice",
  BEGINNER_LOW: "Beginner (low)",
  BEGINNER_HIGH: "Beginner (high)",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

const PLAYERS_QUERY = gql`
  query SessionPlayersExtended($id: ID!) {
    session(id: $id) {
      id
      status
      clubId
      settings { queueMode }
      players {
        id
        name
        nickname
        skillLevel
        checkedIn
        checkedInAt
        active
        gamesPlayed
        wins
        losses
        winRate
        gamesSatOut
        queueEnteredAt
      }
      activeGames {
        id
        teamA { players { id } }
        teamB { players { id } }
      }
    }
  }
`;

type PlayerStatus = "PLAYING" | "IN_QUEUE" | "SITTING_OUT" | "NOT_ARRIVED";

const STATUS_CONFIG: Record<PlayerStatus, { label: string; color: string; dot: string }> = {
  PLAYING:     { label: "PLAYING",     color: "#e11d74",             dot: "#e11d74" },
  IN_QUEUE:    { label: "IN QUEUE",    color: "#e11d74",             dot: "#e11d74" },
  SITTING_OUT: { label: "SITTING OUT", color: "rgba(29,31,32,0.45)", dot: "#9ca3af" },
  NOT_ARRIVED: { label: "NOT ARRIVED", color: "rgba(29,31,32,0.35)", dot: "#d1d5db" },
};

const STATUS_ORDER: Record<PlayerStatus, number> = {
  PLAYING: 0, IN_QUEUE: 1, SITTING_OUT: 2, NOT_ARRIVED: 3,
};

function getStatus(player: any, playingIds: Set<string>): PlayerStatus {
  if (playingIds.has(player.id)) return "PLAYING";
  if (!player.checkedIn) return "NOT_ARRIVED";
  if (!player.active) return "SITTING_OUT";
  return "IN_QUEUE";
}

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "just now";
  if (diff < 60) return `${diff} min ago`;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  return m > 0 ? `${h}h ${m}m ago` : `${h}h ago`;
}

function winPct(rate: number | null | undefined): string {
  if (rate == null) return "—";
  return `.${String(Math.round(rate * 1000)).padStart(3, "0")}`;
}

const thStyle: CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "rgba(29,31,32,0.4)",
  padding: "10px 0",
  userSelect: "none",
};

const actionBtnStyle: CSSProperties = {
  background: "rgba(255,255,255,0.1)",
  border: "1px solid rgba(255,255,255,0.28)",
  borderRadius: 4,
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  padding: "5px 16px",
  letterSpacing: "0.03em",
};

export function PlayersTab({
  sessionId,
  onStats,
}: {
  sessionId: string;
  onStats?: (s: PlayerTabStats) => void;
}) {
  const { message } = App.useApp();
  const { data, refetch } = useQuery(PLAYERS_QUERY, {
    variables: { id: sessionId },
    pollInterval: 5000,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [setSkillOpen, setSetSkillOpen] = useState(false);
  const [bulkSkill, setBulkSkill] = useState<string | undefined>(undefined);
  const [view, setView] = useState<"session" | "alltime">("session");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 25;

  const [singleForm] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const [addSessionPlayer, { loading: addingSingle }] = useMutation(ADD_SESSION_PLAYER);
  const [addSessionPlayers, { loading: addingBulk }] = useMutation(ADD_SESSION_PLAYERS);
  const [updateSessionPlayer] = useMutation(UPDATE_SESSION_PLAYER);
  const [removeSessionPlayer] = useMutation(REMOVE_SESSION_PLAYER);
  const [checkInPlayer] = useMutation(CHECK_IN_PLAYER);
  const [setPlayerActiveStatus] = useMutation(SET_PLAYER_ACTIVE_STATUS);
  const [importMembers] = useMutation(IMPORT_CLUB_MEMBERS_TO_SESSION);

  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [fetchClubMembers, { data: membersData, loading: membersLoading }] = useLazyQuery(CLUB_MEMBERS_QUERY);
  const [fetchAllTime, { data: allTimeData, loading: allTimeLoading }] = useLazyQuery(SESSION_PLAYERS_ALLTIME_QUERY);

  const session = data?.session;
  const players: any[] = session?.players ?? [];
  const activeGames: any[] = session?.activeGames ?? [];
  const isDraft = session?.status === "DRAFT";
  const clubId: string | undefined = session?.clubId;
  const existingNames = new Set(players.map((p: any) => p.name.toLowerCase()));

  const playingIds = new Set<string>(
    activeGames.flatMap((g: any) => [
      ...(g.teamA?.players ?? []).map((p: any) => p.id),
      ...(g.teamB?.players ?? []).map((p: any) => p.id),
    ])
  );

  const onRoster = players.length;
  const checkedIn = players.filter((p: any) => p.checkedIn).length;
  const sittingOut = players.filter((p: any) => p.checkedIn && !p.active && !playingIds.has(p.id)).length;
  const unrated = players.filter((p: any) => !p.skillLevel).length;
  const allUnrated = unrated === onRoster && onRoster > 0;

  useEffect(() => {
    onStats?.({ onRoster, checkedIn, sittingOut, unrated });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onRoster, checkedIn, sittingOut, unrated]);

  const clubMembers: any[] = membersData?.clubMembers ?? [];
  const importableMembers = clubMembers.filter((m: any) => !existingNames.has(m.name.toLowerCase()));

  const selectedPlayers = players.filter((p: any) => selectedKeys.includes(p.id));
  const allSelectedCheckedIn = selectedPlayers.length > 0 && selectedPlayers.every((p: any) => p.checkedIn);

  const filteredPlayers = players.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const sortedPlayers = [...filteredPlayers].sort((a, b) =>
    STATUS_ORDER[getStatus(a, playingIds)] - STATUS_ORDER[getStatus(b, playingIds)]
  );
  const allVisibleSelected =
    sortedPlayers.length > 0 && sortedPlayers.every((p: any) => selectedKeys.includes(p.id));

  // All-time view
  const allTimePlayers: any[] = allTimeData?.sessionPlayersAllTime ?? [];
  const filteredAllTime = allTimePlayers.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );
  const sortedAllTime = [...filteredAllTime].sort((a, b) => b.winRate - a.winRate);

  // Pagination (applies to whichever view is active)
  const activeList = view === "session" ? sortedPlayers : sortedAllTime;
  const totalPages = Math.ceil(activeList.length / PAGE_SIZE);
  const pagedList = activeList.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  async function handleBulkCheckIn(val: boolean) {
    try {
      await Promise.all(selectedKeys.map((id) => checkInPlayer({ variables: { id, checkedIn: val } })));
      message.success(`${selectedKeys.length} player${selectedKeys.length > 1 ? "s" : ""} ${val ? "checked in" : "checked out"}`);
      setSelectedKeys([]);
      refetch();
    } catch { message.error("Could not update players"); }
  }

  async function handleBulkSitOut() {
    try {
      await Promise.all(selectedKeys.map((id) => setPlayerActiveStatus({ variables: { id, active: false } })));
      message.success(`${selectedKeys.length} player${selectedKeys.length > 1 ? "s" : ""} set to sit out`);
      setSelectedKeys([]);
      refetch();
    } catch { message.error("Could not update players"); }
  }

  async function handleBulkRemove() {
    try {
      await Promise.all(selectedKeys.map((id) => removeSessionPlayer({ variables: { id } })));
      message.success(`${selectedKeys.length} removed`);
      setSelectedKeys([]);
      refetch();
    } catch { message.error("Could not remove players"); }
  }

  async function handleBulkSetSkill() {
    if (bulkSkill === undefined) return;
    const skillValue = bulkSkill === "" ? null : bulkSkill;
    try {
      await Promise.all(selectedKeys.map((id) => updateSessionPlayer({ variables: { id, input: { skillLevel: skillValue } } })));
      const msg = skillValue
        ? `Skill updated for ${selectedKeys.length} player${selectedKeys.length > 1 ? "s" : ""}`
        : `Skill removed — ${selectedKeys.length} player${selectedKeys.length > 1 ? "s" : ""} set to Unrated`;
      message.success(msg);
      setSelectedKeys([]);
      setSetSkillOpen(false);
      setBulkSkill(undefined);
      refetch();
    } catch { message.error("Could not update skill"); }
  }

  async function handleAddSingle(values: any) {
    const name = values.name.trim().toUpperCase();
    if (existingNames.has(name.toLowerCase())) {
      message.error(`"${name}" is already in this session`);
      return;
    }
    try {
      const result = await addSessionPlayer({ variables: { sessionId, input: { ...values, name } } });
      const newId = result.data?.addSessionPlayer?.id;
      if (newId) await checkInPlayer({ variables: { id: newId, checkedIn: true } });
      message.success("Player added and checked in");
      singleForm.resetFields();
      refetch();
    } catch { message.error("Could not add player"); }
  }

  async function handleAddBulk(values: any) {
    const lines = values.names.split("\n").map((l: string) => l.trim().toUpperCase()).filter(Boolean);
    const unique = [...new Set(lines)] as string[];
    const dupes = unique.filter((n) => existingNames.has(n.toLowerCase()));
    const inputs = unique.filter((n) => !existingNames.has(n.toLowerCase())).map((name) => ({ name }));
    if (dupes.length > 0) message.warning(`Skipped ${dupes.length} duplicate${dupes.length > 1 ? "s" : ""}`);
    if (inputs.length === 0) return;
    try {
      const result = await addSessionPlayers({ variables: { sessionId, inputs } });
      const newIds: string[] = result.data?.addSessionPlayers?.map((p: any) => p.id) ?? [];
      if (newIds.length > 0) await Promise.all(newIds.map((id) => checkInPlayer({ variables: { id, checkedIn: true } })));
      message.success(`${inputs.length} player${inputs.length > 1 ? "s" : ""} added`);
      bulkForm.resetFields();
      setAddOpen(false);
      refetch();
    } catch { message.error("Could not add players"); }
  }

  async function handleEditSubmit(values: any) {
    try {
      await updateSessionPlayer({ variables: { id: editingPlayer.id, input: values } });
      message.success("Player updated");
      setEditingPlayer(null);
      refetch();
    } catch { message.error("Could not update player"); }
  }

  async function handleImportMembers() {
    if (selectedImportIds.length === 0) return;
    setImporting(true);
    try {
      const result = await importMembers({ variables: { sessionId, memberIds: selectedImportIds } });
      const imported: any[] = result.data?.importClubMembersToSession ?? [];
      if (imported.length > 0)
        await Promise.all(imported.map((p: any) => checkInPlayer({ variables: { id: p.id, checkedIn: true } })));
      message.success(`${imported.length} player${imported.length !== 1 ? "s" : ""} imported`);
      setSelectedImportIds([]);
      setAddOpen(false);
      refetch();
    } catch { message.error("Could not import players"); }
    finally { setImporting(false); }
  }

  const GRID = "48px 1fr 150px 120px 80px 70px 70px 110px 44px";

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <style>{`
        .pl-row:hover { background: #fdf2f8 !important; }
      `}</style>

      {/* Alert banner */}
      {allUnrated && !alertDismissed && (
        <div style={{
          background: "#fff0f5", borderBottom: "1px solid #fbb6ce",
          padding: "14px 24px", display: "flex", alignItems: "center", gap: 12, minHeight: 56,
        }}>
          <span style={{ fontSize: 15, color: "#e11d74", flexShrink: 0 }}>&#9432;</span>
          <Text style={{ fontSize: 13, flex: 1, color: "#111827" }}>
            Every player is unrated, so hybrid mode is drawing at random rather than balancing skill.{" "}
            Rate them in bulk or switch the session to strict queue order.
          </Text>
          <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 0 }}>
            <Button
              style={{ borderColor: "#e11d74", color: "#e11d74", fontWeight: 600, height: 34, fontSize: 13 }}
              onClick={() => { setSelectedKeys(players.map((p: any) => p.id)); setSetSkillOpen(true); }}
            >
              Rate players
            </Button>
            <button
              style={{ background: "none", border: "none", cursor: "pointer", color: "#8d1a3f", fontWeight: 600, fontSize: 13, padding: "0 12px", height: 34 }}
              onClick={() => setAlertDismissed(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 24px", borderBottom: "1px solid rgba(138,39,72,0.08)",
      }}>
        {/* Pink search input */}
        <div style={{ position: "relative", width: 300, flexShrink: 0 }}>
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#e11d74", fontSize: 13, pointerEvents: "none" }}>
            &#128269;
          </span>
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={`Search ${players.length} players...`}
            style={{
              width: "100%", paddingLeft: 32, paddingRight: 12, height: 38, fontSize: 13,
              border: "1px solid #fbb6ce", borderRadius: 6, outline: "none", boxSizing: "border-box",
              color: "#1d1f20", background: "#fff0f5",
            }}
          />
        </div>

        {/* This session / All time toggle */}
        <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid #e5e7eb", flexShrink: 0 }}>
          {(["session", "alltime"] as const).map((v) => {
            const active = view === v;
            return (
              <button
                key={v}
                onClick={() => {
                  setView(v);
                  setPage(1);
                  if (v === "alltime") fetchAllTime({ variables: { sessionId } });
                }}
                style={{
                  padding: "0 18px", height: 38, fontSize: 13, fontWeight: 600,
                  border: "none", cursor: "pointer",
                  background: active ? "#e11d74" : "#fff",
                  color: active ? "#fff" : "#1d1f20",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                {v === "session" ? "This session" : "All time"}
              </button>
            );
          })}
        </div>

        <div style={{ flex: 1 }} />
        <Button icon={<PlusOutlined />} style={{ fontWeight: 600 }} onClick={() => setAddOpen(true)}>
          Add player
        </Button>
      </div>

      {/* Selection action bar */}
      {selectedKeys.length > 0 && (
        <div style={{
          background: "#3d0a1e", color: "#fff",
          padding: "0 24px", height: 52,
          display: "flex", alignItems: "center", gap: 12, flexShrink: 0,
        }}>
          <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap", marginRight: 4 }}>
            {selectedKeys.length} Selected
          </span>
          <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.2)", marginRight: 4 }} />
          {!allSelectedCheckedIn && (
            <button onClick={() => handleBulkCheckIn(true)} style={actionBtnStyle}>Check in</button>
          )}
          <button onClick={handleBulkSitOut} style={actionBtnStyle}>Sit out</button>
          <button onClick={() => setSetSkillOpen(true)} style={actionBtnStyle}>Set skill</button>
          {isDraft && (
            <Popconfirm
              title={`Remove ${selectedKeys.length} player${selectedKeys.length > 1 ? "s" : ""}?`}
              onConfirm={handleBulkRemove}
              okButtonProps={{ danger: true }}
            >
              <button style={actionBtnStyle}>Remove</button>
            </Popconfirm>
          )}
          <div style={{ flex: 1 }} />
          <button
            onClick={() => setSelectedKeys([])}
            style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.65)", fontSize: 13, fontWeight: 500, textDecoration: "underline" }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table header */}
      {view === "session" ? (
        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 24px", background: "#fafafa", borderBottom: "1px solid rgba(138,39,72,0.08)", flexShrink: 0 }}>
          <div style={thStyle}>
            <Checkbox checked={allVisibleSelected} indeterminate={selectedKeys.length > 0 && !allVisibleSelected} onChange={(e) => setSelectedKeys(e.target.checked ? sortedPlayers.map((p: any) => p.id) : [])} />
          </div>
          {(["PLAYER", "STATUS", "SKILL", "TONIGHT GP", "W\u2013L", "WIN %", "LAST ON", ""] as const).map((h) => (<div key={h} style={thStyle}>{h}</div>))}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px 80px 100px", padding: "0 24px", background: "#fafafa", borderBottom: "1px solid rgba(138,39,72,0.08)", flexShrink: 0 }}>
          {(["PLAYER", "SKILL", "SESSIONS", "TOTAL GP", "W\u2013L", "WIN %"] as const).map((h) => (<div key={h} style={thStyle}>{h}</div>))}
        </div>
      )}

      {/* Table rows */}
      {view === "session" ? (
        pagedList.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center" }}><Text type="secondary">No players found</Text></div>
        ) : (
          <>
            {(pagedList as any[]).map((player: any) => {
              const status = getStatus(player, playingIds);
              const sc = STATUS_CONFIG[status];
              const isSelected = selectedKeys.includes(player.id);
              const lastOn = relativeTime(player.queueEnteredAt ?? player.checkedInAt);
              return (
                <div key={player.id} className="pl-row" onClick={() => setSelectedKeys((prev) => prev.includes(player.id) ? prev.filter((k) => k !== player.id) : [...prev, player.id])}
                  style={{ display: "grid", gridTemplateColumns: GRID, padding: "0 24px", borderBottom: "1px solid rgba(138,39,72,0.06)", minHeight: 52, alignItems: "center", background: isSelected ? "#fff0f5" : "#fff", cursor: "default" }}>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onChange={(e) => setSelectedKeys((prev) => e.target.checked ? [...prev, player.id] : prev.filter((k) => k !== player.id))} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1f20" }}>{player.name}</div>
                    {player.nickname && <div style={{ fontSize: 11, color: "rgba(29,31,32,0.4)" }}>{player.nickname}</div>}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, flexShrink: 0, display: "inline-block" }} />
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: sc.color, fontFamily: "'Barlow Condensed', sans-serif" }}>{sc.label}</span>
                  </div>
                  <div><span style={{ display: "inline-block", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#1d1f20", padding: "2px 8px", textTransform: "uppercase" }}>{player.skillLevel ? (SKILL_LABEL[player.skillLevel] ?? player.skillLevel) : "Unrated"}</span></div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1f20" }}>{player.gamesPlayed}</div>
                  <div style={{ fontSize: 13, color: "#1d1f20" }}>{player.wins}–{player.losses}</div>
                  <div style={{ fontSize: 13, color: "#1d1f20" }}>{winPct(player.winRate)}</div>
                  <div style={{ fontSize: 12, color: "rgba(29,31,32,0.45)" }}>{lastOn}</div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown trigger={["click"]} menu={{ items: [
                      { key: "edit", label: "Edit player", onClick: () => { setEditingPlayer(player); editForm.setFieldsValue(player); } },
                      player.checkedIn ? { key: "checkout", label: "Check out", onClick: () => checkInPlayer({ variables: { id: player.id, checkedIn: false } }).then(() => refetch()) } : { key: "checkin", label: "Check in", onClick: () => checkInPlayer({ variables: { id: player.id, checkedIn: true } }).then(() => refetch()) },
                      player.active ? { key: "sitout", label: "Sit out", onClick: () => setPlayerActiveStatus({ variables: { id: player.id, active: false } }).then(() => refetch()) } : { key: "requeue", label: "Back in queue", onClick: () => setPlayerActiveStatus({ variables: { id: player.id, active: true } }).then(() => refetch()) },
                      ...(isDraft ? [{ key: "remove", label: <span style={{ color: "#e11d74" }}>Remove</span>, onClick: () => removeSessionPlayer({ variables: { id: player.id } }).then(() => refetch()) }] : []),
                    ] }}>
                      <button style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,31,32,0.35)", fontSize: 20, padding: "0 4px", lineHeight: 1, display: "flex", alignItems: "center" }}>&#8942;</button>
                    </Dropdown>
                  </div>
                </div>
              );
            })}
          </>
        )
      ) : allTimeLoading ? (
        <div style={{ padding: 40, textAlign: "center" }}><Spin /></div>
      ) : pagedList.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center" }}><Text type="secondary">No players found</Text></div>
      ) : (
        <>
          {(pagedList as any[]).map((player: any) => (
            <div key={player.name} className="pl-row" style={{ display: "grid", gridTemplateColumns: "1fr 120px 80px 80px 80px 100px", padding: "0 24px", borderBottom: "1px solid rgba(138,39,72,0.06)", minHeight: 52, alignItems: "center", background: "#fff" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1f20" }}>{player.name}</div>
                {player.nickname && <div style={{ fontSize: 11, color: "rgba(29,31,32,0.4)" }}>{player.nickname}</div>}
              </div>
              <div><span style={{ display: "inline-block", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", color: "#1d1f20", padding: "2px 8px", textTransform: "uppercase" }}>{player.skillLevel ? (SKILL_LABEL[player.skillLevel] ?? player.skillLevel) : "Unrated"}</span></div>
              <div style={{ fontSize: 13, color: "#1d1f20" }}>{player.sessionsPlayed}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#1d1f20" }}>{player.totalGames}</div>
              <div style={{ fontSize: 13, color: "#1d1f20" }}>{player.totalWins}–{player.totalLosses}</div>
              <div style={{ fontSize: 13, color: "#1d1f20" }}>{winPct(player.winRate)}</div>
            </div>
          ))}
        </>
      )}

      {/* Pagination footer */}
      {totalPages > 1 && (
        <div style={{ padding: "12px 24px", borderTop: "1px solid rgba(138,39,72,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, activeList.length)} of {activeList.length} players
          </Text>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ background: "none", border: "1px solid rgba(29,31,32,0.2)", borderRadius: 4, cursor: page === 1 ? "default" : "pointer", color: page === 1 ? "rgba(29,31,32,0.25)" : "#1d1f20", fontSize: 13, padding: "2px 10px" }}>‹</button>
            <span style={{ fontSize: 12, color: "rgba(29,31,32,0.5)", padding: "0 6px" }}>{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} style={{ background: "none", border: "1px solid rgba(29,31,32,0.2)", borderRadius: 4, cursor: page === totalPages ? "default" : "pointer", color: page === totalPages ? "rgba(29,31,32,0.25)" : "#1d1f20", fontSize: 13, padding: "2px 10px" }}>›</button>
          </div>
        </div>
      )}

      {/* Add players modal */}
      <Modal title="Add players" open={addOpen} onCancel={() => setAddOpen(false)} footer={null} width={480}>
        <Tabs
          onChange={(key) => { if (key === "import" && clubId) fetchClubMembers({ variables: { clubId } }); }}
          items={[
            {
              key: "single", label: "One player",
              children: (
                <Form form={singleForm} layout="vertical" onFinish={handleAddSingle}>
                  <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]} normalize={(v: string) => v?.toUpperCase()}>
                    <Input size="large" style={{ textTransform: "uppercase" }} placeholder="PLAYER NAME" />
                  </Form.Item>
                  <Form.Item label="Nickname" name="nickname"><Input size="large" /></Form.Item>
                  <Form.Item label="Skill level (optional)" name="skillLevel">
                    <Select allowClear options={SKILL_OPTIONS} size="large" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={addingSingle} style={{ background: "#e11d74", borderColor: "#e11d74" }}>Add player</Button>
                </Form>
              ),
            },
            {
              key: "bulk", label: "Multiple players",
              children: (
                <Form form={bulkForm} layout="vertical" onFinish={handleAddBulk}>
                  <Form.Item label="One name per line" name="names" rules={[{ required: true }]} extra="Names saved in UPPERCASE. Duplicates skipped.">
                    <Input.TextArea rows={8} placeholder={"ALEX\nJORDAN\nSAM"} style={{ textTransform: "uppercase" }}
                      onChange={(e) => bulkForm.setFieldValue("names", e.target.value.toUpperCase())} />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={addingBulk} style={{ background: "#e11d74", borderColor: "#e11d74" }}>Add players</Button>
                </Form>
              ),
            },
            {
              key: "import", label: <span><TeamOutlined /> Club roster</span>,
              children: (
                <div>
                  {membersLoading ? (
                    <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
                  ) : importableMembers.length === 0 ? (
                    <Empty description={clubMembers.length === 0 ? "No club roster yet." : "All club members are already in this session."} />
                  ) : (
                    <div>
                      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Text type="secondary">{importableMembers.length} available · {selectedImportIds.length} selected</Text>
                        <Button size="small" type="link"
                          onClick={() => setSelectedImportIds(selectedImportIds.length === importableMembers.length ? [] : importableMembers.map((m: any) => m.id))}>
                          {selectedImportIds.length === importableMembers.length ? "Deselect all" : "Select all"}
                        </Button>
                      </div>
                      <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                        {importableMembers.map((m: any) => (
                          <div key={m.id}
                            onClick={() => setSelectedImportIds((prev) => prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id])}
                            style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: "pointer", background: selectedImportIds.includes(m.id) ? "#fff0f5" : "#fafafa", border: `1px solid ${selectedImportIds.includes(m.id) ? "#fbb6ce" : "#e5e7eb"}` }}>
                            <Checkbox checked={selectedImportIds.includes(m.id)} />
                            <div style={{ flex: 1 }}>
                              <Text strong>{m.name}</Text>
                              {m.nickname && <Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>{m.nickname}</Text>}
                            </div>
                            {m.skillLevel && <span style={{ fontSize: 11, color: "rgba(29,31,32,0.45)" }}>{SKILL_LABEL[m.skillLevel] ?? m.skillLevel}</span>}
                          </div>
                        ))}
                      </div>
                      <Button type="primary" block size="large" style={{ marginTop: 16, background: "#e11d74", borderColor: "#e11d74" }}
                        disabled={selectedImportIds.length === 0} loading={importing} onClick={handleImportMembers}>
                        Import {selectedImportIds.length > 0 ? `${selectedImportIds.length} ` : ""}player{selectedImportIds.length !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* Edit player modal */}
      <Modal title="Edit player" open={!!editingPlayer} onCancel={() => setEditingPlayer(null)} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}><Input size="large" /></Form.Item>
          <Form.Item label="Nickname" name="nickname"><Input size="large" /></Form.Item>
          <Form.Item label="Skill level" name="skillLevel"><Select allowClear options={SKILL_OPTIONS} size="large" /></Form.Item>
        </Form>
      </Modal>

      {/* Bulk set skill modal */}
      <Modal
        title={`Set skill — ${selectedKeys.length} player${selectedKeys.length !== 1 ? "s" : ""}`}
        open={setSkillOpen}
        onCancel={() => { setSetSkillOpen(false); setBulkSkill(undefined); }}
        onOk={handleBulkSetSkill}
        okText="Apply"
        okButtonProps={{ disabled: bulkSkill === undefined, style: { background: "#e11d74", borderColor: "#e11d74" } }}
      >
        <Select
          placeholder="Choose a skill level"
          options={[
            { value: "", label: <span style={{ color: "rgba(29,31,32,0.45)", fontStyle: "italic" }}>— Unrated (remove skill)</span> },
            ...SKILL_OPTIONS,
          ]}
          value={bulkSkill}
          onChange={(v: string) => setBulkSkill(v)}
          size="large"
          style={{ width: "100%", marginTop: 8 }}
        />
      </Modal>
    </div>
  );
}
