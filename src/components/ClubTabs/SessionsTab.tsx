"use client";

import { useState } from "react";
import { Button, Input, Tag } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { humanizeStatus } from "@/lib/format";

interface SessionsTabProps {
	club: any;
	activeTab: string;
	setActiveTab: (tab: string) => void;
}

export function SessionsTab({ club, activeTab, setActiveTab }: SessionsTabProps) {
	const router = useRouter();
	const [searchValue, setSearchValue] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");

	if (activeTab !== "sessions") return null;

	return (
		<>
			{/* Search and Filter */}
			<div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
				<Input
					placeholder="Search sessions..."
					value={searchValue}
					onChange={(e) => setSearchValue(e.target.value)}
					style={{ maxWidth: 280 }}
					prefix={<span style={{ color: "rgba(29,31,32,0.3)" }}>🔍</span>}
				/>
				<div style={{ display: "flex", gap: 0, border: "1px solid #d4d7db" }}>
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
			<div style={{ marginBottom: 24 }}>
				<div
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
				{(club.sessions ?? []).map((session: any) => (
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
							}}
						>
							<div>
								<div style={{ fontWeight: 600, color: "#1d1f20", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 14 }}>
									{session.name}
								</div>
								<div style={{ fontSize: 12, color: "rgba(29,31,32,0.6)" }}>
									{session.courts?.length ?? 0} courts · {session.settings?.queueMode?.toLowerCase().replace(/_/g, " ") || "queue"} · 1h 52m
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
							<div style={{ textAlign: "center" }}>⋯</div>
						</div>
					</Link>
				))}
			</div>

			{/* Repeat Prompt */}
			<div
				style={{
					border: "1px solid rgba(138,39,72,0.18)",
					borderTop: "3px solid #f43f75",
					padding: "22px 24px",
					marginBottom: 24,
					background: "#fff",
				}}
			>
				<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#bd2153", marginBottom: 8 }}>
					ONE SESSION IN · KEEP IT GOING
				</div>
				<h2 style={{ fontSize: 25, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20", margin: "0 0 8px 0", lineHeight: 1.2 }}>
					SET UP NEXT SATURDAY
				</h2>
				<p style={{ fontSize: 13, color: "rgba(29,31,32,0.7)", marginBottom: 16, lineHeight: 1.5 }}>
					Reuse Saturday OP's setup — 2 courts, hybrid queue, same 16 players. Standings carry over automatically.
				</p>
				<div style={{ display: "flex", gap: 8 }}>
					<Button
						type="primary"
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

			{/* Recent Activity */}
			<div style={{ background: "#fff" }}>
				<div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: "#1d1f20", marginBottom: 16 }}>
					Recent Activity
				</div>
				{[
					{ date: "1 Aug", text: "Saturday OP closed · 24 games · Ron D. unbeaten" },
					{ date: "1 Aug", text: "16 players checked in by QR" },
					{ date: "28 Jul", text: "Roster imported · 16 members added" },
					{ date: "12 Jul", text: `${club.name} created` },
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
