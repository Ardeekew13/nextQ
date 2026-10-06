"use client";

import {
	ADD_COURT,
	CANCEL_GAME,
	CHECK_IN_PLAYER,
	DELETE_COURT,
	FILL_COURT_MANUALLY,
	GENERATE_NEXT_GAME,
	SEPARATE_PLAYERS,
	SESSION_DASHBOARD_QUERY,
	SESSION_QUEUE_SNAPSHOT,
	UPDATE_GAME_RESULT,
	UPDATE_GAME_TEAMS,
	CLUB_DETAIL_QUERY,
} from "@/graphql/documents/organiser";
import { useMutation, useQuery } from "@apollo/client";
import { App, Button, Empty, Input, Typography } from "antd";
import { useEffect, useMemo, useRef, useState } from "react";
import {
	ScoreEntryForm,
	type ScoreEntryValues,
} from "@/components/ScoreEntryForm";
import { CourtCard } from "./CourtCard";
import { useOfflineResults } from "@/apollo/OfflineResultsProvider";
import {
	deriveLocalState,
	generateLocalGame,
	isLocalGameId,
	rankLocalQueue,
	type QueueSnapshot,
} from "@/lib/offlineQueue";
import { isNetworkFailure, loadPending, loadSnapshot, saveSnapshot } from "@/lib/offlineResults";
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

function announceMatchup(
	teamA: { players: { name: string }[] },
	teamB: { players: { name: string }[] },
	courtName?: string,
) {
	if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
	const teamAName = teamA.players.map((p) => p.name).join(" and ");
	const teamBName = teamB.players.map((p) => p.name).join(" and ");
	const courtPart = courtName ? `${courtName}: ` : "";
	const text = `${courtPart}Team A, ${teamAName}, versus Team B, ${teamBName}`;
	const utterance = new SpeechSynthesisUtterance(text);
	utterance.rate = 0.8;
	window.speechSynthesis.cancel();
	window.speechSynthesis.speak(utterance);
}

