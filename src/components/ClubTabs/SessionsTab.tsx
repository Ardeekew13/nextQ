"use client";

import { useEffect, useState } from "react";
import { Button, Input, Tag, Dropdown, App } from "antd";
import { useMutation } from "@apollo/client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { humanizeStatus } from "@/lib/format";
import { DELETE_SESSION } from "@/graphql/documents/organiser";

interface SessionsTabProps {
	club: any;
	activeTab: string;
	setActiveTab: (tab: string) => void;
	onTabChange?: () => void;
	isAdmin?: boolean;
}

export function SessionsTab({ club, activeTab, setActiveTab, onTabChange, isAdmin }: SessionsTabProps) {
	const router = useRouter();
	const { message, modal } = App.useApp();
	const [searchValue, setSearchValue] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");
	const [deleteSession] = useMutation(DELETE_SESSION);

	function handleDeleteSession(sessionId: string, sessionName: string) {
		modal.confirm({
			title: `Delete "${sessionName}"?`,
			content: "This permanently deletes the session, its courts, players, and game history. This cannot be undone.",
			okText: "Delete",
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await deleteSession({ variables: { id: sessionId } });
					message.success("Session deleted");
					onTabChange?.();
				} catch (err) {
					message.error(err instanceof Error ? err.message : "Could not delete session");
				}
			},
		});
	}

	useEffect(() => {
		if (activeTab === "sessions" && onTabChange) {
			onTabChange();
		}
	}, [activeTab, onTabChange]);

	if (activeTab !== "sessions") return null;

	const statusMap: Record<string, string[]> = {
		all: ["DRAFT", "ACTIVE", "PAUSED", "COMPLETED", "CANCELLED"],
		live: ["ACTIVE", "PAUSED"],
		drafts: ["DRAFT"],
		completed: ["COMPLETED"],
	};

	const filteredSessions = (club.sessions ?? []).filter((session: any) => {
		const matchesStatus = statusMap[filterStatus].includes(session.status);
		const matchesSearch = !searchValue || session.name.toLowerCase().includes(searchValue.toLowerCase());
		return matchesStatus && matchesSearch;
	});

	return (
		<>
			<style>{`
				@media (max-width: 768px) {
					.sessions-search-filter {
						display: flex;
						gap: 8px;
						margin-bottom: 16px;
						align-items: stretch;
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
						flex-wrap: nowrap;
					}
					.sessions-search-input {
						flex-shrink: 0;
						width: 160px;
					}
					.sessions-search-input input {
						font-size: 12px !important;
						padding: 4px 8px !important;
					}
					.sessions-filter-buttons {
						display: flex;
						gap: 0;
						border: 1px solid #d4d7db;
						flex-shrink: 0;
					}
					.sessions-filter-buttons button {
						padding: 6px 10px !important;
						font-size: 11px !important;
						white-space: nowrap;
					}
					.sessions-table-wrapper {
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
					}
					.repeat-prompt {
						flex-direction: column;
						gap: 16px;
					}
					.repeat-prompt-buttons {
						flex-direction: column;
						gap: 8px;
					}
					.repeat-prompt-buttons button {
						width: 100% !important;
					}
					.repeat-prompt-heading {
						font-size: 20px !important;
					}
					.repeat-prompt-copy {
						font-size: 12px !important;
					}
				}

				@media (max-width: 480px) {
					.sessions-search-filter {
						gap: 6px;
					}
					.sessions-search-input {
						width: 120px;
					}
					.sessions-search-input input {
						font-size: 11px !important;
						padding: 3px 6px !important;
					}
					.sessions-filter-buttons button {
						padding: 4px 8px !important;
						font-size: 10px !important;
					}
					.repeat-prompt {
						padding: 16px !important;
					}
					.repeat-prompt-heading {
						font-size: 18px !important;
					}
					.repeat-prompt-copy {
						font-size: 11px !important;
					}
					.repeat-prompt-buttons button {
						font-size: 11px !important;
						padding: 8px 12px !important;
						height: auto !important;
					}
				}
			`}</style>

			{/* Search and Filter */}
			<div className="sessions-search-filter" style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
				<div className="sessions-search-input">
					<Input
						placeholder="Search sessions..."
						value={searchValue}
						onChange={(e) => setSearchValue(e.target.value)}
						style={{ maxWidth: 280 }}
						prefix={<span style={{ color: "rgba(29,31,32,0.3)" }}>🔍</span>}
					/>
				</div>
				<div className="sessions-filter-buttons" style={{ display: "flex", gap: 0, border: "1px solid #d4d7db" }}>
					{(["all", "live", "drafts", "completed"] as const).map((f) => (
						<button
							key={f}
							onClick={() => setFilterStatus(f)}
							style={{
								padding: "6px 12px",
								border: "none",
								background: filterStatus === f ? "#f43f75" : "#fff",
								borderRight: f !== "completed" ? "1px solid #d4d7db" : "none",
								fontSize: 12,
								cursor: "pointer",
								color: filterStatus === f ? "#fff" : "rgba(29,31,32,0.6)",
								fontWeight: 600,
							}}
						>
							{f === "all" ? "All" : f === "live" ? "Live" : f === "drafts" ? "Drafts" : "Completed"}
						</button>
					))}
				</div>
			</div>

			{/* Session Table */}
			<div className="sessions-table-wrapper" style={{ marginBottom: 24 }}>
				<div
					className="sessions-table-header"
					style={{
						display: "grid",
						gridTemplateColumns: "minmax(200px, 1fr) 110px 70px 70px 130px 100px 26px",
						gap: 16,
						background: "#fff1f5",
						padding: "12px 16px",
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: "0.1em",
						textTransform: "uppercase",
						color: "#8d1a3f",
						borderBottom: "1px solid rgba(138,39,72,0.12)",
						minWidth: 850,
					}}
				>
					<div>Session</div>
					<div>Date</div>
					<div>Players</div>
					<div>Games</div>
					<div>Winner</div>
					<div>Status</div>
					<div></div>
				</div>
				{filteredSessions.map((session: any) => (
					<Link
						key={session.id}
						href={`/dashboard/sessions/${session.id}`}
						style={{ textDecoration: "none", color: "inherit" }}
					>
						<div
							style={{
								display: "grid",
								gridTemplateColumns: "minmax(200px, 1fr) 110px 70px 70px 130px 100px 26px",
								gap: 16,
								padding: "14px 16px",
								alignItems: "center",
								borderBottom: "1px solid rgba(138,39,72,0.12)",
								background: "#fff",
								minWidth: 850,
							}}
						>
							<div>
								<div style={{ fontWeight: 600, color: "#1d1f20", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>
									{session.name}
								</div>
								<div style={{ fontSize: 12, color: "rgba(29,31,32,0.6)" }}>
									{session.courts?.length ?? 0} courts · {session.settings?.queueMode?.toLowerCase().replace(/_/g, " ") || "queue"}
								</div>
							</div>
							<div style={{ fontSize: 13, color: "rgba(29,31,32,0.6)" }}>
								{new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
							</div>
							<div style={{ fontSize: 13, color: "rgba(29,31,32,0.6)" }}>16</div>
							<div style={{ fontSize: 13, color: "rgba(29,31,32,0.6)" }}>24</div>
							<div style={{ fontSize: 13, color: "rgba(29,31,32,0.6)", borderLeft: "3px solid #8a6620", paddingLeft: "12px" }}>
								Ron D.
							</div>
							<div>
								<Tag style={{ background: "#fff1f5", color: "#8d1a3f", border: "none", borderRadius: 0 }}>
									{humanizeStatus(session.status)}
								</Tag>
							</div>
							<div style={{ textAlign: "center" }} onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}>
								{isAdmin ? (
									<Dropdown
										trigger={["click"]}
										menu={{
											items: [
												{
													key: "delete",
													label: <span style={{ color: "#e11d74" }}>Delete session</span>,
													onClick: () => handleDeleteSession(session.id, session.name),
												},
											],
										}}
									>
										<button
											style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16, color: "rgba(29,31,32,0.5)" }}
										>
											⋯
										</button>
									</Dropdown>
								) : (
									"⋯"
								)}
							</div>
						</div>
					</Link>
				))}
			</div>

			{/* Repeat Prompt */}
			{(() => {
				const hasOngoingSession = (club.sessions ?? []).some(
					(s: any) => s.status === "ACTIVE" || s.status === "PAUSED"
				);
				if (hasOngoingSession) return null;

				const completedSessions = (club.sessions ?? [])
					.filter((s: any) => s.status === "COMPLETED")
					.sort((a: any, b: any) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime());
				const lastSession = completedSessions[0];

				if (!lastSession) return null;

				const courts = lastSession.courts?.length ?? 0;
				const players = lastSession.players?.length ?? 0;
				const queueMode = lastSession.settings?.queueMode?.toLowerCase().replace(/_/g, " ") || "queue";
				const sessionCount = club.sessions?.length ?? 0;

				return (
					<div
						className="repeat-prompt"
						style={{
							border: "1px solid rgba(138,39,72,0.18)",
							borderTop: "3px solid #f43f75",
							padding: "22px 24px",
							marginBottom: 24,
							background: "#fff",
						}}
					>
						<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#bd2153", marginBottom: 8 }}>
							{sessionCount} SESSION{sessionCount !== 1 ? "S" : ""} IN · KEEP IT GOING
						</div>
						<h2 className="repeat-prompt-heading" style={{ fontSize: 25, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20", margin: "0 0 8px 0", lineHeight: 1.2 }}>
							REPEAT {lastSession.name?.toUpperCase()}
						</h2>
						<p className="repeat-prompt-copy" style={{ fontSize: 13, color: "rgba(29,31,32,0.7)", marginBottom: 16, lineHeight: 1.5 }}>
							Reuse {lastSession.name}'s setup — {courts} court{courts !== 1 ? "s" : ""}, {queueMode}, {players} player{players !== 1 ? "s" : ""}. Standings carry over automatically.
						</p>
						<div className="repeat-prompt-buttons" style={{ display: "flex", gap: 8 }}>
							<Button
								type="primary"
								onClick={() => router.push(`/dashboard/clubs/${club.id}/sessions/new?template=${lastSession.id}`)}
								style={{
									background: "#ec4899",
									border: "none",
									fontWeight: 600,
									fontSize: 13,
									padding: "8px 20px",
									height: 40,
									fontFamily: "'Barlow Condensed', sans-serif",
									letterSpacing: "0.04em",
									textTransform: "uppercase",
								}}
							>
								Repeat this session
							</Button>
							<Button
								onClick={() => router.push(`/dashboard/clubs/${club.id}/sessions/new`)}
								style={{
									fontWeight: 600,
									padding: "8px 20px",
									height: 36,
									fontFamily: "'Barlow Condensed', sans-serif",
									letterSpacing: "0.04em",
									textTransform: "uppercase",
								}}
							>
								Start from scratch
							</Button>
						</div>
					</div>
				);
			})()}

			{/* Recent Activity */}
			<div style={{ background: "#fff" }}>
				<div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1d1f20", marginBottom: 16 }}>
					Recent Activity
				</div>
				{[
					// Completed sessions (most recent first)
					...(club.sessions ?? [])
						.filter((s: any) => s.status === "COMPLETED")
						.sort((a: any, b: any) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
						.slice(0, 3)
						.map((session: any) => ({
							date: new Date(session.sessionDate).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
							text: `${session.name} closed · ${session.completedGames?.length ?? 0} games · ${session.players?.length ?? 0} players`,
						})),
					// Club creation
					{
						date: new Date(club.createdAt).toLocaleDateString("en-US", { day: "numeric", month: "short" }),
						text: `${club.name} created`,
					},
				].map((item, idx) => (
					<div key={idx} style={{ display: "flex", gap: 12, paddingBottom: 12, marginBottom: 12, borderBottom: "1px solid rgba(138,39,72,0.06)", fontSize: 13 }}>
						<div style={{ color: "#bd2153", fontWeight: 600, minWidth: 50 }}>{item.date}</div>
						<div style={{ color: "rgba(29,31,32,0.7)" }}>{item.text}</div>
					</div>
				))}
			</div>
		</>
	);
}
