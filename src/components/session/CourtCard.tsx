"use client";

import { useState, useEffect, useRef } from "react";
import { Button, Select, Typography, Tooltip } from "antd";
import { ClockCircleOutlined, SwapOutlined, CheckOutlined, CloseOutlined, EditOutlined } from "@ant-design/icons";

const { Text } = Typography;

function formatClock(seconds: number) {
	const m = Math.floor(seconds / 60);
	const s = seconds % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

/** Live game clock — counts up from game.startedAt */
function GameClock({ startedAt }: { startedAt?: string }) {
	const [secs, setSecs] = useState(0);
	const ref = useRef<ReturnType<typeof setInterval> | null>(null);

	useEffect(() => {
		if (!startedAt) return;
		const start = new Date(startedAt).getTime();
		const tick = () => setSecs(Math.max(0, Math.floor((Date.now() - start) / 1000)));
		tick();
		ref.current = setInterval(tick, 1000);
		return () => { if (ref.current) clearInterval(ref.current); };
	}, [startedAt]);

	if (!startedAt) return null;
	return (
		<span style={{ fontSize: 16, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#e11d74", letterSpacing: "0.04em" }}>
			{formatClock(secs)}
		</span>
	);
}

/** Build Select options: queued first, then other eligible players */
function buildOptions(
	pickablePlayers: any[],
	queuedIds: Set<string>,
	queueOrder: Map<string, number>,
	excluded: string[],
) {
	const available = pickablePlayers.filter((p: any) => !excluded.includes(p.id));
	const queued = available
		.filter((p: any) => queuedIds.has(p.id))
		.sort((a: any, b: any) => (queueOrder.get(a.id) ?? 99) - (queueOrder.get(b.id) ?? 99));
	const rest = available.filter((p: any) => !queuedIds.has(p.id));
	const toOption = (p: any, inQueue: boolean, pos?: number) => ({
		value: p.id,
		label: p.name,
		inQueue,
		queuePos: pos,
		gamesPlayed: p.gamesPlayed ?? 0,
	});
	return [
		...queued.map((p: any, i: number) => toOption(p, true, i + 1)),
		...rest.map((p: any) => toOption(p, false)),
	];
}

interface CourtCardProps {
	court: any;
	generating?: boolean;
	sessionActive?: boolean;
	allPlayers?: any[];
	queuedPlayers?: any[];
	updatingTeams?: boolean;
	onFill: (courtId: string) => void;
	onRecordResult: (game: any, winner: "A" | "B") => void;
	onCancelGame?: (gameId: string) => void;
	onUpdateTeams?: (gameId: string, teamAPlayerIds: string[], teamBPlayerIds: string[]) => Promise<void>;
	onRemove?: (courtId: string) => void;
}

export function CourtCard({
	court,
	generating,
	sessionActive = true,
	allPlayers = [],
	queuedPlayers = [],
	updatingTeams,
	onFill,
	onRecordResult,
	onCancelGame,
	onUpdateTeams,
	onRemove,
}: CourtCardProps) {
	const [editing, setEditing] = useState(false);
	const [editTeamA, setEditTeamA] = useState<string[]>([]);
	const [editTeamB, setEditTeamB] = useState<string[]>([]);

	const currentCourtPlayerIds = new Set([
		...(court.currentGame?.teamA.players.map((p: any) => p.id) ?? []),
		...(court.currentGame?.teamB.players.map((p: any) => p.id) ?? []),
	]);
	const queuedIds = new Set(queuedPlayers.map((p: any) => p.id));
	const queueOrder = new Map(queuedPlayers.map((p: any, i: number) => [p.id, i + 1]));
	const pickablePlayers = allPlayers.filter(
		(p: any) => currentCourtPlayerIds.has(p.id) || queuedIds.has(p.id),
	);
	const teamAOptions = buildOptions(pickablePlayers, queuedIds, queueOrder, editTeamB);
	const teamBOptions = buildOptions(pickablePlayers, queuedIds, queueOrder, editTeamA);

	function startEditing() {
		if (!court.currentGame) return;
		setEditTeamA(court.currentGame.teamA.players.map((p: any) => p.id));
		setEditTeamB(court.currentGame.teamB.players.map((p: any) => p.id));
		setEditing(true);
	}

	async function saveEditing() {
		if (!onUpdateTeams || !court.currentGame) return;
		await onUpdateTeams(court.currentGame.id, editTeamA, editTeamB);
		setEditing(false);
	}

	const game = court.currentGame;

	return (
		<div style={{ border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", overflow: "hidden" }}>

			{/* ── Court header ── */}
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 18px 10px" }}>
				<span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: "0.12em", textTransform: "uppercase", color: "#1d1f20" }}>
					{court.name || `Court ${court.courtNumber}`}
				</span>
				<div style={{ display: "flex", alignItems: "center", gap: 8 }}>
					{game?.startedAt && <GameClock startedAt={game.startedAt} />}
					{game && !editing && onUpdateTeams && (
						<Tooltip title="Edit lineup">
							<button
								onClick={startEditing}
								style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,31,32,0.35)", padding: "2px 4px", lineHeight: 1, display: "flex", alignItems: "center" }}
							>
								<EditOutlined style={{ fontSize: 13 }} />
							</button>
						</Tooltip>
					)}
					{onRemove && (
						<Tooltip title="Remove court">
							<button
								onClick={() => onRemove(court.id)}
								style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,31,32,0.35)", padding: "2px 4px", lineHeight: 1, display: "flex", alignItems: "center", fontSize: 18 }}
							>
								×
							</button>
						</Tooltip>
					)}
				</div>
			</div>

			{game ? (
				editing ? (
					/* ── Edit lineup mode ── */
					<div style={{ padding: "0 18px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
						<div>
							<div style={{ fontSize: 10, fontWeight: 700, color: "#e11d74", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Team A</div>
							<Select mode="multiple" size="small" style={{ width: "100%" }} value={editTeamA} onChange={setEditTeamA}
								placeholder="Search players…" showSearch
								filterOption={(input, opt: any) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
								options={teamAOptions}
								optionRender={(opt) => (
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ fontWeight: opt.data.inQueue ? 600 : 400 }}>
											{opt.label}{opt.data.inQueue && <ClockCircleOutlined style={{ color: "#e11d74", fontSize: 10, marginLeft: 4 }} />}
										</span>
										<Text type="secondary" style={{ fontSize: 11 }}>{opt.data.inQueue ? `#${opt.data.queuePos}` : `${opt.data.gamesPlayed}g`}</Text>
									</div>
								)}
							/>
						</div>
						<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
							<div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
							<SwapOutlined style={{ color: "#9ca3af", fontSize: 11 }} />
							<div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
						</div>
						<div>
							<div style={{ fontSize: 10, fontWeight: 700, color: "#e11d74", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>Team B</div>
							<Select mode="multiple" size="small" style={{ width: "100%" }} value={editTeamB} onChange={setEditTeamB}
								placeholder="Search players…" showSearch
								filterOption={(input, opt: any) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
								options={teamBOptions}
								optionRender={(opt) => (
									<div style={{ display: "flex", justifyContent: "space-between" }}>
										<span style={{ fontWeight: opt.data.inQueue ? 600 : 400 }}>
											{opt.label}{opt.data.inQueue && <ClockCircleOutlined style={{ color: "#e11d74", fontSize: 10, marginLeft: 4 }} />}
										</span>
										<Text type="secondary" style={{ fontSize: 11 }}>{opt.data.inQueue ? `#${opt.data.queuePos}` : `${opt.data.gamesPlayed}g`}</Text>
									</div>
								)}
							/>
						</div>
						<div style={{ display: "flex", gap: 6 }}>
							<Button size="small" block icon={<CloseOutlined />} onClick={() => setEditing(false)}>Cancel</Button>
							<Button size="small" type="primary" block icon={<CheckOutlined />} loading={updatingTeams} onClick={saveEditing}
								style={{ background: "#e11d74", borderColor: "#e11d74" }}>Save</Button>
						</div>
					</div>
				) : (
					/* ── Live game view ── */
					<div>
						{/* Teams row */}
						<div style={{ display: "grid", gridTemplateColumns: "1fr 32px 1fr", alignItems: "start", padding: "2px 18px 14px" }}>
							{/* Team A */}
							<div>
								<div style={{ fontSize: 9, fontWeight: 700, color: "#e11d74", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 5 }}>TEAM A</div>
								{game.teamA.players.map((p: any) => (
									<div key={p.id} style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1.3, textTransform: "uppercase" }}>
										{p.name}
									</div>
								))}
							</div>
							{/* VS */}
							<div style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 18 }}>
								<span style={{ fontSize: 11, fontWeight: 600, color: "rgba(29,31,32,0.3)", letterSpacing: "0.06em" }}>VS</span>
							</div>
							{/* Team B */}
							<div style={{ textAlign: "right" }}>
								<div style={{ fontSize: 9, fontWeight: 700, color: "#e11d74", textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 5 }}>TEAM B</div>
								{game.teamB.players.map((p: any) => (
									<div key={p.id} style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1.3, textTransform: "uppercase" }}>
										{p.name}
									</div>
								))}
							</div>
						</div>

						{/* Divider */}
						<div style={{ height: 1, background: "#f3f4f6", margin: "0 18px" }} />

						{/* Record Result + Cancel */}
						<div style={{ padding: "12px 18px 14px" }}>
							<Button block
								style={{
									background: "#e11d74", borderColor: "#e11d74", color: "#fff",
									fontWeight: 700, fontSize: 13, fontFamily: "'Barlow Condensed', sans-serif",
									letterSpacing: "0.1em", textTransform: "uppercase", height: 40,
									marginBottom: 10,
								}}
								onClick={() => onRecordResult(game, "A")}
							>
								Record Result
							</Button>
							<div style={{ textAlign: "center" }}>
								<button
									style={{ background: "none", border: "none", color: "rgba(29,31,32,0.4)", fontSize: 12, cursor: "pointer", padding: 0 }}
									onClick={() => onCancelGame?.(game.id)}
								>
									Cancel game
								</button>
							</div>
						</div>
					</div>
				)
			) : (
				/* ── Empty court ── */
				<div style={{ padding: "8px 18px 16px" }}>
					<Tooltip title={!sessionActive ? "Start the session to fill courts" : ""}>
						<Button
							type="dashed"
							block
							disabled={!sessionActive}
							loading={generating && queuedPlayers.length > 0}
							onClick={() => onFill(court.id)}
							style={{ borderRadius: 6, fontWeight: 600 }}
						>
							Fill Court
						</Button>
					</Tooltip>
				</div>
			)}
		</div>
	);
}
