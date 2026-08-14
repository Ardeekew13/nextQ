"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@apollo/client";
import { App, Button } from "antd";
import { CREATE_SESSION, CLUB_DETAIL_QUERY } from "@/graphql/documents/organiser";

type QueueMode = "HYBRID" | "BALANCED" | "STRICT";

const QUEUE_MODES: {
	key: QueueMode;
	label: string;
	description: string;
	recommended?: boolean;
}[] = [
	{
		key: "HYBRID",
		label: "Hybrid",
		description: "Wait time first, then gentle catch-up for late arrivals.",
		recommended: true,
	},
	{
		key: "BALANCED",
		label: "Balanced",
		description: "Everyone ends on the same game count. Late arrivals get priority until they catch up.",
	},
	{
		key: "STRICT",
		label: "Strict",
		description: "Pure queue order by wait time. Late arrivals join the back — no catch-up.",
	},
];

function getModeHint(mode: QueueMode, courts: number, players: number): string | null {
	if (!players || players < 4) return null;
	const gamesAtOnce = courts;
	const playersInQueue = Math.max(0, players - gamesAtOnce * 4);
	if (playersInQueue <= 0) return null;
	const waitMins = Math.round((playersInQueue / (gamesAtOnce * 4)) * 15);
	if (mode === "STRICT" && waitMins > 0) {
		const saving = Math.round(waitMins * 0.4);
		return `Strict mode with ${courts} court${courts !== 1 ? "s" : ""} and ${players} players means a ~${waitMins} minute wait between games. Balanced would shorten late-arrival waits by about ${saving} minutes.`;
	}
	return null;
}