export function OverviewTab({
	sessionId,
	onStats,
}: {
	sessionId: string;
	onStats?: (s: SessionStats) => void;
}) {
	const { message, modal } = App.useApp();
	const { data, loading, error, refetch } = useQuery(SESSION_DASHBOARD_QUERY, {
		variables: { id: sessionId },
	});

	const [generateNextGame, { loading: generating }] =
		useMutation(GENERATE_NEXT_GAME);
	const [fillCourtManually, { loading: fillingManually }] =
		useMutation(FILL_COURT_MANUALLY);
	const [updateGameTeams, { loading: updatingTeams }] =
		useMutation(UPDATE_GAME_TEAMS);
	const offline = useOfflineResults();
	const [updateGameResult, { loading: switching }] =
		useMutation(UPDATE_GAME_RESULT);
	const [cancelGame] = useMutation(CANCEL_GAME);
	const [checkInPlayer] = useMutation(CHECK_IN_PLAYER);
	const [separatePlayers, { loading: separating }] = useMutation(SEPARATE_PLAYERS, {
		refetchQueries: [{ query: SESSION_DASHBOARD_QUERY, variables: { id: sessionId } }],
		awaitRefetchQueries: true,
	});
	const [addCourt, { loading: addingCourt }] = useMutation(ADD_COURT, {
		refetchQueries: [{ query: SESSION_DASHBOARD_QUERY, variables: { id: sessionId } }],
	});
	const [deleteCourt] = useMutation(DELETE_COURT, {
		refetchQueries: [
			{ query: SESSION_DASHBOARD_QUERY, variables: { id: sessionId } },
		],
		awaitRefetchQueries: true,
	});

	const [scoreGame, setScoreGame] = useState<any>(null);
	const [editResultGame, setEditResultGame] = useState<any>(null);
	const [queueSearch, setQueueSearch] = useState("");
	const [alertDismissed, setAlertDismissed] = useState(false);
	const [expandedTogether, setExpandedTogether] = useState<Record<string, boolean>>({});
	const [queuePage, setQueuePage] = useState(1);
	const QUEUE_PAGE_SIZE = 10;

	// ── Offline overlay ──
	// The queue state is kept on this device. While anything is waiting to sync (or the
	// connection is down) the courts, queue and next-game preview are derived locally by
	// replaying what the organiser did on top of the last server snapshot.
	const [snapshot, setSnapshot] = useState<QueueSnapshot | null>(null);
	const { data: snapData, refetch: refetchSnapshot } = useQuery(SESSION_QUEUE_SNAPSHOT, {
		variables: { sessionId },
		fetchPolicy: "network-only",
		errorPolicy: "ignore",
	});
	const sessionOps = useMemo(
		() => offline.pending.filter((p) => p.sessionId === sessionId),
		[offline.pending, sessionId],
	);

	useEffect(() => {
		setSnapshot((cur) => cur ?? loadSnapshot(sessionId));
	}, [sessionId]);

	useEffect(() => {
		const raw = snapData?.sessionQueueSnapshot;
		if (!raw) return;
		// A snapshot taken while results/games are still waiting would be applied twice.
		if (loadPending().some((p) => p.sessionId === sessionId)) return;
		try {
			const parsed = JSON.parse(raw) as QueueSnapshot;
			setSnapshot(parsed);
			saveSnapshot(parsed);
		} catch {
			/* keep the previous snapshot */
		}
	}, [snapData, sessionId]);

	// Keep the snapshot in step with the dashboard whenever it reloads.
	const lastDashboard = useRef<unknown>(null);
	useEffect(() => {
		if (!data) return;
		if (lastDashboard.current && lastDashboard.current !== data && offline.online && sessionOps.length === 0) {
			void refetchSnapshot();
		}
		lastDashboard.current = data;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data]);

	const local = useMemo(
		() => (snapshot && sessionOps.length > 0 ? deriveLocalState(snapshot, sessionOps) : null),
		[snapshot, sessionOps],
	);

	const session = useMemo(() => {
		const base = data?.session;
		if (!base || !snapshot || !local) return base;
		const names = new Map(snapshot.players.map((p) => [p.id, p.name]));
		const team = (ids: string[]) => ({ players: ids.map((id) => ({ id, name: names.get(id) ?? "Player" })) });
		const courts = base.courts.map((c: any) => {
			const lc = local.courts.find((x) => x.id === c.id);
			if (!lc) return c;
			let currentGame = c.currentGame;
			if ((currentGame?.id ?? null) !== lc.currentGameId) {
				const g = local.activeGames.find((x) => x.id === lc.currentGameId);
				currentGame = g
					? {
							__typename: "Game",
							id: g.id,
							gameNumber: g.gameNumber,
							winningTeam: null,
							losingTeam: null,
							status: g.status,
							startedAt: g.startedAt ?? null,
							completedAt: null,
							notes: null,
							court: { id: c.id, courtNumber: c.courtNumber, name: c.name },
							teamA: team(g.teamA),
							teamB: team(g.teamB),
						}
					: null;
			}
			return { ...c, status: lc.status, currentGame };
		});
		const queued = rankLocalQueue(snapshot, local).map((p) => ({
			id: p.id,
			name: p.name,
			gamesPlayed: p.gamesPlayed,
			gamesSatOut: p.gamesSatOut,
			queueEnteredAt: p.queueEnteredAt,
		}));
		const next = generateLocalGame(snapshot, local);
		return {
			...base,
			courts,
			queuedPlayers: queued,
			nextGamePreview: next.ok ? { teamA: team(next.teamA), teamB: team(next.teamB) } : null,
			activeGames: courts.filter((c: any) => c.currentGame).map((c: any) => c.currentGame),
		};
	}, [data, snapshot, local]);

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
	// Filtered queue
	const filteredQueue = queuedPlayers.filter((p: any) =>
		p.name.toLowerCase().includes(queueSearch.toLowerCase()),
	);
	const totalQueuePages = Math.ceil(filteredQueue.length / QUEUE_PAGE_SIZE);

	// Auto-revert to valid page if current page exceeds total pages
	if (queuePage > totalQueuePages && totalQueuePages > 0) {
		setQueuePage(totalQueuePages);
	} else if (totalQueuePages === 0 && queuePage !== 1) {
		setQueuePage(1);
	}

	const pagedQueue = filteredQueue.slice(
		(queuePage - 1) * QUEUE_PAGE_SIZE,
		queuePage * QUEUE_PAGE_SIZE,
	);

	async function handleGenerate(courtId: string) {
		// Generated on this device whenever the connection is down or earlier actions are still
		// waiting to sync (the server doesn't know about them yet).
		const fillHere = () => {
			if (!snapshot) {
				message.error("Can't generate games offline until this session has loaded once online.");
				return;
			}
			const state = deriveLocalState(snapshot, sessionOps);
			const court = state.courts.find((c) => c.id === courtId);
			if (!court || court.currentGameId) {
				message.error("That court is already in use.");
				return;
			}
			const picked = generateLocalGame(snapshot, state);
			if (!picked.ok) {
				message.error(picked.reason);
				return;
			}
			offline.fillCourt({
				sessionId,
				courtId,
				teamAPlayerIds: picked.teamA,
				teamBPlayerIds: picked.teamB,
				playersSatOutIds: picked.satOut,
			});
			const names = new Map(snapshot.players.map((p) => [p.id, p.name]));
			const team = (ids: string[]) => ({ players: ids.map((id) => ({ name: names.get(id) ?? "" })) });
			announceMatchup(team(picked.teamA), team(picked.teamB), court.name ?? `Court ${court.courtNumber}`);
		};
		if (snapshot && (!offline.online || sessionOps.length > 0)) {
			fillHere();
			return;
		}
		try {
			const result = await generateNextGame({ variables: { sessionId: session.id, courtId } });
			const game = result.data?.generateNextGame;
			if (game?.teamA && game?.teamB) {
				announceMatchup(game.teamA, game.teamB, game.court?.name ?? `Court ${game.court?.courtNumber}`);
			}
			refetch();
		} catch (err) {
			if (snapshot && isNetworkFailure(err)) {
				fillHere();
				return;
			}
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
		if (isLocalGameId(gameId)) {
			message.warning("This game was made offline. Edit its teams once it has synced.");
			return;
		}
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

	// Recording is instant: the result is stored on this device and sent in the background,
	// so it works with a flaky or missing connection and syncs once it's back.
	function handleScoreSubmit(values: ScoreEntryValues) {
		if (!scoreGame) return;
		offline.recordResult({
			sessionId,
			gameId: scoreGame.id,
			winningTeam: values.winningTeam,
			notes: values.notes,
		});
		setScoreGame(null);
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
		if (isLocalGameId(gameId)) {
			message.warning("This game was made offline. Cancel it once it has synced.");
			return;
		}
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

				.main-content-grid {
					display: grid;
					grid-template-columns: 1fr 420px;
					flex: 1;
				}

				.courts-left {
					border-right: 1px solid rgba(138,39,72,0.12);
					min-width: 0;
				}

				.queue-right {
					display: flex;
					flex-direction: column;
				}

				@media (max-width: 900px) {
					.main-content-grid {
						grid-template-columns: 1fr;
					}

					.courts-left {
						border-right: none;
						border-bottom: 1px solid rgba(138,39,72,0.08);
					}

					.queue-right {
						border-left: none;
						border-top: 1px solid rgba(138,39,72,0.08);
					}

					.court-cards-grid {
						grid-template-columns: 1fr !important;
						padding: 12px !important;
						gap: 12px !important;
					}
					.courts-header {
						flex-direction: column;
						align-items: flex-start !important;
						gap: 12px !important;
						padding: 12px 16px !important;
					}
					.courts-header-right {
						width: 100%;
					}
					.add-court-btn {
						width: 100% !important;
						height: 36px !important;
						font-size: 12px !important;
					}
				}

				@media (max-width: 480px) {
					.courts-header {
						padding: 10px 12px !important;
					}
					.court-cards-grid {
						padding: 8px !important;
						gap: 8px !important;
					}
					.add-court-btn {
						height: 32px !important;
						font-size: 11px !important;
						padding: 0 8px !important;
					}
				}
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

			{/* ── Offline / waiting-to-sync status ── */}
			{(!offline.online || sessionOps.some((p) => !p.synced)) && (
				<div
					style={{
						background: offline.online ? "#f0fdf4" : "#fff7ed",
						borderBottom: `1px solid ${offline.online ? "#bbf7d0" : "#fed7aa"}`,
						padding: "10px 24px",
						fontSize: 13,
						color: "#111827",
					}}
				>
					{!offline.online ? (
						<>
							<strong>You&apos;re offline.</strong>{" "}
							{snapshot
								? "You can keep filling courts and recording results; everything is saved on this device and syncs automatically when the connection returns."
								: "Results you record are saved on this device and sync when the connection returns. Filling courts offline needs this session to have loaded once online."}
							{sessionOps.filter((p) => !p.synced).length > 0 &&
								` (${sessionOps.filter((p) => !p.synced).length} waiting)`}
						</>
					) : (
						<>
							{offline.syncing ? "Syncing" : "Waiting to sync"}{" "}
							<strong>{sessionOps.filter((p) => !p.synced && !p.error).length} saved action(s)</strong>…
						</>
					)}
				</div>
			)}

			{/* ── Offline actions the server rejected ── */}
			{sessionOps.filter((p) => p.error).length > 0 && (
				<div
					style={{
						background: "#fef2f2",
						borderBottom: "1px solid #fecaca",
						padding: "10px 24px",
						display: "flex",
						flexDirection: "column",
						gap: 8,
						fontSize: 13,
					}}
				>
					{sessionOps
						.filter((p) => p.error)
						.map((p) => {
							const names = new Map((snapshot?.players ?? []).map((x) => [x.id, x.name]));
							const label =
								p.kind === "fill"
									? `Game ${[...p.teamAPlayerIds, ...p.teamBPlayerIds].map((id) => names.get(id) ?? "?").join(", ")}`
									: `Result (team ${p.winningTeam} won)`;
							return (
								<div key={p.id} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
									<Text style={{ flex: 1, minWidth: 220, fontSize: 13, color: "#991b1b" }}>
										<strong>{label}</strong> could not be saved: {p.error}
									</Text>
									<Button size="small" onClick={() => offline.retry(p.id)}>
										Try again
									</Button>
									<Button size="small" danger onClick={() => offline.discard(p.id)}>
										Discard
									</Button>
								</div>
							);
						})}
				</div>
			)}

			{/* ── Players who keep landing in the same games ── */}
			{(session?.togetherGroups ?? []).length > 0 && (
				<div
					style={{
						background: "#fffbeb",
						borderBottom: "1px solid #fde68a",
						padding: "12px 24px",
						display: "flex",
						flexDirection: "column",
						gap: 10,
					}}
				>
					{session.togetherGroups.map((group: any) => {
						const names: string[] = group.players.map((p: any) => p.name);
						const nameList =
							names.length > 1
								? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`
								: names[0];
						const open = !!expandedTogether[group.id];
						return (
							<div key={group.id}>
								<div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
									<span style={{ fontSize: 15, color: "#b45309", flexShrink: 0 }}>⚠</span>
									<Text style={{ fontSize: 13, flex: 1, minWidth: 220, color: "#111827" }}>
										<strong>{nameList}</strong> have been in the same game{" "}
										<strong style={{ color: "#b45309" }}>{group.gamesTogether} times</strong>.
									</Text>
									<Button
										size="small"
										onClick={() =>
											setExpandedTogether((prev) => ({ ...prev, [group.id]: !open }))
										}
									>
										{open ? "Hide games" : "Show games"}
									</Button>
									<Button
										size="small"
										type="primary"
										loading={separating}
										onClick={async () => {
											try {
												await separatePlayers({
													variables: {
														sessionId,
														playerIds: group.players.map((p: any) => p.id),
													},
												});
												message.success(`${nameList} will no longer be put in the same game.`);
											} catch (e) {
												message.error(e instanceof Error ? e.message : "Could not break them up");
											}
										}}
									>
										Break them up
									</Button>
								</div>
								{open && (
									<div style={{ margin: "8px 0 0 27px", display: "flex", flexDirection: "column", gap: 4 }}>
										{group.games.map((game: any) => (
											<Text key={game.id} style={{ fontSize: 12, color: "#374151" }}>
												<strong>Game {game.gameNumber}:</strong>{" "}
												{game.teamA.players.map((p: any) => p.name).join(" & ")} vs{" "}
												{game.teamB.players.map((p: any) => p.name).join(" & ")}
											</Text>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			{/* ── Main content: courts + queue ── */}
			<div className="main-content-grid">
				{/* Left: courts + on deck + last games */}
				<div className="courts-left">
					{/* Courts header */}
					<div
						className="courts-header"
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
						<div className="courts-header-right">
							<Button
								className="add-court-btn"
								size="small"
								onClick={() => {
									const courtNumbers = new Set((session?.courts ?? []).map((c: any) => c.courtNumber));
									let courtNumber = 1;
									while (courtNumbers.has(courtNumber)) {
										courtNumber++;
									}
									addCourt({
										variables: {
											sessionId,
											input: { courtNumber },
										},
									})
										.then(() => {
											message.success("Court added!");
											refetch();
										})
										.catch((err: any) => {
											message.error(err.message || "Failed to add court");
										});
								}}
								loading={addingCourt}
								style={{
									background: "#e11d74",
									borderColor: "#e11d74",
									color: "#fff",
									fontWeight: 600,
									fontSize: 11,
									height: 28,
									padding: "0 12px",
								}}
							>
								+ Add Court
							</Button>
						</div>
					</div>

					{/* Court cards grid */}
					<div
						className="court-cards-grid"
						style={{
							display: "grid",
							gridTemplateColumns: (() => {
								const courtCount = session.courts.length;
								if (courtCount === 1) return "1fr";
								if (courtCount === 2) return "repeat(2, 1fr)";
								if (courtCount === 3) return "repeat(3, 1fr)";
								return "repeat(auto-fill, minmax(240px, 1fr))";
							})(),
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
								resultState={(() => {
									if (local) return undefined;
									const p = offline.pending.find((x) => x.kind === "complete" && x.gameId === court.currentGame?.id);
									if (!p) return undefined;
									return p.error ? "failed" : !offline.online ? "offline" : "saving";
								})()}
								resultError={local ? undefined : offline.pending.find((x) => x.kind === "complete" && x.gameId === court.currentGame?.id)?.error}
								onRetryResult={() => {
									const p = offline.pending.find((x) => x.kind === "complete" && x.gameId === court.currentGame?.id);
									if (p) offline.retry(p.id);
								}}
								onDiscardResult={() => {
									const p = offline.pending.find((x) => x.kind === "complete" && x.gameId === court.currentGame?.id);
									if (p) offline.discard(p.id);
								}}
								onRecordResult={handleRecordResult}
								onCancelGame={handleCancelGame}
								onUpdateTeams={handleUpdateTeams}
								onCallOut={(game) =>
									announceMatchup(game.teamA, game.teamB, court.name ?? `Court ${court.courtNumber}`)
								}
								onRemove={(courtId) => {
									modal.confirm({
										title: "Remove this court?",
										content: "This court will be permanently deleted.",
										okText: "Remove",
										okButtonProps: { danger: true },
										onOk: async () => {
											try {
												await deleteCourt({
													variables: { id: courtId },
													refetchQueries: [
														{ query: SESSION_DASHBOARD_QUERY, variables: { id: sessionId } },
														{ query: CLUB_DETAIL_QUERY, variables: { id: data?.session?.clubId } },
													],
												});
												message.success("Court removed!");
											} catch (err) {
												message.error(err instanceof Error ? err.message : "Failed to remove court");
											}
										},
									});
								}}
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
								flexDirection: "column",
								gap: 20,
							}}
						>
							<div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 32 }}>
								<div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
									{/* Group 1 — next 4, paired into predicted teams so players can prepare */}
									{queuedPlayers.slice(0, 4).length > 0 && (
										<div>
											<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 8 }}>
												ON DECK · NEXT OFF {nextOffCourt ? `COURT ${nextOffCourt.courtNumber}` : "COURT"}
											</div>
											{session?.nextGamePreview ? (
												<div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
													<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
														{session.nextGamePreview.teamA.players.map((p: any) => (
															<span key={p.id} style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
																{p.name}
															</span>
														))}
													</div>
													<span style={{ fontSize: 12, fontWeight: 700, color: "rgba(255,255,255,0.4)" }}>VS</span>
													<div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
														{session.nextGamePreview.teamB.players.map((p: any) => (
															<span key={p.id} style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
																{p.name}
															</span>
														))}
													</div>
												</div>
											) : (
												<div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
													{queuedPlayers.slice(0, 4).map((p: any) => (
														<span key={p.id} style={{ fontSize: 17, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" }}>
															{p.name}
														</span>
													))}
												</div>
											)}
										</div>
									)}
									{/* Group 2 — players 5–8 */}
									{queuedPlayers.slice(4, 8).length > 0 && (
										<div>
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
				<div className="queue-right">
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
				quick
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
