"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { Button, Skeleton, Typography, Table, Modal, Form, Input, Select, App, Popconfirm } from "antd";
import Link from "next/link";
import { CLUB_DETAIL_QUERY, CLUB_MEMBERS_QUERY, ADD_CLUB_MEMBER, UPDATE_CLUB_MEMBER, REMOVE_CLUB_MEMBER } from "@/graphql/documents/organiser";
import { CLUB_STANDINGS_QUERY } from "@/graphql/documents/public";
import { useNavbarActions } from "@/components/NavbarActionsContext";
import { humanizeStatus } from "@/lib/format";

const { Text } = Typography;

type Session = {
	id: string;
	name: string;
	status: string;
	sessionDate: string;
	startTime?: string;
	publicUrl: string;
	settings?: { queueMode?: string };
	courts?: { id: string }[];
	players?: { id: string; checkedIn: boolean; wins: number; losses: number; gamesPlayed: number; name: string }[];
	completedGames?: { id: string }[];
};

function formatSessionDate(date: string, startTime?: string) {
	const d = new Date(date);
	const dateStr = d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
	return startTime ? `${dateStr} · ${startTime}` : dateStr;
}

function minutesUntil(date: string, startTime?: string) {
	const base = new Date(date);
	if (startTime) {
		const [h, m] = startTime.split(":").map(Number);
		base.setHours(h, m, 0, 0);
	}
	return Math.round((base.getTime() - Date.now()) / 60000);
}