export default function NewSessionPage() {
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const searchParams = useSearchParams();
	const { message } = App.useApp();
	const [createSession, { loading }] = useMutation(CREATE_SESSION);
	const { data: clubData } = useQuery(CLUB_DETAIL_QUERY, { variables: { id: params.clubId } });
	const club = clubData?.club;

	const [name, setName] = useState("Wednesday Open Play");
	const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
	const [startTime, setStartTime] = useState("19:00");
	const [courts, setCourts] = useState(2);
	const [queueMode, setQueueMode] = useState<QueueMode>("HYBRID");
	const [savedAt, setSavedAt] = useState<string | null>(null);
	const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const lastSession = (club?.sessions ?? []).find((s: any) => s.status === "COMPLETED");
	const estimatedPlayers = (lastSession?.players ?? []).length || 18;
	const hint = getModeHint(queueMode, courts, estimatedPlayers);

	// Pre-fill from template session if provided
	useEffect(() => {
		if (!club?.sessions) return;
		const templateId = searchParams.get("template");
		if (!templateId) return;

		const templateSession = club.sessions.find((s: any) => s.id === templateId);
		if (templateSession) {
			setName(templateSession.name);
			setCourts(templateSession.courts?.length ?? 2);
			if (templateSession.settings?.queueMode) {
				setQueueMode(templateSession.settings.queueMode as QueueMode);
			}
			if (templateSession.startTime) {
				setStartTime(templateSession.startTime);
			}
		}
	}, [club?.sessions, searchParams]);

	useEffect(() => {
		if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
		autoSaveTimer.current = setTimeout(() => {
			const now = new Date();
			setSavedAt(now.toTimeString().slice(0, 8));
		}, 800);
		return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current); };
	}, [name, date, startTime, courts, queueMode]);

	async function handleSubmit() {
		if (!name.trim()) { message.error("Enter a session name"); return; }
		if (!courts || courts < 1) { message.error("Enter at least 1 court"); return; }
		try {
			const result = await createSession({
				variables: {
					input: {
						clubId: params.clubId,
						name: name.trim(),
						sessionDate: new Date(date).toISOString(),
						startTime,
						numberOfCourts: courts,
						settings: { queueMode, maxConsecutiveGames: 2 },
					},
				},
			});
			router.push(`/dashboard/sessions/${result.data.createSession.id}`);
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not create session");
		}
	}

	return (
		<div style={{ height: "100%", display: "flex", flexDirection: "column", background: "#faf8f9", overflow: "hidden" }}>
			<style>{`
				@media (max-width: 768px) {
					.session-form-container {
						padding: 16px 16px 0 !important;
					}
					.session-header {
						flex-direction: column !important;
						gap: 12px !important;
					}
					.session-header-actions {
						flex-direction: column !important;
						gap: 8px !important;
						width: 100% !important;
					}
					.session-header-actions button,
					.session-header-actions .ant-btn {
						width: 100% !important;
						font-size: 12px !important;
						height: 40px !important;
					}
					.form-basics-grid {
						grid-template-columns: 1fr !important;
						gap: 12px !important;
					}
					.queue-modes-grid {
						grid-template-columns: 1fr !important;
						gap: 12px !important;
					}
					.queue-mode-card {
						min-height: 140px !important;
						padding: 16px !important;
					}
					.queue-mode-card span {
						font-size: 16px !important;
					}
					.queue-mode-description {
						font-size: 12px !important;
					}
					.session-footer {
						padding: 12px 16px !important;
						flex-wrap: wrap !important;
						gap: 12px !important;
					}
					.session-footer > span {
						display: none !important;
					}
				}
			`}</style>
			{/* ── Scrollable content ── */}
			<div className="session-form-container" style={{ flex: 1, overflowY: "auto", padding: "28px 40px 0" }}>
				<div className="session-header" style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
					<div>
						<div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.18em", color: "#e11d74", textTransform: "uppercase", marginBottom: 6 }}>
							{club?.name ?? "Club"} · Step 1 of 2
						</div>
						<h1 style={{ margin: 0, fontSize: 40, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", letterSpacing: "0.03em", color: "#1d1f20", lineHeight: 1 }}>
							New Session
						</h1>
					</div>
					<div className="session-header-actions" style={{ display: "flex", alignItems: "center", gap: 16, paddingTop: 8 }}>
						{savedAt && (
							<div style={{ fontSize: 12, fontWeight: 500, color: "#bd2153", border: "1px solid #f9a8d4", padding: "6px 14px" }}>
								Draft saved {savedAt}
							</div>
						)}
						<button
							style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#e11d74", cursor: "pointer", textDecoration: "underline", padding: 0 }}
							onClick={() => {
								const last = club?.sessions?.find((s: any) => s.status === "COMPLETED");
								if (last) {
									setName(last.name ?? name);
									setCourts((last.courts ?? []).length || courts);
									message.success("Last week's setup loaded");
								} else {
									message.info("No previous session found");
								}
							}}
						>
							Use last week's setup
						</button>
					</div>
				</div>

				{/* 01 Basics */}
				<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
					<span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", whiteSpace: "nowrap" }}>01 — Basics</span>
					<div style={{ flex: 1, height: 1, background: "rgba(29,31,32,0.12)" }} />
				</div>

				<div className="form-basics-grid" style={{ display: "grid", gridTemplateColumns: "1fr 200px 140px 120px", gap: 16, marginBottom: 36 }}>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(29,31,32,0.55)", marginBottom: 6 }}>Session name</label>
						<input
							value={name}
							onChange={(e) => setName(e.target.value)}
							style={{ width: "100%", boxSizing: "border-box", fontSize: 15, fontWeight: 500, padding: "10px 14px", border: "1.5px solid rgba(225,29,116,0.3)", background: "#fff", color: "#1d1f20", outline: "none" }}
						/>
					</div>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(29,31,32,0.55)", marginBottom: 6 }}>Date</label>
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							style={{ width: "100%", boxSizing: "border-box", fontSize: 15, fontWeight: 500, padding: "10px 14px", border: "1.5px solid rgba(225,29,116,0.3)", background: "#fff", color: "#1d1f20", outline: "none" }}
						/>
					</div>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(29,31,32,0.55)", marginBottom: 6 }}>Start</label>
						<input
							type="time"
							value={startTime}
							onChange={(e) => setStartTime(e.target.value)}
							style={{ width: "100%", boxSizing: "border-box", fontSize: 15, fontWeight: 500, padding: "10px 14px", border: "1.5px solid rgba(225,29,116,0.3)", background: "#fff", color: "#1d1f20", outline: "none" }}
						/>
					</div>
					<div>
						<label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "rgba(29,31,32,0.55)", marginBottom: 6 }}>Courts</label>
						<input
							type="number"
							max={20}
							value={courts === 0 ? "" : courts}
							onChange={(e) => {
								if (e.target.value === "") {
									setCourts(0);
								} else {
									const num = parseInt(e.target.value);
									if (!isNaN(num)) setCourts(Math.min(20, Math.max(0, num)));
								}
							}}
							style={{ width: "100%", boxSizing: "border-box", fontSize: 15, fontWeight: 500, padding: "10px 14px", border: "1.5px solid rgba(225,29,116,0.3)", background: "#fff", color: "#1d1f20", outline: "none" }}
						/>
					</div>
				</div>

				{/* 02 Queue Mode */}
				<div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
					<span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", whiteSpace: "nowrap" }}>02 — Queue Mode</span>
					<div style={{ flex: 1, height: 1, background: "rgba(29,31,32,0.12)" }} />
					<button style={{ background: "none", border: "none", fontSize: 12, fontWeight: 600, color: "#e11d74", cursor: "pointer", padding: 0 }}>
						How modes differ
					</button>
				</div>

				<div className="queue-modes-grid" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
					{QUEUE_MODES.map((m) => {
						const selected = queueMode === m.key;
						return (
							<div
								key={m.key}
								onClick={() => setQueueMode(m.key)}
								className="queue-mode-card"
								style={{
									border: `1.5px solid ${selected ? "#e11d74" : "rgba(29,31,32,0.15)"}`,
									background: selected ? "#e11d74" : "#fff",
									padding: "24px 20px",
									cursor: "pointer",
									transition: "all 0.12s",
									minHeight: 160,
									display: "flex",
									flexDirection: "column",
									gap: 10,
								}}
							>
								<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
									<div style={{
										width: 18, height: 18, borderRadius: "50%",
										border: `2px solid ${selected ? "#fff" : "rgba(29,31,32,0.3)"}`,
										background: "transparent",
										flexShrink: 0,
										display: "flex", alignItems: "center", justifyContent: "center",
									}}>
										{selected && <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#fff" }} />}
									</div>
									<span style={{
										fontSize: 18, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif",
										letterSpacing: "0.06em", textTransform: "uppercase",
										color: selected ? "#fff" : "#1d1f20",
									}}>
										{m.label}
									</span>
								</div>
								<p className="queue-mode-description" style={{ margin: 0, fontSize: 13, color: selected ? "rgba(255,255,255,0.85)" : "rgba(29,31,32,0.6)", lineHeight: 1.5 }}>
									{m.description}
								</p>
								{m.recommended && !selected && (
									<div style={{
										alignSelf: "flex-start", fontSize: 10, fontWeight: 700,
										letterSpacing: "0.1em", textTransform: "uppercase",
										border: "1px solid rgba(29,31,32,0.25)", color: "rgba(29,31,32,0.5)",
										padding: "2px 8px",
									}}>
										Recommended
									</div>
								)}
								{selected && (
									<div style={{
										alignSelf: "flex-start", fontSize: 10, fontWeight: 700,
										letterSpacing: "0.1em", textTransform: "uppercase",
										border: "1px solid rgba(255,255,255,0.5)", color: "#fff",
										padding: "2px 8px",
									}}>
										Selected
									</div>
								)}
							</div>
						);
					})}
				</div>

				{/* Hint banner */}
				{hint && (
					<div style={{
						display: "flex", alignItems: "flex-start", gap: 12,
						padding: "14px 20px",
						background: "#fff5f7",
						border: "1px solid rgba(225,29,116,0.2)",
						marginBottom: 24,
					}}>
						<span style={{ fontSize: 16, color: "#e11d74", flexShrink: 0, marginTop: 1 }}>ⓘ</span>
						<span style={{ fontSize: 13, color: "rgba(29,31,32,0.7)", lineHeight: 1.5 }}>{hint}</span>
					</div>
				)}
			</div>

			{/* ── Footer bar ── */}
			<div className="session-footer" style={{
				borderTop: "1px solid rgba(29,31,32,0.1)",
				background: "#fff",
				padding: "16px 40px",
				display: "flex",
				alignItems: "center",
				justifyContent: "space-between",
			}}>
				<span style={{ fontSize: 13, color: "rgba(29,31,32,0.4)" }}>Next: invite the roster and set play rules.</span>
				<div style={{ display: "flex", gap: 12 }}>
					<button
						onClick={() => router.back()}
						style={{ background: "none", border: "none", fontSize: 13, fontWeight: 600, color: "#e11d74", cursor: "pointer", padding: "8px 4px" }}
					>
						Discard
					</button>
					<Button
						size="large"
						style={{ fontWeight: 600, border: "1.5px solid #1d1f20", borderRadius: 0 }}
						onClick={() => message.info("Draft saved")}
					>
						Save as draft
					</Button>
					<Button
						size="large"
						type="primary"
						loading={loading}
						onClick={handleSubmit}
						style={{
							background: "#e11d74", borderColor: "#e11d74", borderRadius: 0,
							fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
							padding: "0 32px", fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15,
						}}
					>
						Create Session
					</Button>
				</div>
			</div>
		</div>
	);
}
