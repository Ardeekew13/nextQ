"use client";

import { Tooltip } from "antd";

interface TagPlayer {
  name: string;
}
interface TagTeam {
  players: TagPlayer[];
}
export interface GameOriginInfo {
  source?: string | null;
  offline?: boolean | null;
  edited?: boolean | null;
  edits?: Array<{ at: string; fromTeamA: TagTeam; fromTeamB: TagTeam; toTeamA: TagTeam; toTeamB: TagTeam }> | null;
}

const team = (t: TagTeam) => t.players.map((p) => p.name).join(" & ");
const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

function Tag({ label, color, bg, tip }: { label: string; color: string; bg: string; tip: React.ReactNode }) {
  return (
    <Tooltip title={tip}>
      <span
        style={{
          display: "inline-block",
          borderRadius: 4,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color,
          background: bg,
          padding: "1px 6px",
          cursor: "help",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </span>
    </Tooltip>
  );
}

/**
 * Small labels saying how a game's line-up came about: picked by hand, "Match top 4", made
 * offline, or edited afterwards. Games picked by the queue online show no label. Nothing is
 * shown for games from before this was tracked.
 */
export function GameOriginTags({ game }: { game: GameOriginInfo }) {
  const tags: React.ReactNode[] = [];
  if (game.source === "MANUAL")
    tags.push(<Tag key="m" label="Manual" color="#9a3412" bg="#ffedd5" tip="Players were chosen by hand, not by the queue." />);
  if (game.source === "TOP_FOUR")
    tags.push(<Tag key="t" label="Top 4" color="#6b21a8" bg="#f3e8ff" tip={'Made with "Match top 4": the four best-ranked waiting players, ignoring the queue.'} />);
  if (game.edited && game.edits?.length) {
    const tip = (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {game.edits.map((e, i) => (
          <div key={i}>
            <div style={{ fontWeight: 700 }}>Edited at {time(e.at)}</div>
            <div>Before: {team(e.fromTeamA)} vs {team(e.fromTeamB)}</div>
            <div>After: {team(e.toTeamA)} vs {team(e.toTeamB)}</div>
          </div>
        ))}
      </div>
    );
    tags.push(<Tag key="e" label={game.edits.length > 1 ? `Edited ×${game.edits.length}` : "Edited"} color="#92400e" bg="#fef3c7" tip={tip} />);
  }
  if (game.offline)
    tags.push(<Tag key="o" label="Offline" color="#374151" bg="#e5e7eb" tip="Made on the organiser's device while offline (or while earlier actions were still syncing)." />);
  if (tags.length === 0) return null;
  return <span style={{ display: "inline-flex", gap: 4, flexWrap: "wrap", verticalAlign: "middle" }}>{tags}</span>;
}
