"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Tabs, Button, App } from "antd";
import { useQuery, useMutation } from "@apollo/client";
import {
	SESSION_DASHBOARD_QUERY,
	PAUSE_SESSION,
	FINISH_SESSION,
	START_SESSION,
	LOGOUT_ORGANISER,
} from "@/graphql/documents/organiser";
import { OverviewTab } from "@/components/session/OverviewTab";
import { PlayersTab } from "@/components/session/PlayersTab";
import type { PlayerTabStats } from "@/components/session/PlayersTab";
import { GamesTab } from "@/components/session/GamesTab";
import type { GameLogStats } from "@/components/GameLog";
import { StandingsTab } from "@/components/session/StandingsTab";
import type { StandingsTabStats } from "@/components/session/StandingsTab";
import { QrPopover } from "@/components/QrPopover";
import type { ReactNode } from "react";

type TabKey = "overview" | "players" | "games" | "standings";

export type SessionStats = {
	checkedIn: number;
	onCourt: number;
	gamesDone: number;
	longestWaitMins: number;
};

function formatWait(minutes: number) {
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${h}h`;
}

function formatElapsed(seconds: number) {
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
	return `${m}:${String(s).padStart(2, "0")}`;
}

export default function SessionPage() {
	const params = useParams<{ sessionId: string }>();
	const router = useRouter();
	const { message, modal } = App.useApp();
	const [activeTab, setActiveTab] = useState<TabKey>("overview");
	const [tabHeader, setTabHeader] = useState<ReactNode>(null);
	const [stats, setStats] = useState<SessionStats | null>(null);
	const [playerStats, setPlayerStats] = useState<PlayerTabStats | null>(null);
	const [gameStats, setGameStats] = useState<GameLogStats | null>(null);
	const [standingsStats, setStandingsStats] = useState<StandingsTabStats | null>(null);
	const [elapsed, setElapsed] = useState(0);
	const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	const { data, refetch } = useQuery(SESSION_DASHBOARD_QUERY, {
		variables: { id: params.sessionId },
		pollInterval: 10000,
	});
	const [pauseSession, { loading: pausing }] = useMutation(PAUSE_SESSION);
	const [finishSession, { loading: finishing }] = useMutation(FINISH_SESSION);
	const [startSession, { loading: starting }] = useMutation(START_SESSION);
	const [logoutOrganiser, { loading: loggingOut }] = useMutation(LOGOUT_ORGANISER);

	const session = data?.session;

	// Live timer — ticks from startTime
	useEffect(() => {
		if (!session?.startTime || session.status !== "ACTIVE") return;
		const start = new Date(session.startTime).getTime();
		const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
		tick();
		intervalRef.current = setInterval(tick, 1000);
		return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
	}, [session?.startTime, session?.status]);

	const courtsCount = session?.courts?.length ?? 0;
	const queueMode = session?.settings?.queueMode ?? "";
	const queueModeLabel = queueMode === "STRICT" ? "strict queue" : queueMode === "OPEN" ? "open queue" : queueMode.toLowerCase().replace(/_/g, " ");
	const isActive = session?.status === "ACTIVE";
	const isPaused = session?.status === "PAUSED";

	async function handleStart() {
		try {
			await startSession({ variables: { id: params.sessionId } });
			refetch();
			message.success("Session started");
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not start session");
		}
	}

	async function handlePause() {
		try {
			await pauseSession({ variables: { id: params.sessionId } });
			refetch();
			message.success("Session paused");
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not pause session");
		}
	}

	async function handleResume() {
		try {
			await startSession({ variables: { id: params.sessionId } });
			refetch();
			message.success("Session resumed");
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not resume session");
		}
	}

	async function handleEnd() {
		modal.confirm({
			title: "End this session?",
			content: "This will finish the session and lock the results. You can't undo this.",
			okText: "End Session",
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await finishSession({ variables: { id: params.sessionId } });
					router.push("/dashboard");
					message.success("Session ended");
				} catch (err) {
					message.error(err instanceof Error ? err.message : "Could not end session");
				}
			},
		});
	}

	async function handleLogout() {
		try {
			await logoutOrganiser();
			router.push("/login");
		} catch {
			router.push("/login");
		}
	}

	const tabItems = [
		{ key: "overview", label: "Overview" },
		{ key: "players", label: "Players" },
		{ key: "games", label: "Games" },
		{ key: "standings", label: "Standings" },
	];

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
			<style>{`
				@media (max-width: 768px) {
					.session-navbar {
						padding: 0 12px !important;
						height: 48px !important;
						gap: 6px !important;
					}
					.session-navbar .session-name {
						font-size: 14px !important;
						flex-shrink: 1 !important;
						min-width: 0 !important;
						overflow: hidden !important;
						text-overflow: ellipsis !important;
						white-space: nowrap !important;
						margin-right: 4px !important;
					}
					.session-navbar .session-divider {
						display: none !important;
					}
					.session-navbar .session-subtitle {
						display: none !important;
					}
					.session-navbar .session-actions {
						gap: 3px !important;
						margin-left: auto !important;
					}
					.session-navbar .session-actions button {
						padding: 6px 10px !important;
						font-size: 11px !important;
						height: 36px !important;
					}
					.session-navbar .session-badge {
						font-size: 9px !important;
						padding: 2px 6px !important;
						margin-right: 4px !important;
					}
					.session-tabs-container {
						height: auto !important;
						padding: 8px 12px !important;
						flex-wrap: wrap !important;
					}
					.session-tabs .ant-tabs-tab {
						padding: 6px 2px !important;
						margin: 0 8px 0 0 !important;
					}
				}
			`}</style>
			{/* ── Session Navbar ── */}
			<div className="session-navbar" style={{
				display: "flex", alignItems: "center",
				borderBottom: "1px solid #f0f0f0",
				background: "#fff", padding: "0 40px", height: 64, flexShrink: 0, gap: 0,
			}}>
				{/* Logo */}
				<Link href="/dashboard" style={{ display: "flex", alignItems: "center", marginRight: 16, flexShrink: 0 }}>
					{/* eslint-disable-next-line @next/next/no-img-element */}
					<img src="/nextqlogo.png" alt="NextQ" style={{ height: 36, width: "auto", display: "block" }} />
				</Link>

				{/* Vertical divider */}
				<div className="session-divider" style={{ width: 1, height: 28, background: "#e5e7eb", marginRight: 16, flexShrink: 0 }} />

				{/* Session name */}
				<span className="session-name" style={{
					fontSize: 20, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif",
					letterSpacing: "0.06em", textTransform: "uppercase", color: "#1d1f20",
					marginRight: 12, whiteSpace: "nowrap", flexShrink: 0,
				}}>
					{session?.name ?? "Loading…"}
				</span>

				{/* Live / Paused badge */}
				{(isActive || isPaused) && (
					<span className="session-badge" style={{
						display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
						fontSize: 12, fontWeight: 700,
						color: isActive ? "#e11d74" : "#d97706",
						background: isActive ? "#fce7f3" : "#fffbeb",
						border: `1px solid ${isActive ? "#fbb6ce" : "#fde68a"}`,
						borderRadius: 20, padding: "3px 10px", marginRight: 12,
					}}>
						<span style={{ width: 6, height: 6, borderRadius: "50%", background: isActive ? "#e11d74" : "#d97706", display: "inline-block" }} />
						{isActive ? `Live · ${formatElapsed(elapsed)}` : "Paused"}
					</span>
				)}

				{/* Subtitle */}
				<span className="session-subtitle" style={{ fontSize: 12, color: "rgba(29,31,32,0.45)", whiteSpace: "nowrap", flexShrink: 0 }}>
					BPC · {courtsCount} court{courtsCount !== 1 ? "s" : ""}{queueModeLabel ? ` · ${queueModeLabel}` : ""}
				</span>

				{/* Spacer */}
				<div style={{ flex: 1 }} />

				{/* Actions */}
				<div className="session-actions" style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
					<Button
						size="small"
						loading={loggingOut}
						onClick={handleLogout}
						style={{ fontWeight: 600, color: "rgba(29,31,32,0.5)", border: "1px solid #e5e7eb" }}
					>
						Log out
					</Button>
					{/* Gate QR — always visible when published */}
					{session?.publicPublished && (
						<QrPopover url={session.publicUrl ?? ""} />
					)}

					{/* DRAFT — show Start Session */}
					{!isActive && !isPaused && (
						<Button
							type="primary"
							style={{ background: "#e11d74", borderColor: "#e11d74", fontWeight: 700, letterSpacing: "0.05em" }}
							loading={starting}
							onClick={handleStart}
						>
							Start Session
						</Button>
					)}

					{/* ACTIVE — show Pause + End Session */}
					{isActive && (
						<>
							<Button onClick={handlePause} loading={pausing} style={{ fontWeight: 600 }}>
								Pause session
							</Button>
							<Button
								type="primary"
								style={{ background: "#e11d74", borderColor: "#e11d74", fontWeight: 700, letterSpacing: "0.05em" }}
								loading={finishing}
								onClick={handleEnd}
							>
								END SESSION
							</Button>
						</>
					)}

					{/* PAUSED — show Resume + End Session */}
					{isPaused && (
						<>
							<Button
								type="primary"
								style={{ background: "#16a34a", borderColor: "#16a34a", fontWeight: 600 }}
								loading={starting}
								onClick={handleResume}
							>
								Resume
							</Button>
							<Button
								type="primary"
								style={{ background: "#e11d74", borderColor: "#e11d74", fontWeight: 700, letterSpacing: "0.05em" }}
								loading={finishing}
								onClick={handleEnd}
							>
								END SESSION
							</Button>
						</>
					)}
				</div>
			</div>

			{/* ── Tab bar + Stats inline ── */}
			<div style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid #f0f0f0", background: "#fff", paddingLeft: 24, flexShrink: 0, height: 60, flexWrap: "wrap" }}>
				<style>{`
					.session-tabs .ant-tabs-tab { padding: 12px 4px !important; margin: 0 16px 0 0 !important; }
					.session-tabs .ant-tabs-tab-btn {
						font-family: 'Barlow Condensed', sans-serif !important;
						font-size: 13px !important;
						font-weight: 700 !important;
						letter-spacing: 0.12em !important;
						text-transform: uppercase !important;
						color: rgba(29,31,32,0.45) !important;
					}
					.session-tabs .ant-tabs-tab-active .ant-tabs-tab-btn { color: #e11d74 !important; }
					.session-tabs .ant-tabs-ink-bar { background: #e11d74 !important; }

					@media (max-width: 768px) {
						.session-tabs-container {
							height: auto !important;
							flex-direction: column !important;
							padding-left: 16px !important;
						}
						.session-tabs .ant-tabs-tab { padding: 8px 4px !important; margin: 0 12px 0 0 !important; }
						.session-tabs .ant-tabs-tab-btn {
							font-size: 11px !important;
						}
						.session-stats-container {
							width: 100% !important;
							justify-content: flex-start !important;
							border-left: none !important;
							border-top: 1px solid rgba(138,39,72,0.12) !important;
							padding-left: 0 !important;
							margin-top: 8px !important;
							overflow-x: auto !important;
						}
						.session-stat-item {
							min-width: 70px !important;
							padding: 0 16px !important;
						}
					}
				`}</style>
				<Tabs
					activeKey={activeTab}
					onChange={(key) => { setActiveTab(key as TabKey); setTabHeader(null); setStats(null); setPlayerStats(null); setGameStats(null); setStandingsStats(null); }}
					items={tabItems}
					className="session-tabs"
					style={{ flex: "0 0 auto", marginBottom: 0 }}
					tabBarStyle={{ margin: 0, border: "none" }}
				/>
				{activeTab === "overview" && stats && (
					<div className="session-stats-container" style={{ display: "flex", marginLeft: "auto", borderLeft: "1px solid rgba(138,39,72,0.12)" }}>
						{([
							{ label: "CHECKED IN", value: stats.checkedIn, pink: false },
							{ label: "ON COURT", value: stats.onCourt, pink: false },
							{ label: "GAMES DONE", value: stats.gamesDone, pink: false },
							{ label: "LONGEST WAIT", value: stats.longestWaitMins > 0 ? formatWait(stats.longestWaitMins) : "—", pink: stats.longestWaitMins >= 60 },
						] as { label: string; value: string | number; pink: boolean }[]).map(({ label, value, pink }, i, arr) => (
							<div key={label} className="session-stat-item" style={{
								padding: "0 22px",
								borderRight: i < arr.length - 1 ? "1px solid rgba(138,39,72,0.12)" : "none",
								display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 90,
							}}>
								<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 2 }}>{label}</div>
								<div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: pink ? "#e11d74" : "#1d1f20", lineHeight: 1 }}>{value}</div>
							</div>
						))}
					</div>
				)}
				{activeTab === "players" && playerStats && (
					<div className="session-stats-container" style={{ display: "flex", marginLeft: "auto", borderLeft: "1px solid rgba(138,39,72,0.12)" }}>
						{([
							{ label: "ON ROSTER",   value: playerStats.onRoster,   pink: false },
							{ label: "CHECKED IN",  value: playerStats.checkedIn,  pink: false },
							{ label: "SITTING OUT", value: playerStats.sittingOut, pink: false },
							{ label: "UNRATED",     value: playerStats.unrated,    pink: playerStats.unrated > 0 },
						] as { label: string; value: number; pink: boolean }[]).map(({ label, value, pink }, i, arr) => (
							<div key={label} className="session-stat-item" style={{
								padding: "0 22px",
								borderRight: i < arr.length - 1 ? "1px solid rgba(138,39,72,0.12)" : "none",
								display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 90,
							}}>
								<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 2 }}>{label}</div>
								<div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: pink ? "#e11d74" : "#1d1f20", lineHeight: 1 }}>{value}</div>
							</div>
						))}
					</div>
				)}
				{activeTab === "games" && gameStats && (
					<div style={{ display: "flex", marginLeft: "auto", borderLeft: "1px solid rgba(138,39,72,0.12)" }}>
						{([
							{ label: "GAMES PLAYED", value: gameStats.gamesPlayed,                        pink: false },
							{ label: "ROUNDS",        value: gameStats.rounds,                             pink: false },
							{ label: "AVG GAME",      value: `${gameStats.avgGameMin} min`,                pink: false },
							{ label: "VOIDED",        value: gameStats.voided,                             pink: gameStats.voided > 0 },
						] as { label: string; value: string | number; pink: boolean }[]).map(({ label, value, pink }, i, arr) => (
							<div key={label} className="session-stat-item" style={{
								padding: "0 22px",
								borderRight: i < arr.length - 1 ? "1px solid rgba(138,39,72,0.12)" : "none",
								display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 90,
							}}>
								<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 2 }}>{label}</div>
								<div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: pink ? "#e11d74" : "#1d1f20", lineHeight: 1 }}>{value}</div>
							</div>
						))}
					</div>
				)}
				{activeTab === "standings" && standingsStats && (
					<div style={{ display: "flex", marginLeft: "auto", borderLeft: "1px solid rgba(138,39,72,0.12)" }}>
						{([
							{ label: "PLAYERS RANKED", value: standingsStats.playersRanked, pink: false },
							{ label: "GAMES",           value: standingsStats.games,         pink: false },
							{ label: "UNBEATEN",        value: standingsStats.unbeaten,      pink: standingsStats.unbeaten > 0 },
						] as { label: string; value: number; pink: boolean }[]).map(({ label, value, pink }, i, arr) => (
							<div key={label} className="session-stat-item" style={{
								padding: "0 22px",
								borderRight: i < arr.length - 1 ? "1px solid rgba(138,39,72,0.12)" : "none",
								display: "flex", flexDirection: "column", justifyContent: "center", minWidth: 90,
							}}>
								<div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 2 }}>{label}</div>
								<div style={{ fontSize: 24, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: pink ? "#e11d74" : "#1d1f20", lineHeight: 1 }}>{value}</div>
							</div>
						))}
					</div>
				)}
			</div>

			{/* ── Tab content ── */}
			<div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
				{tabHeader}
				{activeTab === "overview" && <OverviewTab sessionId={params.sessionId} onStats={setStats} />}
				{activeTab === "players" && <PlayersTab sessionId={params.sessionId} onStats={setPlayerStats} />}
				{activeTab === "games" && <GamesTab sessionId={params.sessionId} onStats={setGameStats} scoringLabel={data?.session?.settings?.scoring?.pointsTarget ? `First to ${data.session.settings.scoring.pointsTarget}` : "Win/loss only · no score entry"} />}
				{activeTab === "standings" && <StandingsTab sessionId={params.sessionId} onStats={setStandingsStats} />}
			</div>
		</div>
	);
}
