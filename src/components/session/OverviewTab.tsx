"use client";

import { Badge } from "@/components/Badge";
import {
	ScoreEntryForm,
	type ScoreEntryValues,
} from "@/components/ScoreEntryForm";
import { StatTile } from "@/components/StatTile";
import {
	CANCEL_GAME,
	CHECK_IN_PLAYER,
	COMPLETE_GAME,
	FILL_COURT_MANUALLY,
	GENERATE_NEXT_GAME,
	SESSION_DASHBOARD_QUERY,
	UPDATE_GAME_RESULT,
	UPDATE_GAME_TEAMS,
	UPDATE_SESSION,
} from "@/graphql/documents/organiser";
import {
	CheckCircleOutlined,
	ClockCircleOutlined,
	PlayCircleOutlined,
	PlusOutlined,
	SwapOutlined,
	TeamOutlined,
	UndoOutlined,
	UserOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client";
import {
	App,
	Avatar,
	Button,
	Card,
	Col,
	Empty,
	List,
	Row,
	Select,
	Space,
	Switch,
	Tooltip,
	Typography,
} from "antd";
import { useState } from "react";
import { CourtCard } from "./CourtCard";

const { Title, Text } = Typography;

function initials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase())
		.join("");
}

function PlayerChip({ name, rank }: { name: string; rank?: string }) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 6,
				background: "#f9fafb",
				border: "1px solid #e5e7eb",
				borderRadius: 20,
				padding: "4px 10px 4px 4px",
			}}
		>
			<Avatar
				size={24}
				style={{
					backgroundColor: "#fce7f3",
					color: "#db2777",
					fontSize: 10,
					fontWeight: 700,
					flexShrink: 0,
				}}
			>
				{rank ?? initials(name)}
			</Avatar>
			<Text style={{ fontSize: 13, fontWeight: 500 }}>{name}</Text>
		</div>
	);
}

