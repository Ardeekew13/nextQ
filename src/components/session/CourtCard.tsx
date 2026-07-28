"use client";

import { useState } from "react";
import { Button, Tag, Tooltip, Typography, Avatar, Select } from "antd";
import {
	TrophyOutlined,
	EditOutlined,
	SwapOutlined,
	CheckOutlined,
	CloseOutlined,
	ClockCircleOutlined,
} from "@ant-design/icons";

const { Text } = Typography;

function initials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((p) => p[0]?.toUpperCase())
		.join("");
}

function PlayerChip({ name }: { name: string }) {
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
				{initials(name)}
			</Avatar>
			<Text style={{ fontSize: 13, fontWeight: 500 }}>{name}</Text>
		</div>
	);
}

interface CourtCardProps {
	court: any;
	generating?: boolean;
	sessionActive?: boolean;
	allPlayers?: any[];
	queuedPlayers?: any[];
	updatingTeams?: boolean;
	onFill: (courtId: string) => void;
	onRecordResult: (game: any) => void;
	onUpdateTeams?: (gameId: string, teamAPlayerIds: string[], teamBPlayerIds: string[]) => Promise<void>;
}

/** Build Select options sorted: queued first (by queue position), then on-court players. */
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

	const onCourt = available.filter((p: any) => !queuedIds.has(p.id));

	const toOption = (p: any, inQueue: boolean, pos?: number) => ({
		value: p.id,
		label: p.name,
		inQueue,
		queuePos: pos,
		gamesPlayed: p.gamesPlayed ?? 0,
	});

	return [
		...queued.map((p: any, i: number) => toOption(p, true, i + 1)),
		...onCourt.map((p: any) => toOption(p, false)),
	];
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
	onUpdateTeams,
}: CourtCardProps) {
	const isLive = court.status === "IN_USE";
	const isAvailable = court.status === "AVAILABLE";

	const [editing, setEditing] = useState(false);
	const [editTeamA, setEditTeamA] = useState<string[]>([]);
	const [editTeamB, setEditTeamB] = useState<string[]>([]);

	function startEditing() {
		const game = court.currentGame;
		if (!game) return;
		setEditTeamA(game.teamA.players.map((p: any) => p.id));
		setEditTeamB(game.teamB.players.map((p: any) => p.id));
		setEditing(true);
	}

	function cancelEditing() {
		setEditing(false);
	}

	async function saveEditing() {
		if (!onUpdateTeams || !court.currentGame) return;
		await onUpdateTeams(court.currentGame.id, editTeamA, editTeamB);
		setEditing(false);
	}

	// Players available for selection: current court players + queued players
	const currentCourtPlayerIds = new Set([
		...(court.currentGame?.teamA.players.map((p: any) => p.id) ?? []),
		...(court.currentGame?.teamB.players.map((p: any) => p.id) ?? []),
	]);
	const queuedIds = new Set(queuedPlayers.map((p: any) => p.id));
	// Map from player id → queue position (1-based, lower = sooner)
	const queueOrder = new Map(queuedPlayers.map((p: any, i: number) => [p.id, i + 1]));

	const pickablePlayers = allPlayers.filter(
		(p: any) => currentCourtPlayerIds.has(p.id) || queuedIds.has(p.id),
	);

	const teamAOptions = buildOptions(pickablePlayers, queuedIds, queueOrder, editTeamB);
	const teamBOptions = buildOptions(pickablePlayers, queuedIds, queueOrder, editTeamA);

	function renderOption(option: any) {
		return (
			<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					{option.data.inQueue && (
						<ClockCircleOutlined style={{ color: "#ec4899", fontSize: 11, flexShrink: 0 }} />
					)}
					<span style={{ fontWeight: option.data.inQueue ? 600 : 400 }}>
						{option.label}
					</span>
				</div>
				<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
					{option.data.inQueue && (
						<Tag
							color="pink"
							style={{
								fontSize: 10,
								padding: "0 5px",
								lineHeight: "16px",
								margin: 0,
								borderRadius: 99,
							}}
						>
							#{option.data.queuePos} in queue
						</Tag>
					)}
					<Text type="secondary" style={{ fontSize: 11 }}>
						{option.data.gamesPlayed}g
					</Text>
				</div>
			</div>
		);
	}

	return (
		<div
			style={{
				border: "1px solid #e5e7eb",
				borderTop: `3px solid ${isLive ? "#10b981" : "#e5e7eb"}`,
				borderRadius: 12,
				padding: 8,
				background: "#fff",
			}}
		>
			{/* Court header */}
			<div
				style={{
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					marginBottom: 12,
				}}
			>
				<Text strong style={{ fontSize: 16 }}>
					{court.name || `Court ${court.courtNumber}`}
				</Text>
				<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
					{isLive && (
						<Tag
							color="green"
							style={{
								borderRadius: 20,
								fontWeight: 600,
								display: "flex",
								alignItems: "center",
								gap: 4,
								margin: 0,
							}}
						>
							<span
								style={{
									width: 7,
									height: 7,
									borderRadius: "50%",
									background: "#10b981",
									display: "inline-block",
								}}
							/>
							Live
						</Tag>
					)}
					{isAvailable && (
						<Tag color="default" style={{ borderRadius: 20, margin: 0 }}>
							Available
						</Tag>
					)}
					{isLive && court.currentGame && !editing && onUpdateTeams && (
						<Tooltip title="Edit lineup">
							<Button
								size="small"
								type="text"
								icon={<EditOutlined />}
								onClick={startEditing}
								style={{ color: "#9ca3af" }}
							/>
						</Tooltip>
					)}
				</div>
			</div>

			{court.currentGame ? (
				<div>
					{court.currentGame.round && (
						<Text
							type="secondary"
							style={{
								fontSize: 11,
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: 0.5,
								display: "block",
								marginBottom: 10,
							}}
						>
							Round {court.currentGame.round}
						</Text>
					)}

					{editing ? (
						<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
							{/* Team A */}
							<div>
								<Text
									style={{
										fontSize: 11,
										fontWeight: 700,
										color: "#ec4899",
										textTransform: "uppercase",
										letterSpacing: 0.5,
										display: "block",
										marginBottom: 6,
									}}
								>
									Team A
								</Text>
								<Select
									mode="multiple"
									size="small"
									style={{ width: "100%" }}
									value={editTeamA}
									onChange={setEditTeamA}
									placeholder="Search players…"
									showSearch
									filterOption={(input, option: any) =>
										option?.label?.toLowerCase().includes(input.toLowerCase())
									}
									options={teamAOptions}
									optionRender={renderOption}
								/>
							</div>

							<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
								<div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
								<SwapOutlined style={{ color: "#9ca3af", fontSize: 12 }} />
								<div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
							</div>

							{/* Team B */}
							<div>
								<Text
									style={{
										fontSize: 11,
										fontWeight: 700,
										color: "#ec4899",
										textTransform: "uppercase",
										letterSpacing: 0.5,
										display: "block",
										marginBottom: 6,
									}}
								>
									Team B
								</Text>
								<Select
									mode="multiple"
									size="small"
									style={{ width: "100%" }}
									value={editTeamB}
									onChange={setEditTeamB}
									placeholder="Search players…"
									showSearch
									filterOption={(input, option: any) =>
										option?.label?.toLowerCase().includes(input.toLowerCase())
									}
									options={teamBOptions}
									optionRender={renderOption}
								/>
							</div>

							{/* Queue legend */}
							{queuedPlayers.length > 0 && (
								<div style={{ display: "flex", alignItems: "center", gap: 4 }}>
									<ClockCircleOutlined style={{ color: "#ec4899", fontSize: 10 }} />
									<Text type="secondary" style={{ fontSize: 11 }}>
										Pink = next in queue · sorted by wait time
									</Text>
								</div>
							)}

							<div style={{ display: "flex", gap: 6 }}>
								<Button
									size="small"
									block
									onClick={cancelEditing}
									icon={<CloseOutlined />}
								>
									Cancel
								</Button>
								<Button
									size="small"
									type="primary"
									block
									loading={updatingTeams}
									icon={<CheckOutlined />}
									onClick={saveEditing}
									style={{ background: "#ec4899", borderColor: "#ec4899" }}
								>
									Save
								</Button>
							</div>
						</div>
					) : (
						<>
							{/* Team A */}
							<Text
								style={{
									fontSize: 11,
									fontWeight: 700,
									color: "#ec4899",
									textTransform: "uppercase",
									letterSpacing: 0.5,
									display: "block",
									marginBottom: 6,
								}}
							>
								Team A
							</Text>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
								{court.currentGame.teamA.players.map((p: any) => (
									<PlayerChip key={p.id} name={p.name} />
								))}
							</div>

							{/* VS divider */}
							<div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
								<div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
								<Text type="secondary" style={{ fontSize: 12, fontWeight: 600 }}>
									VS
								</Text>
								<div style={{ flex: 1, height: 1, background: "#e5e7eb" }} />
							</div>

							{/* Team B */}
							<Text
								style={{
									fontSize: 11,
									fontWeight: 700,
									color: "#ec4899",
									textTransform: "uppercase",
									letterSpacing: 0.5,
									display: "block",
									marginBottom: 6,
								}}
							>
								Team B
							</Text>
							<div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
								{court.currentGame.teamB.players.map((p: any) => (
									<PlayerChip key={p.id} name={p.name} />
								))}
							</div>

							<Button
								type="primary"
								icon={<TrophyOutlined />}
								block
								disabled={!sessionActive}
								onClick={() => onRecordResult(court.currentGame)}
								style={{
									background: sessionActive ? "#ec4899" : undefined,
									borderColor: sessionActive ? "#ec4899" : undefined,
									borderRadius: 8,
									fontWeight: 600,
								}}
							>
								{sessionActive ? (
									"Record result"
								) : (
									<Tooltip title="Start the session before recording a result">
										Record result
									</Tooltip>
								)}
							</Button>
						</>
					)}
				</div>
			) : isAvailable ? (
				<Button
					type="dashed"
					block
					loading={generating}
					onClick={() => onFill(court.id)}
					style={{ borderRadius: 8 }}
				>
					Fill Court
				</Button>
			) : (
				<Text type="secondary">Court unavailable</Text>
			)}
		</div>
	);
}
