"use client";

import {
	CANCEL_GAME,
	CHECK_IN_PLAYER,
	COMPLETE_GAME,
	FILL_COURT_MANUALLY,
	GENERATE_NEXT_GAME,
	SESSION_DASHBOARD_QUERY,
	UPDATE_GAME_RESULT,
	UPDATE_GAME_TEAMS,
} from "@/graphql/documents/organiser";
import { useMutation, useQuery } from "@apollo/client";
import { App, Button, Empty, Input, Typography } from "antd";
import { useEffect, useState } from "react";
import {
	ScoreEntryForm,
	type ScoreEntryValues,
} from "@/components/ScoreEntryForm";
import { CourtCard } from "./CourtCard";
import type { SessionStats } from "@/app/dashboard/sessions/[sessionId]/page";

const { Text } = Typography;

function formatWait(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

function waitMinutes(queueEnteredAt: string) {
	return Math.max(
		0,
		Math.round((Date.now() - new Date(queueEnteredAt).getTime()) / 60000),
	);
}

export function OverviewTab({
	sessionId,
	onStats,
}: {
	sessionId: string;
	onStats?: (s: SessionStats) => void;
}) {
	const { message } = App.useApp();
	const { data, loading, error, refetch } = useQuery(SESSION_DASHBOARD_QUERY, {
		variables: { id: sessionId },
		pollInterval: 6000,
	});

	const [generateNextGame, { loading: generating }] =
		useMutation(GENERATE_NEXT_GAME);
	const [fillCourtManually, { loading: fillingManually }] =
		useMutation(FILL_COURT_MANUALLY);
	const [updateGameTeams, { loading: updatingTeams }] =
		useMutation(UPDATE_GAME_TEAMS);
	const [completeGame, { loading: completing }] = useMutation(COMPLETE_GAME);
	const [updateGameResult, { loading: switching }] =
		useMutation(UPDATE_GAME_RESULT);
	const [cancelGame] = useMutation(CANCEL_GAME);
	const [checkInPlayer] = useMutation(CHECK_IN_PLAYER);

	const [scoreGame, setScoreGame] = useState<any>(null);
	const [editResultGame, setEditResultGame] = useState<any>(null);
	const [queueSearch, setQueueSearch] = useState("");
	const [alertDismissed, setAlertDismissed] = useState(false);
	const [queuePage, setQueuePage] = useState(1);
	const QUEUE_PAGE_SIZE = 10;

	const session = data?.session;

	const queuedPlayers: any[] = session?.queuedPlayers ?? [];
	const checkedIn =
		session?.players.filter((p: any) => p.checkedIn).length ?? 0;
	const onCourt =
		session?.activeGames.reduce(
			(n: number, g: any) =>
				n + g.teamA.players.length + g.teamB.players.length,
			0,
		) ?? 0;
	const gamesDone = session?.completedGames.length ?? 0;
	const longestWaitMins =
		queuedPlayers.length > 0
			? Math.max(
					...queuedPlayers.map((p: any) => waitMinutes(p.queueEnteredAt)),
				)
			: 0;

	// Bubble stats up to parent BEFORE any early returns (Rules of Hooks)
	useEffect(() => {
		if (session) onStats?.({ checkedIn, onCourt, gamesDone, longestWaitMins });
	}, [session, checkedIn, onCourt, gamesDone, longestWaitMins, onStats]);

	// Auto-revert to a valid page if current page exceeds total pages
	useEffect(() => {
		if (queuePage > totalQueuePages && totalQueuePages > 0) {
			setQueuePage(totalQueuePages);
		} else if (totalQueuePages === 0 && queuePage !== 1) {
			setQueuePage(1);
		}
	}, [totalQueuePages, queuePage]);

	if (loading && !data) return null;
	if (error) return <Empty description={error.message} />;
	if (!session) return <Empty description="Session not found" />;

	// On deck: next 4 from queue
	const onDeckPlayers: any[] = queuedPlayers.slice(0, 4);

	// Find which court is finishing soonest (first court with active game)
	const nextOffCourt =
		session.courts.find((c: any) => c.currentGame) ?? session.courts[0];

	// Queue warning: avg game ~13min, estimate wait
	const avgGameMin = 13;
	const courtsCount = session.courts.length;
	const estimatedWaitMin =
		courtsCount > 0
			? Math.round((queuedPlayers.length / courtsCount) * avgGameMin)
			: 0;
	const showAlert = !alertDismissed && estimatedWaitMin >= 60;

	// Scoring mode label
	const scoringMode = session.settings?.scoring?.pointsTarget
		? `TO ${session.settings.scoring.pointsTarget}`
		: "WIN/LOSS ONLY · NO SCORE ENTRY";

	// Filtered queue
	const filteredQueue = queuedPlayers.filter((p: any) =>
		p.name.toLowerCase().includes(queueSearch.toLowerCase()),
	);
	const totalQueuePages = Math.ceil(filteredQueue.length / QUEUE_PAGE_SIZE);
	const pagedQueue = filteredQueue.slice(
		(queuePage - 1) * QUEUE_PAGE_SIZE,
		queuePage * QUEUE_PAGE_SIZE,
	);

	async function handleGenerate(courtId: string) {
		try {
			await generateNextGame({ variables: { sessionId: session.id, courtId } });
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not generate a game",
			);
		}
	}

	async function handleUpdateTeams(
		gameId: string,
		teamAPlayerIds: string[],
		teamBPlayerIds: string[],
	) {
		try {
			await updateGameTeams({
				variables: { id: gameId, teamAPlayerIds, teamBPlayerIds },
			});
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not update lineup",
			);
		}
	}

	async function handleScoreSubmit(values: ScoreEntryValues) {
		try {
			await completeGame({ variables: { id: scoreGame.id, input: values } });
			setScoreGame(null);
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not record result",
			);
		}
	}

	async function handleRecordResult(game: any, _winner: "A" | "B") {
		// Always open the result form so the organiser picks the winner
		setScoreGame(game);
	}

	async function handleEditResultSubmit(values: ScoreEntryValues) {
		try {
			await updateGameResult({ variables: { id: editResultGame.id, input: values } });
			setEditResultGame(null);
			refetch();
			message.success("Result updated");
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not update result",
			);
		}
	}

	async function handleCancelGame(gameId: string) {
		try {
			await cancelGame({ variables: { id: gameId } });
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not cancel game",
			);
		}
	}

	async function handleAddToQueue(playerId: string) {
		try {
			await checkInPlayer({ variables: { id: playerId, checkedIn: true } });
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not add player",
			);
		}
	}

	return (
		<div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
			<style>{`
				.queue-row:hover { background: #fdf2f8; }
			`}</style>

			{/* ── Alert Banner ── */}
			{showAlert && (
				<div
					style={{
						background: "#fff0f5",
						borderBottom: "1px solid #fbb6ce",
						padding: "14px 24px",
						display: "flex",
						alignItems: "center",
						gap: 12,
						minHeight: 56,
					}}
				>
					<span style={{ fontSize: 15, color: "#e11d74", flexShrink: 0 }}>
						ⓘ
					</span>
					<Text style={{ fontSize: 13, flex: 1, color: "#111827" }}>
						{queuedPlayers.length} players waiting on {courtsCount} courts. At ~
						{avgGameMin} minutes a game that is a{" "}
						<strong style={{ color: "#e11d74" }}>
							{formatWait(estimatedWaitMin)} queue
						</strong>{" "}
						— open more courts, shorten games to 9 points, or cap the session
						roster.
					</Text>
					<div
						style={{
							display: "flex",
							gap: 4,
							flexShrink: 0,
							alignItems: "center",
						}}
					>
						<Button
							style={{
								background: "transparent",
								borderColor: "#652626ff",
								borderWidth: 1,
								color: "#111827",
								fontWeight: 600,
								height: 34,
								fontSize: 13,
							}}
						>
							Add a court
						</Button>
						<button
							style={{
								background: "none",
								border: "none",
								cursor: "pointer",
								color: "#8d1a3f",
								fontWeight: 600,
								fontSize: 13,
								padding: "0 12px",
								height: 34,
							}}
							onClick={() => setAlertDismissed(true)}
						>
							Dismiss
						</button>
					</div>
				</div>
			)}

			{/* ── Main content: courts + queue ── */}
			<div
				style={{ display: "grid", gridTemplateColumns: "1fr 420px", flex: 1 }}
			>
				{/* Left: courts + on deck + last games */}
				<div
					style={{ borderRight: "1px solid rgba(138,39,72,0.12)", minWidth: 0 }}
				>
					{/* Courts header */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							padding: "14px 20px 10px",
							borderBottom: "1px solid rgba(138,39,72,0.08)",
						}}
					>
						<span
							style={{
								fontSize: 11,
								fontWeight: 700,
								letterSpacing: "0.2em",
								textTransform: "uppercase",
								color: "#1d1f20",
							}}
						>
							Courts
						</span>
						<span
							style={{
								fontSize: 10,
								fontWeight: 600,
								letterSpacing: "0.12em",
								textTransform: "uppercase",
								color: "rgba(29,31,32,0.4)",
							}}
						>
							{scoringMode}
						</span>
					</div>

					{/* Court cards grid */}
					<div
						style={{
							display: "grid",
							gridTemplateColumns: session.courts.length === 1
								? "1fr"
								: session.courts.length === 2
								? "repeat(2, 1fr)"
								: session.courts.length === 3
								? "repeat(3, 1fr)"
								: "repeat(auto-fill, minmax(240px, 1fr))",
							gap: 16,
							padding: 20,
						}}
					>
						{session.courts.map((court: any) => (
							<CourtCard
								key={court.id}
								court={court}
								generating={generating || fillingManually}
								sessionActive={session.status === "ACTIVE"}
								allPlayers={session.players.filter(
									(p: any) => p.checkedIn || p.active,
								)}
								queuedPlayers={queuedPlayers}
								updatingTeams={updatingTeams}
								onFill={handleGenerate}
								onRecordResult={handleRecordResult}
								onCancelGame={handleCancelGame}
								onUpdateTeams={handleUpdateTeams}
							/>
						))}
					</div>

					{/* On deck banner */}
					{queuedPlayers.length > 0 && (
						<div
							style={{
								background: "#3d0a1e",
								color: "#fff",
								margin: "0 20px 20px",
								padding: "16px 20px",
								display: "flex",
								alignItems: "center",
								gap: 32,
							}}
						>
							<div style={{ flex: 1, minWidth: 0, display: "flex", gap: 32 }}>
								{/* Group 1 — next 4 */}
								{queuedPlayers.slice(0, 4).length > 0 && (
									<div>
										<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
											ON DECK · NEXT OFF {nextOffCourt ? `COURT ${nextOffCourt.courtNumber}` : "COURT"}
										</div>
										<div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
											{queuedPlayers.slice(0, 4).map((p: any) => (
												<span key={p.id} style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
													{p.name}
												</span>
											))}
										</div>
									</div>
								)}
								{/* Group 2 — players 5–8 */}
								{queuedPlayers.slice(4, 8).length > 0 && (
									<div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: 32 }}>
										<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
											AFTER THAT
										</div>
										<div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
											{queuedPlayers.slice(4, 8).map((p: any) => (
												<span key={p.id} style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.65 }}>
													{p.name}
												</span>
											))}
										</div>
									</div>
								)}
							</div>
							<div style={{ flexShrink: 0 }}>
								<Button
									style={{ background: "transparent", borderColor: "rgba(255,255,255,0.5)", color: "#fff", fontWeight: 600 }}
								>
									Redraw
								</Button>
							</div>
						</div>
					)}

					{/* Last games */}
					<div style={{ padding: "28px 24px 24px" }}>
							{/* Header row: LAST GAMES + rule + All games link */}
							<div
								style={{
									display: "flex",
									alignItems: "center",
									gap: 16,
									marginBottom: 4,
								}}
							>
								<span
									style={{
										fontSize: 12,
										fontWeight: 800,
										letterSpacing: "0.18em",
										textTransform: "uppercase",
										color: "#1d1f20",
										fontFamily: "'Barlow Condensed', sans-serif",
										whiteSpace: "nowrap",
									}}
								>
									Last Games
								</span>
								<div
									style={{
										flex: 1,
										height: 1,
										background: "rgba(29,31,32,0.12)",
									}}
								/>
								<button
									style={{
										background: "none",
										border: "none",
										fontSize: 13,
										fontWeight: 500,
										color: "#e11d74",
										cursor: "pointer",
										padding: 0,
										textDecoration: "underline",
										fontStyle: "italic",
										whiteSpace: "nowrap",
									}}
								>
									All games
								</button>
							</div>

							{/* Game rows */}
							{session.completedGames.length === 0 ? (
								<div style={{ padding: "20px 0", textAlign: "center" }}>
									<Text style={{ fontSize: 13, color: "rgba(29,31,32,0.38)" }}>
										No completed games yet
									</Text>
								</div>
							) : (
							<div style={{ display: "flex", flexDirection: "column" }}>
								{[...session.completedGames]
									.sort((a: any, b: any) =>
										(b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
									)
									.slice(0, 5)
									.map((game: any) => {
										const teamA = game.teamA.players
											.map((p: any) => p.name)
											.join(" / ");
										const teamB = game.teamB.players
											.map((p: any) => p.name)
											.join(" / ");
										const winner = game.winningTeam === "A" ? teamA : teamB;
										const loser = game.winningTeam === "A" ? teamB : teamA;
										const time = game.completedAt
											? new Date(game.completedAt).toLocaleTimeString("en-US", {
													hour: "2-digit",
													minute: "2-digit",
													hour12: false,
												})
											: "";
										const courtLabel = game.court
											? `COURT ${game.court.courtNumber}`
											: "";
										const durationMin =
											game.startedAt && game.completedAt
												? Math.round(
														(new Date(game.completedAt).getTime() -
															new Date(game.startedAt).getTime()) /
															60000,
													)
												: null;
										return (
											<div
												key={game.id}
												style={{
													display: "flex",
													alignItems: "center",
													gap: 20,
													padding: "14px 0",
													borderBottom: "1px solid rgba(29,31,32,0.07)",
												}}
											>
												{/* Time */}
												<span
													style={{
														fontSize: 14,
														fontWeight: 700,
														color: "#e11d74",
														fontFamily: "'Barlow Condensed', sans-serif",
														width: 44,
														flexShrink: 0,
													}}
												>
													{time}
												</span>

												{/* Result text: "TeamA vs TeamB · Winner Won" */}
												<p style={{ flex: 1, fontSize: 13.5, color: "#1d1f20", minWidth: 0, margin: 0, lineHeight: 1.5 }}>
													{teamA}{" "}
													<span style={{ color: "rgba(29,31,32,0.4)", fontWeight: 400 }}>vs</span>{" "}
													{teamB}
													<span style={{ color: "rgba(29,31,32,0.35)", margin: "0 6px" }}>·</span>
													<span style={{
														display: "inline-block",
														background: "#fff0f5",
														border: "1px solid #fbb6ce",
														color: "#e11d74",
														fontWeight: 700,
														fontSize: 12,
														borderRadius: 4,
														padding: "1px 8px",
														lineHeight: "20px",
													}}>
														{winner} Won
													</span>
												</p>

												{/* Court · duration */}
												<span
													style={{
														fontSize: 11,
														fontWeight: 600,
														color: "rgba(29,31,32,0.38)",
														letterSpacing: "0.1em",
														textTransform: "uppercase",
														whiteSpace: "nowrap",
														flexShrink: 0,
													}}
												>
													{courtLabel}
													{durationMin ? ` · ${durationMin} MIN` : ""}
												</span>

												{/* Undo result button */}
												<button
													title="Undo result"
													onClick={() => setEditResultGame(game)}
													style={{
														background: "none",
														border: "1px solid rgba(29,31,32,0.2)",
														borderRadius: 4,
														cursor: "pointer",
														color: "rgba(29,31,32,0.5)",
														fontSize: 11,
														fontWeight: 600,
														letterSpacing: "0.05em",
														padding: "3px 10px",
														flexShrink: 0,
														whiteSpace: "nowrap",
													}}
												>
													Undo
												</button>
											</div>
										);
									})}
							</div>
							)}
						</div>
				</div>

				{/* Right: Waiting Queue */}
				<div style={{ display: "flex", flexDirection: "column" }}>
					<div
						style={{
							padding: "14px 16px 10px",
							borderBottom: "1px solid rgba(138,39,72,0.08)",
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
						}}
					>
						<span
							style={{
								fontSize: 11,
								fontWeight: 700,
								letterSpacing: "0.2em",
								textTransform: "uppercase",
								color: "#1d1f20",
							}}
						>
							Waiting Queue
						</span>
						{queuedPlayers.length > 0 && (
							<span style={{ fontSize: 11, fontWeight: 700, color: "#e11d74" }}>
								{queuedPlayers.length} waiting
							</span>
						)}
					</div>

					{/* Search + add */}
					<div
						style={{
							padding: "12px 16px",
							borderBottom: "1px solid rgba(138,39,72,0.08)",
							display: "flex",
							gap: 8,
						}}
					>
						<Input
							placeholder="Search or add a player..."
							value={queueSearch}
							onChange={(e) => { setQueueSearch(e.target.value); setQueuePage(1); }}
							style={{ flex: 1 }}
						/>
						<Button
							type="primary"
							style={{ background: "#e11d74", borderColor: "#e11d74" }}
							onClick={() => {
								const player = session.players.find(
									(p: any) =>
										p.name.toLowerCase() === queueSearch.toLowerCase() &&
										!p.checkedIn,
								);
								if (player) {
									handleAddToQueue(player.id);
									setQueueSearch("");
								} else
									message.warning("Player not found or already checked in");
							}}
						>
							Add
						</Button>
					</div>

					{/* Queue list */}
					<div>
						{filteredQueue.length === 0 ? (
							<div style={{ padding: 20, textAlign: "center" }}>
								<Text type="secondary" style={{ fontSize: 13 }}>
									No one waiting
								</Text>
							</div>
						) : (
							<>
								{pagedQueue.map((player: any) => {
									const globalIdx = filteredQueue.indexOf(player);
									const mins = waitMinutes(player.queueEnteredAt);
									const isLong = mins >= 60;
									return (
										<div
											key={player.id}
											className="queue-row"
											style={{
												display: "flex",
												alignItems: "center",
												gap: 12,
												padding: "10px 16px",
												borderBottom: "1px solid rgba(138,39,72,0.07)",
												cursor: "default",
											}}
										>
											<span
												style={{
													fontSize: 13,
													fontWeight: 700,
													color: "#e11d74",
													fontFamily: "'Barlow Condensed', sans-serif",
													width: 18,
													flexShrink: 0,
												}}
											>
												{globalIdx + 1}
											</span>
											<div style={{ flex: 1, minWidth: 0 }}>
												<div style={{ fontSize: 14, fontWeight: 600, color: "#1d1f20" }}>
													{player.name}
												</div>
												<div style={{ fontSize: 11, color: "rgba(29,31,32,0.45)" }}>
													{player.gamesSatOut > 0
														? `Sat out ${player.gamesSatOut} rounds · `
														: "In queue · "}
													{player.gamesPlayed}{" "}
													{player.gamesPlayed === 1 ? "game" : "games"}
												</div>
											</div>
											<span
												style={{
													fontSize: 12,
													fontWeight: 700,
													color: isLong ? "#e11d74" : "rgba(29,31,32,0.45)",
													flexShrink: 0,
												}}
											>
												{mins > 0 ? formatWait(mins) : "—"}
											</span>
										</div>
									);
								})}

								{/* Pagination footer */}
								<div
									style={{
										padding: "10px 16px",
										borderTop: "1px solid rgba(138,39,72,0.08)",
										display: "flex",
										alignItems: "center",
										justifyContent: "space-between",
									}}
								>
									<Text type="secondary" style={{ fontSize: 11 }}>
										{(queuePage - 1) * QUEUE_PAGE_SIZE + 1}–{Math.min(queuePage * QUEUE_PAGE_SIZE, filteredQueue.length)} of {filteredQueue.length} · sorted by wait
									</Text>
									{totalQueuePages > 1 && (
										<div style={{ display: "flex", gap: 4, alignItems: "center" }}>
											<button
												disabled={queuePage === 1}
												onClick={() => setQueuePage(p => p - 1)}
												style={{
													background: "none",
													border: "1px solid rgba(29,31,32,0.2)",
													borderRadius: 4,
													cursor: queuePage === 1 ? "default" : "pointer",
													color: queuePage === 1 ? "rgba(29,31,32,0.25)" : "#1d1f20",
													fontSize: 12,
													padding: "2px 8px",
													lineHeight: "18px",
												}}
											>
												‹
											</button>
											<span style={{ fontSize: 11, color: "rgba(29,31,32,0.5)", padding: "0 4px" }}>
												{queuePage} / {totalQueuePages}
											</span>
											<button
												disabled={queuePage === totalQueuePages}
												onClick={() => setQueuePage(p => p + 1)}
												style={{
													background: "none",
													border: "1px solid rgba(29,31,32,0.2)",
													borderRadius: 4,
													cursor: queuePage === totalQueuePages ? "default" : "pointer",
													color: queuePage === totalQueuePages ? "rgba(29,31,32,0.25)" : "#1d1f20",
													fontSize: 12,
													padding: "2px 8px",
													lineHeight: "18px",
												}}
											>
												›
											</button>
										</div>
									)}
								</div>
							</>
						)}
					</div>
				</div>
			</div>

			<ScoreEntryForm
				open={!!scoreGame}
				game={scoreGame}
				loading={completing}
				onCancel={() => setScoreGame(null)}
				onSubmit={handleScoreSubmit}
			/>

			<ScoreEntryForm
				open={!!editResultGame}
				game={editResultGame}
				loading={switching}
				onCancel={() => setEditResultGame(null)}
				onSubmit={handleEditResultSubmit}
			/>
		</div>
	);
}