export function OverviewTab({ sessionId }: { sessionId: string }) {
	const { message } = App.useApp();
	const { data, loading, error, refetch } = useQuery(SESSION_DASHBOARD_QUERY, {
		variables: { id: sessionId },
		pollInterval: 5000,
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
	const [cancelGame, { loading: undoing }] = useMutation(CANCEL_GAME);
	const [updateSession, { loading: togglingPairing }] = useMutation(UPDATE_SESSION);
	const [checkInPlayer] = useMutation(CHECK_IN_PLAYER);
	const [scoreGame, setScoreGame] = useState<any>(null);
	const [selectedQueuePlayers, setSelectedQueuePlayers] = useState<string[]>([]);
	const [addingToQueue, setAddingToQueue] = useState(false);

	if (loading && !data) return null;
	if (error) return <Empty description={error.message} />;
	const session = data?.session;
	if (!session) return <Empty description="Session not found" />;

	async function handleGenerate(courtId: string) {
		try {
			await generateNextGame({ variables: { sessionId: session.id, courtId } });
			message.success("Game generated");
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not generate a game",
			);
		}
	}

	async function handleUpdateTeams(gameId: string, teamAPlayerIds: string[], teamBPlayerIds: string[]) {
		try {
			await updateGameTeams({ variables: { id: gameId, teamAPlayerIds, teamBPlayerIds } });
			message.success("Lineup updated");
			refetch();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not update lineup");
		}
	}

	async function handleScoreSubmit(values: ScoreEntryValues) {
		try {
			await completeGame({ variables: { id: scoreGame.id, input: values } });
			message.success("Result recorded");
			setScoreGame(null);
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not record result",
			);
		}
	}

	async function handleAddToQueue() {
		if (selectedQueuePlayers.length === 0) return;
		setAddingToQueue(true);
		try {
			await Promise.all(
				selectedQueuePlayers.map((id) =>
					checkInPlayer({ variables: { id, checkedIn: true } }),
				),
			);
			message.success(
				`${selectedQueuePlayers.length} player${selectedQueuePlayers.length > 1 ? "s" : ""} checked in and added to queue`,
			);
			setSelectedQueuePlayers([]);
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not add players to queue",
			);
		} finally {
			setAddingToQueue(false);
		}
	}

	async function handleUndo(gameId: string) {
		try {
			await cancelGame({ variables: { id: gameId } });
			message.success("Result undone");
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not undo result",
			);
		}
	}

	async function handleSwitchWinner(game: any) {
		const newWinner = game.winningTeam === "A" ? "B" : "A";
		try {
			await updateGameResult({ variables: { id: game.id, input: { winningTeam: newWinner } } });
			message.success("Winner switched");
			refetch();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not switch winner",
			);
		}
	}

	async function handleTogglePairing(random: boolean) {
		try {
			await updateSession({
				variables: {
					id: session.id,
					input: { settings: { pairingMode: random ? "RANDOM" : "SMART" } },
				},
			});
			message.success(random ? "Switched to random pairing" : "Switched to smart pairing");
			refetch();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not update pairing mode");
		}
	}

	const checkedInCount = session.players.filter((p: any) => p.checkedIn).length;
	const queuedPlayers: any[] = session.queuedPlayers ?? [];
	const visibleQueue = queuedPlayers.slice(0, 6);
	const extraCount = queuedPlayers.length - visibleQueue.length;

	return (
		<div>
			<style>{`
        .overview-card > .ant-card-body { padding: 16px; }
        .overview-card .overview-queue-add { flex-direction: column; }
        @media (min-width: 480px) {
          .overview-card > .ant-card-body { padding: 20px; }
          .overview-card .overview-queue-add { flex-direction: row; }
        }
        @media (min-width: 768px) {
          .overview-card > .ant-card-body { padding: 24px; }
        }
        .game-summary-item { gap: 8px; }
        .game-summary-players { min-width: 0; overflow: hidden; }
        .game-summary-players span { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      `}</style>
			{/* Stat tiles */}
			<Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
				<Col xs={12} sm={6}>
					<StatTile
						icon={<TeamOutlined />}
						label="Checked in"
						value={checkedInCount}
						suffix={`/ ${session.players.length}`}
					/>
				</Col>
				<Col xs={12} sm={6}>
					<StatTile
						icon={<ClockCircleOutlined />}
						iconColor="#c2410c"
						iconBg="#fff7ed"
						label="Waiting"
						value={queuedPlayers.length}
					/>
				</Col>
				<Col xs={12} sm={6}>
					<StatTile
						icon={<PlayCircleOutlined />}
						iconColor="#0369a1"
						iconBg="#f0f9ff"
						label="Active games"
						value={session.activeGames.length}
					/>
				</Col>
				<Col xs={12} sm={6}>
					<StatTile
						icon={<CheckCircleOutlined />}
						iconColor="#15803d"
						iconBg="#f0fdf4"
						label="Completed"
						value={session.completedGames.length}
					/>
				</Col>
			</Row>

			<Row gutter={[16, 16]}>
				{/* Courts panel */}
				<Col xs={24} lg={16}>
					<Card
						className="overview-card"
						style={{ borderRadius: 16, height: "100%" }}
					>
						<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
							<Title level={4} style={{ margin: 0 }}>
								Courts
							</Title>
							{(() => {
								const mode: string = session.settings?.queueMode ?? "HYBRID";
								const LABELS: Record<string, { label: string; tooltip: string; color: string }> = {
									HYBRID:   { label: "Hybrid",   color: "#3b82f6", tooltip: "Wait-time first with gentle catch-up for late arrivals." },
									BALANCED: { label: "Balanced", color: "#10b981", tooltip: "Everyone gets equal games — late arrivals are prioritised to catch up." },
									SMART:    { label: "Smart",    color: "#6b7280", tooltip: "Strict queue order. No catch-up for late arrivals." },
								};
								const info = LABELS[mode] ?? LABELS.HYBRID;
								return (
									<Tooltip title={info.tooltip}>
										<span style={{
											fontSize: 11,
											fontWeight: 700,
											color: info.color,
											background: `${info.color}18`,
											borderRadius: 99,
											padding: "3px 10px",
											cursor: "default",
										}}>
											{info.label} queue
										</span>
									</Tooltip>
								);
							})()}
						</div>
						<Row gutter={[16, 16]}>
							{session.courts.map((court: any) => (
								<Col xs={24} sm={12} md={8} key={court.id}>
									<CourtCard
										court={court}
										generating={generating || fillingManually}
										sessionActive={session.status === "ACTIVE"}
										allPlayers={session.players.filter((p: any) => p.checkedIn || p.active)}
										queuedPlayers={queuedPlayers}
										updatingTeams={updatingTeams}
										onFill={handleGenerate}
										onRecordResult={setScoreGame}
										onUpdateTeams={handleUpdateTeams}
									/>
								</Col>
							))}
						</Row>
					</Card>
				</Col>

				{/* Waiting queue panel */}
				<Col xs={24} lg={8}>
					<Card
						className="overview-card"
						style={{ borderRadius: 16, height: "100%" }}
					>
						<Title level={4} style={{ margin: "0 0 16px 0" }}>
							Waiting queue
						</Title>

						{/* Add to queue */}
						<div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
							<Select
								mode="multiple"
								placeholder="Select players to add"
								style={{ flex: 1 }}
								value={selectedQueuePlayers}
								onChange={setSelectedQueuePlayers}
								maxTagCount={2}
								options={session.players
									.filter((p: any) => !p.checkedIn)
									.map((p: any) => ({ value: p.id, label: p.name }))}
							/>
						</div>
						<div className="overview-queue-add" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
							<Button
								style={{ flex: 1 }}
								onClick={() => {
									const ids = session.players
										.filter((p: any) => !p.checkedIn)
										.map((p: any) => p.id);
									setSelectedQueuePlayers(ids);
								}}
							>
								Select all (
								{session.players.filter((p: any) => !p.checkedIn).length})
							</Button>
							<Button
								type="primary"
								icon={<PlusOutlined />}
								loading={addingToQueue}
								disabled={selectedQueuePlayers.length === 0}
								onClick={handleAddToQueue}
								style={{ background: "#ec4899", borderColor: "#ec4899" }}
							>
								Add
							</Button>
						</div>

						{/* Queue list */}
						{queuedPlayers.length === 0 ? (
							<Empty
								description="No one is waiting right now"
								image={Empty.PRESENTED_IMAGE_SIMPLE}
							/>
						) : (
							<>
								<List
									dataSource={visibleQueue}
									renderItem={(player: any) => (
										<List.Item
											style={{
												padding: "10px 0",
												borderBottom: "1px solid #f3f4f6",
											}}
										>
											<Space>
												<Avatar
													size={36}
													style={{
														backgroundColor: "#fce7f3",
														color: "#db2777",
														fontSize: 12,
														fontWeight: 700,
													}}
												>
													{initials(player.name)}
												</Avatar>
												<div>
													<Text
														strong
														style={{ display: "block", fontSize: 14 }}
													>
														{player.name}
													</Text>
													<Text type="secondary" style={{ fontSize: 12 }}>
														{player.waitTime
															? `${player.waitTime}m wait`
															: "In queue"}{" "}
														· {player.gamesPlayed ?? 0} games
													</Text>
												</div>
											</Space>
											<UserOutlined
												style={{ color: "#d1d5db", marginLeft: "auto" }}
											/>
										</List.Item>
									)}
								/>
								{extraCount > 0 && (
									<Text
										type="secondary"
										style={{
											display: "block",
											textAlign: "center",
											marginTop: 12,
											fontSize: 13,
										}}
									>
										+{extraCount} more in queue
									</Text>
								)}
							</>
						)}
					</Card>
				</Col>
			</Row>

		{/* Game summary + Standings */}
		<Row gutter={[16, 16]} style={{ marginTop: 16 }} align="stretch">
				<Col xs={24} lg={16}>
					{session.completedGames.length > 0 && (
						<Card
							className="overview-card"
							style={{ borderRadius: 16, height: "100%" }}
							styles={{ body: { display: "flex", flexDirection: "column" } }}
						>
							<Title level={4} style={{ margin: "0 0 16px 0", flexShrink: 0 }}>
								Game summary
							</Title>
							<div
								style={{
									display: "flex",
									flexDirection: "column",
									gap: 10,
									overflowY: "auto",
									maxHeight: 380,
									paddingRight: 4,
								}}
							>
								{[...session.completedGames]
									.sort((a: any, b: any) =>
										(b.completedAt ?? "").localeCompare(a.completedAt ?? ""),
									)
									.slice(0, 5)
									.map((game: any) => {
										const teamALabel = game.teamA.players
											.map((p: any) => p.name)
											.join(" & ");
										const teamBLabel = game.teamB.players
											.map((p: any) => p.name)
											.join(" & ");
										const winnerLabel =
											game.winningTeam === "A" ? teamALabel : teamBLabel;
										return (
											<div
												key={game.id}
												className="game-summary-item"
												style={{
													display: "flex",
													alignItems: "center",
													gap: 8,
													padding: "10px 12px",
													border: "1px solid #f3f4f6",
													borderRadius: 10,
													background: "#fafafa",
												}}
											>
												{game.round && (
													<div
														style={{
															background: "#e5e7eb",
															borderRadius: 6,
															padding: "2px 7px",
															fontSize: 11,
															fontWeight: 700,
															color: "#6b7280",
															flexShrink: 0,
														}}
													>
														R{game.round}
													</div>
												)}
												<div className="game-summary-players" style={{ flex: 1, minWidth: 0 }}>
													<Text strong style={{ fontSize: 13, display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
														{teamALabel}
													</Text>
													<Text
														type="secondary"
														style={{ fontSize: 11 }}
													>
														vs {teamBLabel}
													</Text>
												</div>
												<Badge variant="green" style={{ flexShrink: 0, fontSize: 11, whiteSpace: "nowrap" }}>{winnerLabel} won</Badge>
												<Tooltip
													title={`Switch winner to ${game.winningTeam === "A" ? teamBLabel : teamALabel}`}
												>
													<Button
														size="small"
														type="text"
														icon={<UndoOutlined />}
														loading={switching}
														onClick={() => handleSwitchWinner(game)}
														style={{ color: "#9ca3af", flexShrink: 0 }}
													/>
												</Tooltip>
											</div>
										);
									})}
							</div>
						</Card>
					)}
				</Col>
				<Col xs={24} lg={8}>
					{session.standings.length > 0 && (
						<Card
							className="overview-card"
							style={{ borderRadius: 16, height: "100%" }}
							styles={{ body: { display: "flex", flexDirection: "column" } }}
						>
							<Title level={4} style={{ margin: "0 0 12px 0", flexShrink: 0 }}>
								Standings
							</Title>
							<div
								style={{
									overflowY: "auto",
									maxHeight: 380,
									paddingRight: 4,
								}}
							>
								{session.standings.map((row: any) => {
									const medal: Record<number, { bg: string; color: string; label: string }> = {
										1: { bg: "#d4af37", color: "#fff", label: "1" },
										2: { bg: "#a8a8a8", color: "#fff", label: "2" },
										3: { bg: "#b06a3d", color: "#fff", label: "3" },
									};
									const m = medal[row.rank];
									const barColor =
										row.rank === 1 ? "#db2777" :
										row.rank === 2 ? "#3b82f6" :
										row.rank === 3 ? "#f59e0b" : "#e5e7eb";
									const winPct = row.winRate ?? 0;
									return (
										<div
											key={row.player.id}
											style={{
												display: "flex",
												alignItems: "center",
												gap: 10,
												padding: "10px 8px",
												borderRadius: 10,
												background: row.rank === 1 ? "#fdf2f8" : "transparent",
												marginBottom: 4,
											}}
										>
											{/* Medal / rank badge */}
											<div
												style={{
													width: 32,
													height: 32,
													borderRadius: "50%",
													background: m ? m.bg : "#e5e7eb",
													color: m ? m.color : "#6b7280",
													display: "flex",
													alignItems: "center",
													justifyContent: "center",
													fontSize: 13,
													fontWeight: 700,
													flexShrink: 0,
												}}
											>
												{m ? (
													<span style={{ fontSize: 16 }}>
														{row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : "🥉"}
													</span>
												) : (
													row.rank
												)}
											</div>
											{/* Player avatar chip */}
											<Avatar
												size={32}
												style={{
													backgroundColor: m ? `${barColor}22` : "#f3f4f6",
													color: m ? barColor : "#6b7280",
													fontSize: 11,
													fontWeight: 700,
													flexShrink: 0,
												}}
											>
												P{row.player.name.replace(/\D/g, "").slice(0, 2) || row.player.name.slice(0, 2).toUpperCase()}
											</Avatar>
											{/* Name + progress bar */}
											<div style={{ flex: 1, minWidth: 0 }}>
												<Text style={{ fontSize: 14, fontWeight: 600, display: "block" }}>
													{row.player.nickname || row.player.name}
												</Text>
												<div
													style={{
														height: 3,
														borderRadius: 99,
														background: "#f3f4f6",
														marginTop: 5,
													}}
												>
													<div
														style={{
															height: 3,
															borderRadius: 99,
															background: barColor,
															width: `${winPct}%`,
															transition: "width 0.4s ease",
														}}
													/>
												</div>
											</div>
											{/* W/L + % */}
											<div style={{ textAlign: "right", flexShrink: 0 }}>
												<div style={{ fontSize: 13, lineHeight: 1.3 }}>
													<Text strong>{row.wins}W</Text>{" "}
													<Text type="secondary">{row.losses}L</Text>
												</div>
												<Text type="secondary" style={{ fontSize: 11 }}>
													{winPct.toFixed(0)}%
												</Text>
											</div>
										</div>
									);
								})}
							</div>
						</Card>
					)}
				</Col>
			</Row>

			{/* Simple standings */}

			<ScoreEntryForm
				open={!!scoreGame}
				game={scoreGame}
				loading={completing}
				onCancel={() => setScoreGame(null)}
				onSubmit={handleScoreSubmit}
			/>
		</div>
	);
}