export default function ClubDetailPage() {
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const { setTitle, setActions } = useNavbarActions();
	const [sessionFilter, setSessionFilter] = useState<"all" | "drafts" | "done">("all");
	const [view, setView] = useState<"sessions" | "standings" | "players">("sessions");

	const { data, loading } = useQuery(CLUB_DETAIL_QUERY, {
		variables: { id: params.clubId },
	});

	const club = data?.club;
	const sessions: Session[] = club?.sessions ?? [];

	const { data: standingsData, loading: standingsLoading } = useQuery(CLUB_STANDINGS_QUERY, {
		variables: { slug: club?.slug },
		skip: !club?.slug || view !== "standings",
	});
	const clubStandings: any[] = standingsData?.clubStandings ?? [];

	const { data: membersData, loading: membersLoading, refetch: refetchMembers } = useQuery(CLUB_MEMBERS_QUERY, {
		variables: { clubId: params.clubId },
		skip: view !== "players",
	});
	const members: any[] = membersData?.clubMembers ?? [];

	const [addMember, { loading: adding }] = useMutation(ADD_CLUB_MEMBER);
	const [updateMember, { loading: updating }] = useMutation(UPDATE_CLUB_MEMBER);
	const [removeMember] = useMutation(REMOVE_CLUB_MEMBER);

	const [addOpen, setAddOpen] = useState(false);
	const [editingMember, setEditingMember] = useState<any>(null);
	const [memberForm] = Form.useForm();
	const { message } = App.useApp();

	// Aggregate stats
	const completedSessions = sessions.filter((s) => s.status === "COMPLETED");
	// 2. Derive games logged from session gamesCount field, not stale club counter
	const totalGamesLogged = sessions.reduce((n, s) => n + ((s as any).gamesCount ?? (s.completedGames ?? []).length), 0);
	const uniquePlayerCounts = completedSessions.map((s) => (s.players ?? []).length);
	const avgTurnout = uniquePlayerCounts.length
		? Math.round(uniquePlayerCounts.reduce((a, b) => a + b, 0) / uniquePlayerCounts.length)
		: 0;
	const draftCount = sessions.filter((s) => s.status === "DRAFT").length;

	// Up next: nearest upcoming draft or active session
	const upcoming = [...sessions]
		.filter((s) => s.status === "DRAFT" || s.status === "ACTIVE" || s.status === "PAUSED")
		.sort((a, b) => new Date(a.sessionDate).getTime() - new Date(b.sessionDate).getTime());
	const upNext = upcoming[0] ?? null;

	// Organisers
	const organisers: { id: string; name: string; role: string }[] = club?.organisers ?? [];

	// Filtered sessions table
	const filteredSessions = sessions.filter((s) => {
		if (sessionFilter === "drafts") return s.status === "DRAFT";
		if (sessionFilter === "done") return s.status === "COMPLETED" || s.status === "CANCELLED";
		return true;
	});

	async function handleAddMember(values: any) {
		try {
			await addMember({ variables: { clubId: params.clubId, input: values } });
			message.success("Player added");
			setAddOpen(false);
			memberForm.resetFields();
			refetchMembers();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not add player");
		}
	}

	async function handleEditMember(values: any) {
		if (!editingMember) return;
		try {
			await updateMember({ variables: { id: editingMember.id, input: values } });
			message.success("Player updated");
			setEditingMember(null);
			memberForm.resetFields();
			refetchMembers();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not update player");
		}
	}

	async function handleRemoveMember(id: string) {
		try {
			await removeMember({ variables: { id } });
			message.success("Player removed");
			refetchMembers();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not remove player");
		}
	}

	useEffect(() => {
		const now = new Date();
		const hour = now.getHours();
		const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
		const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", second: "2-digit", hour12: false });
		const dayStr = now.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" }).toUpperCase();

		setTitle(
			<div>
				<Text style={{ fontSize: 11, fontWeight: 600, color: "#bd2153", letterSpacing: "0.2em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
					{dayStr} · {timeStr}
				</Text>
				<h1 style={{ fontSize: 28, margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: "#1d1f20", lineHeight: 1.2 }}>
					{greeting}, Ron
				</h1>
			</div>,
		);
		setActions(
			<div style={{ display: "flex", gap: 8 }}>
				<Button>Join club</Button>
				<Button>Create club</Button>
				<Button type="primary" style={{ background: "#f43f75", borderColor: "#f43f75", fontWeight: 700 }}
					onClick={() => router.push(`/dashboard/clubs/${params.clubId}/sessions/new`)}>
					New session
				</Button>
			</div>,
		);
	}, [club]);

	if (loading) return <Skeleton active />;
	if (!club) return <Text>Club not found.</Text>;

	// 1. Fix createdAt parsing (Firestore Timestamp → Date)
	let createdDate = club.createdAt;
	if (createdDate && typeof createdDate === "object" && "toDate" in createdDate) {
		createdDate = (createdDate as any).toDate();
		console.log("Firestore Timestamp converted:", createdDate);
	} else {
		console.log("Raw createdAt:", createdDate, "Type:", typeof createdDate);
	}
	const formattedCreated = createdDate
		? new Date(createdDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
		: "Unknown date";

	return (
		<div>
			<style>{`
				/* Up Next Banner responsive */
				@media (max-width: 768px) {
					.club-up-next-banner {
						flex-direction: column !important;
						padding: 16px !important;
						gap: 16px !important;
					}
					.club-up-next-content {
						flex: 1;
					}
					.club-up-next-stats {
						flex-direction: column !important;
						gap: 12px !important;
						margin-right: 0 !important;
						width: 100%;
					}
					.club-up-next-stat-item {
						padding: 0 !important;
						border-left: none !important;
						border-bottom: 1px solid rgba(255,255,255,0.15) !important;
						padding-bottom: 12px !important;
					}
					.club-up-next-stat-item:last-child {
						border-bottom: none !important;
						padding-bottom: 0 !important;
					}
					.club-up-next-actions {
						min-width: auto !important;
						width: 100% !important;
					}
					.club-up-next-actions button {
						width: 100% !important;
						height: 40px !important;
					}
					.club-up-next-title {
						font-size: 20px !important;
					}
					.club-up-next-meta {
						font-size: 11px !important;
					}
				}

				@media (max-width: 480px) {
					.club-up-next-banner {
						padding: 12px !important;
						gap: 12px !important;
					}
					.club-up-next-title {
						font-size: 18px !important;
					}
					.club-up-next-label {
						font-size: 9px !important;
					}
					.club-up-next-stat {
						font-size: 22px !important;
					}
					.club-up-next-actions {
						gap: 6px !important;
					}
				}

				/* Stats row responsive */
				@media (max-width: 768px) {
					.club-stats-row {
						grid-template-columns: 1fr 1fr !important;
					}
				}

				@media (max-width: 480px) {
					.club-stats-row {
						grid-template-columns: 1fr !important;
					}
					.club-stats-row > div {
						border-right: none !important;
						border-bottom: 1px solid rgba(138,39,72,0.18) !important;
						padding: 14px 16px !important;
					}
					.club-stats-row > div:last-child {
						border-bottom: none !important;
					}
				}

				/* View toggle responsive */
				@media (max-width: 768px) {
					.club-view-toggle {
						gap: 0 !important;
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
					}
					.club-view-toggle button {
						padding: 8px 16px !important;
						font-size: 11px !important;
						white-space: nowrap;
						flex-shrink: 0;
					}
				}

				/* Sessions container responsive */
				@media (max-width: 768px) {
					.club-sessions-container {
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
					}
					.club-sessions-container .ant-table {
						font-size: 12px;
					}
					.club-sessions-container .ant-table thead > tr > th {
						padding: 8px 12px !important;
						font-size: 10px !important;
					}
					.club-sessions-container .ant-table tbody > tr > td {
						padding: 10px 12px !important;
						font-size: 11px !important;
					}
				}

				@media (max-width: 480px) {
					.club-sessions-container .ant-table {
						font-size: 11px;
					}
					.club-sessions-container .ant-table thead > tr > th {
						padding: 6px 8px !important;
						font-size: 9px !important;
					}
					.club-sessions-container .ant-table tbody > tr > td {
						padding: 8px 6px !important;
						font-size: 10px !important;
					}
				}

				/* Standings table responsive */
				@media (max-width: 768px) {
					.club-standings-container {
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
					}
					.club-standings-header,
					.club-standings-row {
						display: flex !important;
						flex-wrap: nowrap;
						min-width: 600px;
					}
					.club-standings-header {
						padding: 10px 16px !important;
						gap: 8px !important;
						display: flex !important;
					}
					.club-standings-header span {
						flex: 0 0 auto;
						padding: 0 !important;
						font-size: 10px !important;
						min-width: 60px;
					}
					.club-standings-row {
						padding: 12px 16px !important;
						gap: 8px !important;
						display: flex !important;
						align-items: center !important;
					}
					.club-standings-row > span,
					.club-standings-row > div {
						flex: 0 0 auto;
						font-size: 11px !important;
						min-width: 60px;
						padding: 0 !important;
					}
					.club-standings-row > div:first-child {
						min-width: 150px;
					}
				}

				@media (max-width: 480px) {
					.club-standings-header span {
						font-size: 9px !important;
						min-width: 50px;
					}
					.club-standings-row > span,
					.club-standings-row > div {
						font-size: 10px !important;
						min-width: 50px;
					}
					.club-standings-row > div:first-child {
						min-width: 120px;
					}
				}

				/* Players table responsive */
				@media (max-width: 768px) {
					.club-players-container {
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
					}
					.club-players-header,
					.club-players-row {
						display: flex !important;
						flex-wrap: nowrap;
						min-width: 700px;
					}
					.club-players-header {
						padding: 10px 16px !important;
						gap: 8px !important;
						display: flex !important;
					}
					.club-players-header span {
						flex: 0 0 auto;
						padding: 0 !important;
						font-size: 10px !important;
						min-width: 70px;
					}
					.club-players-row {
						padding: 12px 16px !important;
						gap: 8px !important;
						display: flex !important;
						align-items: center !important;
					}
					.club-players-row > div,
					.club-players-row > span {
						flex: 0 0 auto;
						font-size: 11px !important;
						min-width: 70px;
						padding: 0 !important;
					}
					.club-players-row > div:first-child {
						min-width: 150px;
					}
					.club-players-row > div:last-child {
						min-width: 100px;
						display: flex !important;
						gap: 4px;
						flex-direction: row;
					}
					.club-players-row > div:last-child button {
						padding: 2px 6px !important;
						font-size: 10px !important;
						height: auto !important;
						white-space: nowrap;
					}
				}

				@media (max-width: 480px) {
					.club-players-header span {
						font-size: 9px !important;
						min-width: 60px;
					}
					.club-players-row > div,
					.club-players-row > span {
						font-size: 10px !important;
						min-width: 60px;
					}
					.club-players-row > div:first-child {
						min-width: 120px;
					}
					.club-players-row > div:last-child {
						min-width: 80px;
						gap: 2px;
					}
				}

				/* Modal responsive */
				@media (max-width: 768px) {
					.ant-modal {
						width: calc(100vw - 32px) !important;
						max-width: 100% !important;
					}
				}

				@media (max-width: 480px) {
					.ant-modal {
						width: calc(100vw - 16px) !important;
					}
					.ant-modal-header {
						padding: 12px 16px !important;
					}
					.ant-modal-body {
						padding: 12px 16px !important;
					}
					.ant-modal-footer {
						padding: 12px 16px !important;
					}
				}
			`}</style>

			{/* ── Up Next Banner ── */}
			{upNext && (() => {
				const mins = minutesUntil(upNext.sessionDate, upNext.startTime);
				const courtsCount = (upNext.courts ?? []).length;
				const checkedIn = (upNext.players ?? []).filter((p) => p.checkedIn).length;
				const rsvpd = (upNext.players ?? []).length;
				const queueLabel = upNext.settings?.queueMode?.toLowerCase().replace(/_/g, " ") ?? "";
				const isLive = upNext.status === "ACTIVE" || upNext.status === "PAUSED";
				const metaParts = [
					club.name,
					upNext.startTime ?? null,
					courtsCount > 0 ? `${courtsCount} courts` : null,
					queueLabel || null,
				].filter(Boolean);

				return (
					<div className="club-up-next-banner" style={{ background: "#5a0b2e", color: "#fff", padding: "24px 28px", marginBottom: 24, display: "flex", alignItems: "stretch", gap: 0 }}>
						<div className="club-up-next-content" style={{ flex: 1 }}>
							<div className="club-up-next-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.55)", marginBottom: 10 }}>
								{isLive ? "● LIVE NOW" : mins > 0 ? `UP NEXT · STARTS IN ${mins} MIN` : "UP NEXT"}
							</div>
							<div className="club-up-next-title" style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
								{upNext.name}
							</div>
							<div className="club-up-next-meta" style={{ fontSize: 12, color: "rgba(255,255,255,0.6)", fontWeight: 500 }}>
								{metaParts.join(" · ")}
							</div>
						</div>

						{/* Stats */}
						<div className="club-up-next-stats" style={{ display: "flex", alignItems: "stretch", gap: 0, marginRight: 32 }}>
							{[
								{ label: "RSVP'D", value: rsvpd },
								{ label: "CHECKED IN", value: checkedIn },
								{ label: "STATUS", value: humanizeStatus(upNext.status).toUpperCase() },
							].map(({ label, value }) => (
								<div key={label} className="club-up-next-stat-item" style={{ padding: "0 28px", display: "flex", flexDirection: "column", justifyContent: "center", borderLeft: "1px solid rgba(255,255,255,0.15)" }}>
									<div className="club-up-next-stat-label" style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 6 }}>{label}</div>
									<div className="club-up-next-stat" style={{ fontSize: 26, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif" }}>{value}</div>
								</div>
							))}
						</div>

						{/* Actions */}
						<div className="club-up-next-actions" style={{ display: "flex", flexDirection: "column", gap: 8, justifyContent: "center", minWidth: 160 }}>
							{isLive ? (
								<Button
									style={{ background: "#fff", color: "#5a0b2e", fontWeight: 700, border: "none", height: 44 }}
									block
									onClick={() => router.push(`/dashboard/sessions/${upNext.id}`)}
								>
									VIEW SESSION
								</Button>
							) : (
								<Button
									style={{ background: "#fff", color: "#5a0b2e", fontWeight: 700, border: "none", height: 44 }}
									block
									onClick={() => router.push(`/dashboard/sessions/${upNext.id}`)}
								>
									OPEN THE QUEUE
								</Button>
							)}
							<Button
								style={{ background: "transparent", color: "#fff", fontWeight: 600, borderColor: "rgba(255,255,255,0.35)", height: 40 }}
								block
								onClick={() => router.push(`/dashboard/clubs/${params.clubId}/sessions/new`)}
							>
								Edit setup
							</Button>
						</div>
					</div>
				);
			})()}

			{/* ── Stats Row ── */}
			<div className="club-stats-row" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", marginBottom: 28, border: "1px solid rgba(138,39,72,0.18)", background: "#fff" }}>
				<div style={{ padding: "18px 24px", borderRight: "1px solid rgba(138,39,72,0.18)" }}>
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>Sessions Run</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
						<span style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1 }}>{completedSessions.length}</span>
						<span style={{ fontSize: 12, color: "rgba(29,31,32,0.4)" }}>this month</span>
					</div>
				</div>
				<div style={{ padding: "18px 24px", borderRight: "1px solid rgba(138,39,72,0.18)" }}>
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>Games Logged</div>
					<div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1 }}>{totalGamesLogged}</div>
				</div>
				<div style={{ padding: "18px 24px", borderRight: "1px solid rgba(138,39,72,0.18)" }}>
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>Avg Turnout</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
						<span style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1 }}>{avgTurnout || "—"}</span>
						{avgTurnout > 0 && <span style={{ fontSize: 12, color: "rgba(29,31,32,0.4)" }}>players</span>}
					</div>
				</div>
				<div style={{ padding: "18px 24px", background: draftCount > 0 ? "#fff5f7" : undefined }}>
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: draftCount > 0 ? "#bd2153" : "rgba(29,31,32,0.45)", marginBottom: 6 }}>
						{draftCount > 0 ? "Needs Attention" : "Drafts"}
					</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
						<span style={{ fontSize: 32, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: draftCount > 0 ? "#bd2153" : "#1d1f20", lineHeight: 1 }}>{draftCount}</span>
						{draftCount > 0 && <span style={{ fontSize: 12, color: "#bd2153" }}>draft unpublished</span>}
					</div>
				</div>
			</div>

			{/* ── View Toggle ── */}
			<div className="club-view-toggle" style={{ display: "flex", gap: 0, marginBottom: 20, borderBottom: "2px solid rgba(138,39,72,0.12)" }}>
				{(["sessions", "players", "standings"] as const).map((v) => (
					<button
						key={v}
						onClick={() => setView(v)}
						style={{
							padding: "10px 24px",
							fontSize: 12,
							fontWeight: 700,
							letterSpacing: "0.12em",
							textTransform: "uppercase",
							border: "none",
							borderBottom: view === v ? "2px solid #e11d74" : "2px solid transparent",
							background: "transparent",
							color: view === v ? "#e11d74" : "rgba(29,31,32,0.45)",
							cursor: "pointer",
							marginBottom: -2,
						}}
					>
						{v === "sessions" ? "Sessions" : v === "players" ? `Players (${club?.memberCount ?? 0})` : "Standings"}
					</button>
				))}
			</div>

			{/* ── Sessions ── */}
			{view === "sessions" && (
			<div className="club-sessions-container">
				<div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
					<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#1d1f20", whiteSpace: "nowrap" }}>
						{club.name} Sessions
					</span>
					<div style={{ flex: 1, height: 1, background: "rgba(138,39,72,0.2)" }} />
				</div>

				{/* Filter tabs */}
				<div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
					{(["all", "drafts", "done"] as const).map((f) => (
						<button
							key={f}
							onClick={() => setSessionFilter(f)}
							style={{
								padding: "5px 16px",
								fontSize: 12,
								fontWeight: 600,
								border: "1px solid",
								borderColor: sessionFilter === f ? "#f43f75" : "rgba(29,31,32,0.2)",
								background: sessionFilter === f ? "#f43f75" : "#fff",
								color: sessionFilter === f ? "#fff" : "#1d1f20",
								cursor: "pointer",
								textTransform: "capitalize",
							}}
						>
							{f === "all" ? "All" : f === "drafts" ? "Drafts" : "Done"}
						</button>
					))}
				</div>

				<Table
					rowKey="id"
					size="small"
					pagination={false}
					dataSource={filteredSessions}
					onRow={(record) => ({ onClick: () => router.push(`/dashboard/sessions/${record.id}`), style: { cursor: "pointer" } })}
					columns={[
						{
							title: "Session",
							dataIndex: "name",
							width: 520,
							render: (name: string, row: Session) => {
								const courtsCount = (row.courts ?? []).length;
								const queueLabel = row.settings?.queueMode?.toLowerCase().replace(/_/g, " ") ?? "queue";
								return (
									<div>
										<div style={{ fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", fontSize: 14 }}>{name}</div>
										<div style={{ fontSize: 12, color: "rgba(29,31,32,0.6)" }}>
											{courtsCount > 0 ? `${courtsCount} court${courtsCount !== 1 ? 's' : ''}` : '0 courts'} · {queueLabel}
										</div>
									</div>
								);
							},
						},
						{
							title: "Date",
							dataIndex: "sessionDate",
							width: 110,
							align: "right" as const,
							render: (date: string, row: Session) => (
								<span style={{ fontSize: 12 }}>{formatSessionDate(date, row.startTime)}</span>
							),
						},
						{
							title: "Players",
							render: (_: unknown, row: Session) => {
								const n = (row.players ?? []).length;
								if (row.status === "DRAFT") return <span style={{ textAlign: "right", display: "block" }}>{n > 0 ? `${n} RSVP` : "—"}</span>;
								return <span style={{ textAlign: "right", display: "block" }}>{n || "—"}</span>;
							},
							width: 70,
							align: "right" as const,
						},
						{
							title: "Games",
							render: (_: unknown, row: Session) => (
								<span style={{ textAlign: "right", display: "block" }}>{(row.completedGames ?? []).length || "—"}</span>
							),
							width: 70,
							align: "right" as const,
						},
						{
							title: "Winner",
							render: () => "—",
							width: 130,
						},
						{
							title: "Status",
							dataIndex: "status",
							width: 100,
							render: (status: string) => {
								const isDraft = status === "DRAFT";
								const isLive = status === "ACTIVE" || status === "PAUSED";
								return (
									<span style={{
										fontSize: 11, fontWeight: 600, padding: "2px 10px",
										border: `1px solid ${isLive ? "rgba(22,163,74,0.4)" : "rgba(29,31,32,0.2)"}`,
										color: isLive ? "#16a34a" : isDraft ? "#f43f75" : "rgba(29,31,32,0.55)",
										whiteSpace: "nowrap",
									}}>
										{humanizeStatus(status)}
									</span>
								);
							},
						},
						{
							title: "",
							render: () => "⋯",
							width: 26,
							align: "center" as const,
						},
					]}
				/>

				{sessions.length > 5 && (
					<div style={{ marginTop: 14 }}>
						<Link href={`/dashboard/clubs/${params.clubId}`} style={{ fontSize: 12, fontWeight: 600, color: "#bd2153", textDecoration: "underline" }}>
							View all {sessions.length} sessions
						</Link>
					</div>
				)}
			</div>
			)}

			{/* ── Standings View ── */}
			{view === "standings" && (
				<div className="club-standings-container">
					{standingsLoading ? (
						<Skeleton active />
					) : clubStandings.length === 0 ? (
						<div style={{ padding: "40px 0", textAlign: "center", color: "rgba(29,31,32,0.4)", fontSize: 13 }}>
							No standings data yet. Complete some sessions to see results.
						</div>
					) : (
						<>
							{/* Table header */}
							<div className="club-standings-header" style={{
								display: "grid",
								gridTemplateColumns: "48px 1fr 80px 100px 90px 80px",
								padding: "10px 16px",
								background: "#f9f0f4",
								borderTop: "1px solid rgba(138,39,72,0.12)",
								borderBottom: "2px solid rgba(225,29,116,0.18)",
								gap: 8,
							}}>
								{["RANK", "PLAYER", "GP", "W–L", "WIN %", "SESSIONS"].map((h) => (
									<span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#bd2153", textTransform: "uppercase" }}>{h}</span>
								))}
							</div>
							{clubStandings.map((row: any, i: number) => (
								<div
									key={i}
									className="club-standings-row"
									style={{
										display: "grid",
										gridTemplateColumns: "48px 1fr 80px 100px 90px 80px",
										padding: "12px 16px",
										gap: 8,
										borderBottom: "1px solid rgba(138,39,72,0.07)",
										background: i % 2 === 0 ? "#fff" : "#fdfafa",
										alignItems: "center",
									}}
								>
									<span style={{ fontSize: 13, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: i === 0 ? "#d4af37" : i === 1 ? "#9ca3af" : i === 2 ? "#b06a3d" : "rgba(29,31,32,0.4)" }}>
										{row.rank}
									</span>
									<div>
										<span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20" }}>
											{row.name}
										</span>
										{row.nickname && (
											<span style={{ fontSize: 11, color: "rgba(29,31,32,0.45)", marginLeft: 6 }}>{row.nickname}</span>
										)}
									</div>
									<span style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}>{row.totalGames}</span>
									<span style={{ fontSize: 13, color: "rgba(29,31,32,0.7)" }}>{row.wins}–{row.losses}</span>
									<span style={{ fontSize: 13, fontWeight: 600, color: row.winRate >= 0.6 ? "#16a34a" : row.winRate <= 0.3 ? "#dc2626" : "#1d1f20" }}>
										{(row.winRate * 100).toFixed(0)}%
									</span>
									<span style={{ fontSize: 13, color: "rgba(29,31,32,0.55)" }}>{row.sessionsPlayed}</span>
								</div>
							))}
						</>
					)}
				</div>
			)}

			{/* ── Players View ── */}
			{view === "players" && (
				<div className="club-players-container">
					<div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
						<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(29,31,32,0.5)" }}>
							{members.length} {members.length === 1 ? "Player" : "Players"}
						</span>
						<Button
							type="primary"
							size="small"
							style={{ background: "#e11d74", borderColor: "#e11d74", fontWeight: 700 }}
							onClick={() => { memberForm.resetFields(); setAddOpen(true); }}
						>
							+ Add Player
						</Button>
					</div>

					{membersLoading ? (
						<Skeleton active />
					) : members.length === 0 ? (
						<div style={{ padding: "40px 0", textAlign: "center", color: "rgba(29,31,32,0.4)", fontSize: 13 }}>
							No players yet. Add your first player to build the roster.
						</div>
					) : (
						<>
							{/* Table header */}
							<div className="club-players-header" style={{
								display: "grid",
								gridTemplateColumns: "1fr 120px 80px 80px 80px 100px",
								padding: "10px 16px",
								background: "#f9f0f4",
								borderTop: "1px solid rgba(138,39,72,0.12)",
								borderBottom: "2px solid rgba(225,29,116,0.18)",
								gap: 8,
							}}>
								{["NAME", "SKILL", "GP", "SESSIONS", "ACTIVE", ""].map((h) => (
									<span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", color: "#bd2153", textTransform: "uppercase" }}>{h}</span>
								))}
							</div>
							{members.map((m: any, i: number) => (
								<div
									key={m.id}
									className="club-players-row"
									style={{
										display: "grid",
										gridTemplateColumns: "1fr 120px 80px 80px 80px 100px",
										padding: "12px 16px",
										gap: 8,
										borderBottom: "1px solid rgba(138,39,72,0.07)",
										background: i % 2 === 0 ? "#fff" : "#fdfafa",
										alignItems: "center",
									}}
								>
									<div>
										<span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20" }}>
											{m.name}
										</span>
										{m.nickname && (
											<span style={{ fontSize: 11, color: "rgba(29,31,32,0.45)", marginLeft: 6 }}>{m.nickname}</span>
										)}
									</div>
									<span style={{ fontSize: 12, color: "rgba(29,31,32,0.6)", textTransform: "capitalize" }}>
										{m.skillLevel?.replace(/_/g, " ").toLowerCase() ?? "—"}
									</span>
									<span style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}>{m.totalGames ?? 0}</span>
									<span style={{ fontSize: 13, color: "rgba(29,31,32,0.55)" }}>{m.sessionsPlayed ?? 0}</span>
									<span style={{
										fontSize: 11, fontWeight: 600, padding: "2px 8px",
										border: `1px solid ${m.active ? "rgba(22,163,74,0.4)" : "rgba(29,31,32,0.2)"}`,
										color: m.active ? "#16a34a" : "rgba(29,31,32,0.4)",
										display: "inline-block",
									}}>
										{m.active ? "Active" : "Inactive"}
									</span>
									<div style={{ display: "flex", gap: 6 }}>
										<Button
											size="small"
											onClick={() => {
												setEditingMember(m);
												memberForm.setFieldsValue({ name: m.name, nickname: m.nickname, skillLevel: m.skillLevel });
											}}
										>
											Edit
										</Button>
										<Popconfirm
											title="Remove this player from the club?"
											okText="Remove"
											okButtonProps={{ danger: true }}
											onConfirm={() => handleRemoveMember(m.id)}
										>
											<Button size="small" danger>✕</Button>
										</Popconfirm>
									</div>
								</div>
							))}
						</>
					)}
				</div>
			)}

			{/* ── Add Player Modal ── */}
			<Modal
				title="Add Player"
				open={addOpen}
				onCancel={() => { setAddOpen(false); memberForm.resetFields(); }}
				onOk={() => memberForm.submit()}
				confirmLoading={adding}
				okText="Add Player"
			>
				<Form form={memberForm} layout="vertical" onFinish={handleAddMember} requiredMark={false} style={{ marginTop: 12 }}>
					<Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
						<Input size="large" placeholder="Full name" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" placeholder="Optional" />
					</Form.Item>
					<Form.Item label="Skill Level" name="skillLevel">
						<Select size="large" placeholder="Select skill level" allowClear options={[
							{ value: "NOVICE", label: "Novice" },
							{ value: "BEGINNER_LOW", label: "Beginner (low)" },
							{ value: "BEGINNER_HIGH", label: "Beginner (high)" },
							{ value: "INTERMEDIATE", label: "Intermediate" },
							{ value: "ADVANCED", label: "Advanced" },
						]} />
					</Form.Item>
				</Form>
			</Modal>

			{/* ── Edit Player Modal ── */}
			<Modal
				title="Edit Player"
				open={!!editingMember}
				onCancel={() => { setEditingMember(null); memberForm.resetFields(); }}
				onOk={() => memberForm.submit()}
				confirmLoading={updating}
				okText="Save"
			>
				<Form form={memberForm} layout="vertical" onFinish={handleEditMember} requiredMark={false} style={{ marginTop: 12 }}>
					<Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter a name" }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" placeholder="Optional" />
					</Form.Item>
					<Form.Item label="Skill Level" name="skillLevel">
						<Select size="large" allowClear options={[
							{ value: "NOVICE", label: "Novice" },
							{ value: "BEGINNER_LOW", label: "Beginner (low)" },
							{ value: "BEGINNER_HIGH", label: "Beginner (high)" },
							{ value: "INTERMEDIATE", label: "Intermediate" },
							{ value: "ADVANCED", label: "Advanced" },
						]} />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
