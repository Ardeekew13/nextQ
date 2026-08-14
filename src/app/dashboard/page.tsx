"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { Button, Modal, Form, Input, App, Skeleton, Typography } from "antd";
import Link from "next/link";
import { DASHBOARD_QUERY, CREATE_CLUB, JOIN_CLUB } from "@/graphql/documents/organiser";
import { useNavbarActions } from "@/components/NavbarActionsContext";
import { humanizeStatus } from "@/lib/format";

const { Text } = Typography;

function initials(name: string) {
	return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

function clubAge(createdAt: string) {
	const diff = Date.now() - new Date(createdAt).getTime();
	const days = Math.floor(diff / 86400000);
	if (days === 0) return "Created today";
	if (days === 1) return "Created yesterday";
	return `Created ${days} days ago`;
}

export default function DashboardPage() {
	const { data, loading, refetch } = useQuery(DASHBOARD_QUERY);
	const { message } = App.useApp();
	const router = useRouter();
	const { setTitle, setActions } = useNavbarActions();
	const [createClubOpen, setCreateClubOpen] = useState(false);
	const [joinClubOpen, setJoinClubOpen] = useState(false);
	const [createClub, { loading: creating }] = useMutation(CREATE_CLUB);
	const [joinClub, { loading: joining }] = useMutation(JOIN_CLUB);
	const [form] = Form.useForm();
	const [joinForm] = Form.useForm();

	const clubs = data?.myClubs ?? [];

	useEffect(() => {
		const now = new Date();
		const timeStr = now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).toUpperCase();
		const dayStr = now.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" }).toUpperCase();
		setTitle(
<div>
				<Text style={{ fontSize: 11, fontWeight: 600, color: "#bd2153", letterSpacing: "0.2em", textTransform: "uppercase", display: "block", marginBottom: 4 }}>
					{dayStr} · {timeStr}
				</Text>
				<h1 style={{ fontSize: 28, margin: 0, fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em", color: "#1d1f20", lineHeight: 1.2 }}>
					Dashboard
				</h1>
			</div>,
		);
		setActions(
<div style={{ display: "flex", gap: 16, alignItems: "center" }}>
				<span
					style={{
						fontSize: 13,
						fontWeight: 600,
						color: "#1d1f20",
						cursor: "pointer",
					}}
					onClick={() => setJoinClubOpen(true)}
				>
					Join club
				</span>
				<Button
					type="primary"
					onClick={() => setCreateClubOpen(true)}
					style={{
						background: "#f43f75",
						border: "none",
						fontWeight: 700,
						fontSize: 12,
						letterSpacing: "0.08em",
						textTransform: "uppercase",
						padding: "8px 24px",
						height: 36,
					}}
				>
					Create club
				</Button>
			</div>,
		);
	}, []);

	async function handleCreateClub(values: { name: string; location?: string }) {
		try {
			await createClub({ variables: { input: values } });
			message.success("Club created");
			setCreateClubOpen(false);
			form.resetFields();
			refetch();
		} catch (error) {
			message.error(error instanceof Error ? error.message : "Could not create club");
		}
	}

	async function handleJoinClub(values: { joinCode: string }) {
		try {
			await joinClub({ variables: { joinCode: values.joinCode.trim().toUpperCase() } });
			message.success("Joined club!");
			setJoinClubOpen(false);
			joinForm.resetFields();
			refetch();
		} catch (error) {
			message.error(error instanceof Error ? error.message : "Invalid join code");
		}
	}

	if (loading) return <Skeleton active />;

	const allSessions = clubs.flatMap((club: any) => club.sessions ?? []);
	const liveCount = allSessions.filter((s: any) => s.status === "ACTIVE" || s.status === "PAUSED").length;
	const completedCount = allSessions.filter((s: any) => s.status === "COMPLETED").length;
	const draftCount = allSessions.filter((s: any) => s.status === "DRAFT").length;

	return (
<div>
			{/* ── Stats Row ── */}
			<style>{`
				@media (max-width: 740px) {
					.ant-btn {
						padding: 4px 8px !important;
						font-size: 12px !important;
						height: 24px !important;
					}
				}
				.stats-grid {
					display: grid;
					grid-template-columns: repeat(2, 1fr);
					gap: 1px;
					margin-bottom: 28px;
					border: 1px solid rgba(138,39,72,0.18);
					background: #fff;
				}
				@media (min-width: 768px) {
					.stats-grid {
						grid-template-columns: repeat(4, 1fr);
					}
				}
				.stat-item {
					padding: 16px;
					border-right: 1px solid rgba(138,39,72,0.18);
					border-bottom: 1px solid rgba(138,39,72,0.18);
				}
				.stat-item:nth-child(2n) {
					border-right: none;
				}
				@media (min-width: 768px) {
					.stat-item {
						padding: 18px 24px;
						border-bottom: none;
					}
					.stat-item:nth-child(4n) {
						border-right: none;
					}
					.stat-item:nth-child(2n) {
						border-right: 1px solid rgba(138,39,72,0.18);
					}
				}
				.stat-item.highlight {
					background: #fff5f7;
					border-right: none;
					border-bottom: none;
				}
				@media (min-width: 768px) {
					.stat-item.highlight {
						border-bottom: none;
						border-right: none;
					}
				}
			`}</style>
			<div className="stats-grid">
				<div className="stat-item">
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>Clubs</div>
					<div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1 }}>{clubs.length}</div>
				</div>
				<div className="stat-item">
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>Live Now</div>
					<div style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: liveCount === 0 ? "rgba(29,31,32,0.3)" : "#1d1f20", lineHeight: 1 }}>
						{liveCount === 0 ? "None" : liveCount}
					</div>
				</div>
				<div className="stat-item">
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>Completed</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
						<span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", lineHeight: 1 }}>{completedCount}</span>
						{completedCount > 0 && <span style={{ fontSize: 11, color: "rgba(29,31,32,0.45)", fontWeight: 500 }}>sessions</span>}
					</div>
				</div>
				<div className="stat-item highlight">
					<div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "#bd2153", marginBottom: 6 }}>Drafts</div>
					<div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
						<span style={{ fontSize: 28, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#bd2153", lineHeight: 1 }}>{draftCount}</span>
						{draftCount > 0 && <span style={{ fontSize: 11, color: "#bd2153", fontWeight: 500 }}>unpublished</span>}
					</div>
				</div>
			</div>

			{/* ── Your Clubs ── */}
			<div>
				<style>{`
					.club-header-line {
						display: flex;
						align-items: center;
						gap: 10px;
						margin-bottom: 16px;
						flex-wrap: wrap;
					}
					.club-header-line span {
						font-size: 10px;
						font-weight: 700;
						letter-spacing: 0.2em;
						text-transform: uppercase;
						color: rgba(29,31,32,0.5);
						white-space: nowrap;
					}
					.club-header-line .divider {
						flex: 1;
						height: 1px;
						background: rgba(138,39,72,0.2);
						min-width: 10px;
					}
					.club-empty-state {
						border: 1px solid rgba(138,39,72,0.18);
						background: #fff;
						padding: 16px;
						display: flex;
						flex-direction: column;
						align-items: center;
						justify-content: center;
						text-align: center;
						gap: 12px;
					}
					.club-card-header {
						display: flex;
						align-items: center;
						gap: 14px;
						padding: 14px 20px;
						border-bottom: 1px solid rgba(138,39,72,0.12);
					}
					.club-card-content {
						flex: 1;
						min-width: 150px;
					}
					.club-card-actions {
						display: flex;
						align-items: center;
						gap: 12px;
						flex-shrink: 0;
						flex-wrap: wrap;
					}
					@media (max-width: 640px) {
						.club-card-header {
							flex-direction: column;
							align-items: flex-start;
							gap: 12px;
							padding: 12px 16px;
						}
						.club-card-content {
							width: 100%;
							min-width: 0;
						}
						.club-card-actions {
							width: 100%;
							justify-content: flex-start;
						}
					}
					@media (min-width: 768px) {
						.club-empty-state {
							flex-direction: row;
							text-align: left;
							padding: 28px 24px;
							justify-content: space-between;
							align-items: center;
							gap: 16px;
						}
					}
				`}</style>
				<div className="club-header-line">
					<span>Your Clubs</span>
					<div className="divider" />
					{clubs.length > 0 && (
						<span style={{ color: "rgba(29,31,32,0.4)" }}>
							{clubs.length} {clubs.length === 1 ? "CLUB" : "CLUBS"}
						</span>
					)}
				</div>

				<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
					{clubs.length === 0 && (
						<div className="club-empty-state">
							<Text type="secondary" style={{ fontSize: 13 }}>No clubs yet. Create your first club to get started.</Text>
							<Button type="primary" onClick={() => setCreateClubOpen(true)}>Create first club</Button>
						</div>
					)}

					{clubs.map((club: any) => {
						const sessions: any[] = club.sessions ?? [];
						const completedSessions = sessions.filter((s: any) => s.status === "COMPLETED");
						const draftSessions = sessions.filter((s: any) => s.status === "DRAFT");
						const activeSessions = sessions.filter((s: any) => s.status === "ACTIVE" || s.status === "PAUSED");
						const memberCount: number = club.memberCount ?? 0;
						const maxCourts = sessions.reduce((max: number, s: any) => Math.max(max, (s.courts ?? []).length), 0);
						const subtitleParts = [
							memberCount > 0 ? `${memberCount} ${memberCount === 1 ? "member" : "members"}` : "no members",
							maxCourts > 0 ? `${maxCourts} ${maxCourts === 1 ? "court" : "courts"}` : "no courts set",
						];

						return (
<div key={club.id} style={{ border: "1px solid rgba(138,39,72,0.18)", background: "#fff", cursor: "pointer" }} onClick={() => router.push(`/dashboard/clubs/${club.id}`)}>
								{/* Club header */}
								<div className="club-card-header" style={{ cursor: "pointer" }}>
									<div className="club-avatar" style={{
										width: 44, height: 44,
										background: memberCount === 0 ? "#fce7ef" : "#f43f75",
										display: "flex", alignItems: "center", justifyContent: "center",
										color: memberCount === 0 ? "#bd2153" : "#fff",
										fontWeight: 700, fontSize: 15, fontFamily: "'Barlow Condensed', sans-serif",
										flexShrink: 0,
									}}>
										{initials(club.name)}
									</div>
									<div className="club-card-content">
										<div style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20", lineHeight: 1.2 }}>
											{club.name}
										</div>
										<Text type="secondary" style={{ fontSize: 12 }}>
											{club.location ? `${club.location} · ` : `${clubAge(club.createdAt)} · `}
											{subtitleParts.join(" · ")}
										</Text>
									</div>
									<div className="club-card-actions">
										{completedSessions.length > 0 && (
											<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)" }}>
												{completedSessions.length} COMPLETED
											</span>
										)}
										{activeSessions.length > 0 && (
											<span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#16a34a" }}>
												{activeSessions.length} LIVE
											</span>
										)}
										{sessions.length === 0 && (
											<span style={{
												fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
												border: "1px solid rgba(138,39,72,0.3)", color: "#bd2153",
												padding: "2px 10px",
											}}>Empty</span>
										)}
										{sessions.length > 0 && (
											<Link href={`/dashboard/clubs/${club.id}`} style={{ fontSize: 12, fontWeight: 600, color: "#bd2153", textDecoration: "underline" }} onClick={(e) => e.stopPropagation()}>
												Standings
											</Link>
										)}
									</div>
								</div>

								{/* Session rows */}
								{draftSessions.length === 0 && activeSessions.length === 0 ? (
<div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
										<Text type="secondary" style={{ fontSize: 13 }}>
											No sessions yet. Add courts and a roster, then schedule the first open play.
										</Text>
										<Button type="primary" size="small" onClick={() => router.push(`/dashboard/clubs/${club.id}/sessions/new`)}>
											Create session
										</Button>
									</div>
								) : (
[...activeSessions, ...draftSessions].map((session: any) => {
										const courtsCount = (session.courts ?? []).length;
										const queueLabel = session.settings?.queueMode?.toLowerCase().replace(/_/g, " ") ?? "";
										const metaParts = [
											session.sessionDate ? new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No date set",
											courtsCount > 0 ? `${courtsCount} ${courtsCount === 1 ? "court" : "courts"}` : null,
											queueLabel || null,
										].filter(Boolean);
										const isLive = session.status === "ACTIVE" || session.status === "PAUSED";
										return (
<div key={session.id} style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, borderTop: "1px solid rgba(138,39,72,0.08)" }}>
												<span style={{
													fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
													border: `1px solid ${isLive ? "#16a34a" : "#f43f75"}`,
													color: isLive ? "#16a34a" : "#f43f75",
													padding: "2px 8px", whiteSpace: "nowrap",
												}}>
													{humanizeStatus(session.status)}
												</span>
												<div style={{ flex: 1, minWidth: 0 }}>
													<span style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20" }}>
														{session.name}
													</span>
													{metaParts.length > 0 && (
														<Text type="secondary" style={{ fontSize: 12, display: "block" }}>{metaParts.join(" · ")}</Text>
													)}
												</div>
												<Button type="primary" size="small" onClick={() => router.push(`/dashboard/sessions/${session.id}`)}>
													{isLive ? "View session" : "Finish setup"}
												</Button>
											</div>
										);
									})
								)}
							</div>
						);
					})}
				</div>
			</div>

			{/* ── Modals ── */}
			<Modal title="Create club" open={createClubOpen} onCancel={() => setCreateClubOpen(false)} onOk={() => form.submit()} confirmLoading={creating}>
				<Form form={form} layout="vertical" onFinish={handleCreateClub} requiredMark={false}>
					<Form.Item label="Club name" name="name" rules={[{ required: true, message: "Enter a club name" }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Location" name="location">
						<Input size="large" />
					</Form.Item>
				</Form>
			</Modal>

			<Modal title="Join a club" open={joinClubOpen} onCancel={() => { setJoinClubOpen(false); joinForm.resetFields(); }} onOk={() => joinForm.submit()} okText="Join club" confirmLoading={joining}>
				<p style={{ color: "#6b7280", marginBottom: 16 }}>Ask the club owner for their 6-character join code, then enter it below.</p>
				<Form form={joinForm} layout="vertical" onFinish={handleJoinClub} requiredMark={false}>
					<Form.Item label="Join code" name="joinCode" rules={[{ required: true, message: "Enter the join code" }, { len: 6, message: "Join code must be 6 characters" }]}>
						<Input size="large" placeholder="ABC123" maxLength={6} style={{ textTransform: "uppercase", letterSpacing: "0.2em", fontWeight: 700 }} />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
