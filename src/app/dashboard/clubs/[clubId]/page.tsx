"use client";

import { useState } from "react";
import {
	CLUB_QUERY,
	DELETE_CLUB,
	CLUB_MEMBERS_QUERY,
	ADD_CLUB_MEMBER,
	UPDATE_CLUB_MEMBER,
	REMOVE_CLUB_MEMBER,
	ME_QUERY,
} from "@/graphql/documents/organiser";
import { CLUB_STANDINGS_QUERY } from "@/graphql/documents/public";
import { humanizeStatus } from "@/lib/format";
import { buildPublicClubUrl } from "@/lib/urls";
import "@/styles/table.css";
import {
	DeleteOutlined,
	EditOutlined,
	PlusOutlined,
	TeamOutlined,
	TrophyOutlined,
	UnorderedListOutlined,
	CopyOutlined,
	LinkOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery } from "@apollo/client";
import {
	App,
	Button,
	Card,
	Form,
	Input,
	Modal,
	Popconfirm,
	Select,
	Skeleton,
	Space,
	Tag,
	Typography,
} from "antd";
import { QRCodeSVG } from "qrcode.react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { SessionsTab } from "@/components/ClubTabs/SessionsTab";
import { PlayersTab } from "@/components/ClubTabs/PlayersTab";
import { StandingsTab } from "@/components/ClubTabs/StandingsTab";

const { Text } = Typography;

const SKILL_OPTIONS = [
	{ value: "NOVICE", label: "Novice" },
	{ value: "BEGINNER_LOW", label: "Beginner (low)" },
	{ value: "BEGINNER_HIGH", label: "Beginner (high)" },
	{ value: "INTERMEDIATE", label: "Intermediate" },
	{ value: "ADVANCED", label: "Advanced" },
];

const STATUS_COLORS: Record<string, string> = {
	DRAFT: "default",
	ACTIVE: "green",
	PAUSED: "orange",
	COMPLETED: "default",
	CANCELLED: "red",
};

export default function ClubDetailPage() {
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const { message, modal } = App.useApp();
	const { data, loading, refetch } = useQuery(CLUB_QUERY, {
		variables: { id: params.clubId },
	});
	const {
		data: membersData,
		loading: membersLoading,
		refetch: refetchMembers,
	} = useQuery(CLUB_MEMBERS_QUERY, {
		variables: { clubId: params.clubId },
	});
	const {
		data: standingsData,
		loading: standingsLoading,
		refetch: refetchStandings,
	} = useQuery(
		CLUB_STANDINGS_QUERY,
		{
			variables: { slug: data?.club?.slug ?? "" },
			skip: !data?.club?.slug,
			pollInterval: 30000,
		},
	);
	const { data: meData } = useQuery(ME_QUERY);
	const isAdmin = meData?.me?.role === "ADMIN";
	const [deleteClub] = useMutation(DELETE_CLUB);
	const [addClubMember] = useMutation(ADD_CLUB_MEMBER);
	const [updateClubMember] = useMutation(UPDATE_CLUB_MEMBER);
	const [removeClubMember] = useMutation(REMOVE_CLUB_MEMBER);

	const [addMemberOpen, setAddMemberOpen] = useState(false);
	const [editingMember, setEditingMember] = useState<any>(null);
	const [activeTab, setActiveTab] = useState("sessions");
	const [searchValue, setSearchValue] = useState("");
	const [filterStatus, setFilterStatus] = useState("all");
	const [addForm] = Form.useForm();
	const [editForm] = Form.useForm();

	if (loading) return <Skeleton active />;
	const club = data?.club;
	if (!club) return <Text>Club not found.</Text>;

	// 1. Use first session's creation date if available, otherwise use club creation date
	const sessions = club.sessions ?? [];
	const ongoingSession = sessions.find((s: any) => s.status === "ACTIVE" || s.status === "PAUSED");
	let createdDate = sessions.length > 0 ? sessions[0].createdAt : club.createdAt;
	if (createdDate && typeof createdDate === "object" && "toDate" in createdDate) {
		createdDate = (createdDate as any).toDate();
	}
	const formattedCreated = createdDate
		? new Date(createdDate).toLocaleDateString("en-US", { day: "numeric", month: "long", year: "numeric" })
		: "Unknown date";

	const publicUrl = buildPublicClubUrl(club.slug);
	const members: any[] = membersData?.clubMembers ?? [];
	const clubStandings: any[] = standingsData?.clubStandings ?? [];
	// Calculate games logged from completed games across all sessions
	const totalGames = (club.sessions ?? []).reduce(
		(n: number, s: any) => n + ((s as any).completedGames?.length ?? 0),
		0,
	);

	async function handleDelete() {
		modal.confirm({
			title: "Delete this club?",
			content:
				"This cannot be undone. Clubs with an active or paused session cannot be deleted.",
			okText: "Delete",
			okButtonProps: { danger: true },
			onOk: async () => {
				try {
					await deleteClub({ variables: { id: club.id } });
					message.success("Club deleted");
					router.push("/dashboard/clubs");
				} catch (error) {
					message.error(
						error instanceof Error ? error.message : "Could not delete club",
					);
				}
			},
		});
	}

	async function handleAddMember(values: {
		name: string;
		nickname?: string;
		skillLevel?: string;
	}) {
		try {
			await addClubMember({ variables: { clubId: club.id, input: values } });
			message.success("Player added to roster");
			addForm.resetFields();
			setAddMemberOpen(false);
			refetchMembers();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not add player",
			);
		}
	}

	async function handleEditMember(values: any) {
		try {
			await updateClubMember({
				variables: { id: editingMember.id, input: values },
			});
			message.success("Player updated");
			setEditingMember(null);
			refetchMembers();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not update player",
			);
		}
	}

	async function handleRemoveMember(id: string) {
		try {
			await removeClubMember({ variables: { id } });
			message.success("Player removed from roster");
			refetchMembers();
			refetchStandings();
		} catch (err) {
			message.error(
				err instanceof Error ? err.message : "Could not remove player",
			);
		}
	}

	return (
		<div style={{ background: "#fff", minHeight: "100vh" }}>
			<style>{`
				.club-header {
					padding: 24px 32px;
					border-bottom: 1px solid rgba(138,39,72,0.12);
				}
				.club-breadcrumb {
					font-size: 12px;
					color: #ec4899;
					font-weight: 600;
					margin-bottom: 12px;
					text-transform: uppercase;
					letter-spacing: 0.1em;
				}
				.club-breadcrumb a {
					color: #ec4899;
					text-decoration: none;
				}
				.club-title {
					font-size: 40px;
					font-weight: 700;
					font-family: 'Barlow Condensed', sans-serif;
					text-transform: uppercase;
					color: #1d1f20;
					letter-spacing: 0.03em;
					margin: 0 0 8px 0;
					line-height: 0.95;
				}
				.club-meta {
					font-size: 13px;
					color: rgba(29,31,32,0.6);
					margin: 0;
				}
				.club-header-top {
					display: flex;
					justify-content: space-between;
					align-items: flex-start;
					gap: 24px;
				}
				.club-header-actions {
					display: flex;
					gap: 8px;
				}
				.club-header-actions button {
					font-weight: 600;
				}
				.club-tabs-bar {
					display: grid;
					grid-template-columns: 1fr 340px;
					align-items: center;
					padding: 0;
					border-bottom: 1px solid rgba(138,39,72,0.12);
					background: #fff;
				}
				.club-tabs-nav {
					display: flex;
					gap: 32px;
					padding: 0 32px;
				}
				.club-tab {
					font-family: 'Barlow Condensed', sans-serif;
					font-weight: 700;
					font-size: 13px;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					padding: 16px 0;
					margin: 0;
					border: none;
					border-bottom: 3px solid transparent;
					background: none;
					cursor: pointer;
					color: rgba(29,31,32,0.6);
					transition: all 0.2s;
				}
				.club-tab:hover {
					color: #1d1f20;
				}
				.club-tab.active {
					color: #ec4899;
					border-bottom-color: #ec4899;
				}
				.club-stats-strip {
					display: flex;
					gap: 0;
					border-left: 1px solid rgba(138,39,72,0.12);
					background: #fff1f5;
					width: 340px;
				}
				.club-stat {
					text-align: center;
					padding: 12px 24px;
					border-left: 1px solid rgba(138,39,72,0.12);
				}
				.club-stat:first-child {
					border-left: none;
				}
				.club-stat-label {
					font-size: 10px;
					font-weight: 700;
					letter-spacing: 0.15em;
					text-transform: uppercase;
					color: rgba(29,31,32,0.5);
					display: block;
					margin-bottom: 6px;
				}
				.club-stat-value {
					font-size: 20px;
					font-weight: 700;
					font-family: 'Barlow Condensed', sans-serif;
					color: #8d1a3f;
				}
				.club-content {
					display: grid;
					grid-template-columns: minmax(0, 1fr) 340px;
					gap: 0;
					border-top: 1px solid rgba(138,39,72,0.12);
					min-height: calc(100vh - 300px);
				}
				.club-main {
					padding: 24px 32px;
					border-right: 1px solid rgba(138,39,72,0.12);
					overflow-y: auto;
					overflow-x: hidden;
				}
				.club-rail {
					padding: 24px;
					background: #fef4f7;
					overflow-y: auto;
					display: flex;
					flex-direction: column;
				}
				.session-table {
					margin-bottom: 24px;
				}
				.session-table-header {
					display: grid;
					grid-template-columns: minmax(200px, 1fr) 110px 70px 70px 130px 100px 26px;
					gap: 16px;
					background: #fff1f5;
					padding: 12px 16px;
					font-size: 10px;
					font-weight: 700;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					color: #8d1a3f;
					border-bottom: 1px solid rgba(138,39,72,0.12);
				}
				.session-row {
					display: grid;
					grid-template-columns: minmax(200px, 1fr) 110px 70px 70px 130px 100px 26px;
					gap: 16px;
					padding: 14px 16px;
					align-items: center;
					border-bottom: 1px solid rgba(138,39,72,0.12);
					background: #fff;
				}
				.session-row:nth-child(even) {
					background: #fdf9fb;
				}
				.session-name {
					font-weight: 600;
					color: #1d1f20;
					font-family: 'Barlow Condensed', sans-serif;
					font-size: 14px;
				}
				.session-details {
					font-size: 12px;
					color: rgba(29,31,32,0.6);
				}
				.session-date {
					font-size: 13px;
					color: rgba(29,31,32,0.6);
				}
				.repeat-prompt {
					border: 1px solid rgba(138,39,72,0.18);
					border-top: 3px solid #f43f75;
					padding: 22px 24px;
					margin-bottom: 24px;
					background: #fff;
				}
				.repeat-prompt-kicker {
					font-size: 10px;
					font-weight: 700;
					letter-spacing: 0.15em;
					text-transform: uppercase;
					color: #bd2153;
					margin-bottom: 8px;
				}
				.repeat-prompt-heading {
					font-size: 25px;
					font-weight: 700;
					font-family: 'Barlow Condensed', sans-serif;
					text-transform: uppercase;
					color: #1d1f20;
					margin: 0 0 8px 0;
					line-height: 1.2;
				}
				.repeat-prompt-copy {
					font-size: 13px;
					color: rgba(29,31,32,0.7);
					margin-bottom: 16px;
					line-height: 1.5;
				}
				.repeat-prompt-buttons {
					display: flex;
					gap: 8px;
				}
				.recent-activity {
					background: #fff;
				}
				.recent-activity-title {
					font-size: 12px;
					font-weight: 700;
					letter-spacing: 0.15em;
					text-transform: uppercase;
					color: #1d1f20;
					margin-bottom: 16px;
				}
				.activity-item {
					display: flex;
					gap: 12px;
					padding-bottom: 12px;
					margin-bottom: 12px;
					border-bottom: 1px solid rgba(138,39,72,0.06);
					font-size: 13px;
				}
				.activity-date {
					color: #bd2153;
					font-weight: 600;
					min-width: 50px;
				}
				.activity-text {
					color: rgba(29,31,32,0.7);
				}
				.rail-section {
					margin-bottom: 24px;
					padding-bottom: 24px;
					border-bottom: 1px solid rgba(138,39,72,0.12);
				}
				.rail-section:last-child {
					border-bottom: none;
					margin-bottom: 0;
					padding-bottom: 0;
					margin-top: auto;
				}
				.rail-title {
					font-size: 12px;
					font-weight: 700;
					letter-spacing: 0.15em;
					text-transform: uppercase;
					color: #1d1f20;
					margin-bottom: 12px;
				}
				.leader-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding-bottom: 12px;
					margin-bottom: 12px;
					border-left: 3px solid #ec4899;
					padding-left: 12px;
				}
				.leader-name {
					font-weight: 600;
					color: #1d1f20;
					font-size: 13px;
				}
				.leader-stats {
					text-align: right;
				}
				.leader-winrate {
					font-size: 12px;
					color: #ec4899;
					font-weight: 700;
				}
				.leader-record {
					font-size: 11px;
					color: rgba(29,31,32,0.5);
				}
				.full-standings-link {
					font-size: 12px;
					color: #ec4899;
					font-weight: 600;
					text-decoration: none;
				}
				.search-filter-row {
					display: flex;
					gap: 12px;
					margin-bottom: 24px;
					align-items: center;
				}
				.search-input {
					max-width: 280px;
				}
				.status-filter {
					display: flex;
					gap: 0;
					border: 1px solid #d4d7db;
				}
				.status-filter-btn {
					padding: 6px 12px;
					border: none;
					background: #fff;
					border-right: 1px solid #d4d7db;
					font-size: 12px;
					cursor: pointer;
					color: rgba(29,31,32,0.6);
					font-weight: 600;
				}
				.status-filter-btn:last-child {
					border-right: none;
				}
				.status-filter-btn.active {
					background: #8d1a3f;
					color: #fff;
				}
				@media (max-width: 1024px) {
					.club-content {
						grid-template-columns: 1fr;
					}
					.club-main {
						border-right: none;
						border-bottom: 1px solid rgba(138,39,72,0.12);
						overflow-x: hidden !important;
					}
					.club-rail {
						background: #fff;
					}
				}

				@media (max-width: 768px) {
					.club-header {
						padding: 16px;
					}
					.club-header-top {
						flex-direction: column;
						align-items: stretch;
						gap: 16px;
					}
					.club-title {
						font-size: 28px;
					}
					.club-meta {
						font-size: 12px;
					}
					.club-header-actions {
						flex-direction: column;
						width: 100%;
					}
					.club-header-actions button {
						width: 100% !important;
					}
					.club-tabs-bar {
						grid-template-columns: 1fr;
					}
					.club-tabs-nav {
						padding: 0 16px;
						gap: 16px;
						border-bottom: 1px solid rgba(138,39,72,0.12);
						flex-wrap: wrap;
					}
					.club-tab {
						padding: 12px 0;
						font-size: 12px;
					}
					.club-stats-strip {
						width: 100%;
						border-left: none;
						border-top: 1px solid rgba(138,39,72,0.12);
						flex-wrap: wrap;
						background: #fff;
					}
					.club-stat {
						flex: 1;
						min-width: calc(50% - 4px);
						padding: 12px;
						border-left: none;
						border-top: 1px solid rgba(138,39,72,0.12);
					}
					.club-stat:nth-child(1),
					.club-stat:nth-child(2) {
						border-top: none;
					}
					.club-stat:nth-child(odd) {
						border-right: 1px solid rgba(138,39,72,0.12);
					}
					.club-main {
						padding: 16px;
					}
					.club-rail {
						padding: 16px;
						flex-direction: row;
						flex-wrap: wrap;
						gap: 24px;
					}
					.rail-section {
						flex: 1;
						min-width: 160px;
						margin-bottom: 0;
						padding-bottom: 0;
						border-bottom: none;
					}
					.rail-section:last-child {
						margin-top: 0;
					}
					.session-table-header {
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
						min-width: 100%;
					}
					.session-row {
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
						min-width: 100%;
					}
					.search-filter-row {
						gap: 8px;
						overflow-x: auto;
						-webkit-overflow-scrolling: touch;
						margin-bottom: 16px;
						padding-bottom: 8px;
						align-items: stretch;
						flex-wrap: nowrap;
					}
					.search-input {
						max-width: 100%;
						flex-shrink: 0;
						width: 160px;
					}
					.status-filter {
						display: flex;
						gap: 0;
						border: 1px solid #d4d7db;
						flex-shrink: 0;
					}
					.status-filter-btn {
						padding: 6px 12px;
						border: none;
						background: #fff;
						border-right: 1px solid #d4d7db;
						font-size: 12px;
						cursor: pointer;
						color: rgba(29,31,32,0.6);
						font-weight: 600;
						white-space: nowrap;
					}
					.status-filter-btn:last-child {
						border-right: none;
					}
					.status-filter-btn.active {
						background: #8d1a3f;
						color: #fff;
					}
				}

				@media (max-width: 480px) {
					.club-header {
						padding: 12px;
					}
					.club-title {
						font-size: 24px;
					}
					.club-breadcrumb {
						font-size: 11px;
					}
					.club-meta {
						font-size: 11px;
					}
					.club-header-actions button {
						font-size: 11px;
						padding: 4px 8px !important;
						height: 32px !important;
					}
					.club-tab {
						padding: 10px 0;
						font-size: 11px;
						gap: 4px;
					}
					.club-tabs-nav {
						padding: 0 12px;
						gap: 8px;
					}
					.club-stat {
						padding: 10px 8px;
						font-size: 12px;
					}
					.club-stat-label {
						font-size: 9px;
					}
					.club-stat-value {
						font-size: 18px;
					}
					.club-rail {
						padding: 12px;
					}
					.rail-section {
						min-width: 100%;
					}
				}
			`}</style>

			{/* Header */}
			<div className="club-header">
				<div className="club-breadcrumb">
					<Link href="/dashboard/clubs">Clubs</Link> /{" "}
					<span style={{ color: "#1d1f20" }}>{club.name.toUpperCase()}</span>
				</div>
				<div className="club-header-top">
					<div>
						<h1 className="club-title">{club.name}</h1>
						<p className="club-meta">
							{club.memberCount ?? 0} players · {club.sessions?.length ?? 0} session
							{(club.sessions?.length ?? 0) !== 1 ? "s" : ""} run · created {formattedCreated}
						</p>
					</div>
					<div className="club-header-actions">
						<Button
							onClick={() => {
								navigator.clipboard.writeText(publicUrl);
								message.success("Link copied");
							}}
							style={{
								border: "1px solid #e5e7eb",
								background: "#fff",
								color: "#8d1a3f",
								fontWeight: 600,
								padding: "6px 14px",
								height: 32,
							}}
							icon={<LinkOutlined />}
						>
							Copy invite link
						</Button>

						<Button
							type="primary"
							disabled={!!ongoingSession}
							title={ongoingSession ? `Finish "${ongoingSession.name}" before starting a new session.` : undefined}
							onClick={() =>
								router.push(`/dashboard/clubs/${club.id}/sessions/new`)
							}
							style={{
								background: ongoingSession ? undefined : "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
								border: "none",
								fontWeight: 700,
								fontSize: 13,
								letterSpacing: "0.05em",
								padding: "8px 24px",
								height: 40,
								textTransform: "uppercase",
							}}
							icon={<PlusOutlined />}
						>
							New session
						</Button>
					</div>
				</div>
			</div>

			{/* Tabs Bar with Stats */}
			<div className="club-tabs-bar">
				<nav className="club-tabs-nav">
					<button
						className={`club-tab ${activeTab === "sessions" ? "active" : ""}`}
						onClick={() => setActiveTab("sessions")}
					>
						<UnorderedListOutlined style={{ marginRight: 6 }} />
						Sessions
					</button>
					<button
						className={`club-tab ${activeTab === "roster" ? "active" : ""}`}
						onClick={() => setActiveTab("roster")}
					>
						<TeamOutlined style={{ marginRight: 6 }} />
						Players
					</button>
					<button
						className={`club-tab ${activeTab === "standings" ? "active" : ""}`}
						onClick={() => setActiveTab("standings")}
					>
						<TrophyOutlined style={{ marginRight: 6 }} />
						Standings
					</button>
				</nav>
				<div className="club-stats-strip">
					<div className="club-stat">
						<span className="club-stat-label">Players</span>
						<span className="club-stat-value">{club.memberCount ?? 0}</span>
					</div>
					<div className="club-stat">
						<span className="club-stat-label">Games Logged</span>
						<span className="club-stat-value">{totalGames}</span>
					</div>
					<div className="club-stat">
						<span className="club-stat-label">Sessions</span>
						<span className="club-stat-value">
							{club.sessions?.length ?? 0}
						</span>
					</div>
				</div>
			</div>

			{/* Content Grid */}
			<div className="club-content">
				{/* Main Column */}
				<div className="club-main">
					{/* Tab Components */}
					<SessionsTab club={club} activeTab={activeTab} setActiveTab={setActiveTab} onTabChange={refetch} isAdmin={isAdmin} />
					<PlayersTab
						activeTab={activeTab}
						members={members}
						membersLoading={membersLoading}
						addMemberOpen={addMemberOpen}
						setAddMemberOpen={setAddMemberOpen}
						editingMember={editingMember}
						setEditingMember={setEditingMember}
						addForm={addForm}
						editForm={editForm}
						onAddMember={handleAddMember}
						onEditMember={handleEditMember}
						onRemoveMember={handleRemoveMember}
						refetchMembers={refetchMembers}
					/>
					<StandingsTab
						activeTab={activeTab}
						clubStandings={clubStandings}
						standingsLoading={standingsLoading}
					/>
				</div>

				{/* Right Rail */}
				<div className="club-rail">
					{/* Club Leaders */}
					<div className="rail-section">
						<div className="rail-title">Club Leaders</div>
						{[...clubStandings]
							.sort((a: any, b: any) => {
								// Sort by losses (ascending), then by wins (descending), then by win rate (descending)
								if (a.losses !== b.losses) return a.losses - b.losses;
								if (a.wins !== b.wins) return b.wins - a.wins;
								return b.winRate - a.winRate;
							})
							.slice(0, 5)
							.map((leader: any) => (
								<div key={leader.name} className="leader-item">
									<div className="leader-name">
										{leader.nickname || leader.name}
									</div>
									<div className="leader-stats">
										<div className="leader-winrate">
											{(leader.winRate * 100).toFixed(0)}%
										</div>
										<div className="leader-record">
											{leader.wins}-{leader.losses}
										</div>
									</div>
								</div>
							))}
						{clubStandings.length > 0 && (
							<a
								href="#"
								className="full-standings-link"
								style={{
									marginTop: 8,
									display: "block",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									letterSpacing: "0.04em",
									textTransform: "uppercase",
									fontSize: 12,
								}}
							>
								Full standings
							</a>
						)}
					</div>

					{/* Share & Invite */}
					<div className="rail-section">
						<div className="rail-title">Share & Invite</div>
						<div
							style={{
								background: "#fff",
								padding: 12,
								borderRadius: 0,
								marginBottom: 12,
							}}
						>
							<div
								style={{
									fontSize: 10,
									fontWeight: 700,
									color: "rgba(29,31,32,0.5)",
									marginBottom: 8,
									textTransform: "uppercase",
									letterSpacing: "0.1em",
								}}
							>
								Club QR
							</div>
							<div
								style={{
									background: "#f5f5f5",
									padding: 8,
									borderRadius: 0,
									marginBottom: 12,
									height: 100,
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
								}}
							>
								<QRCodeSVG value={publicUrl} size={80} level="H" />
							</div>
							<div
								style={{
									fontSize: 12,
									color: "rgba(29,31,32,0.6)",
									marginBottom: 12,
								}}
							>
								Players scan to join the roster.
							</div>
							<Input
								readOnly
								value={publicUrl}
								size="small"
								style={{ borderRadius: 0 }}
								suffix={
									<Button
										type="text"
										size="small"
										icon={<CopyOutlined />}
										onClick={() => {
											navigator.clipboard.writeText(publicUrl);
											message.success("Link copied");
										}}
									>
										Copy
									</Button>
								}
							/>
						</div>
					</div>

					{/* Delete Button */}
					<div className="rail-section">
						<Button
							danger
							block
							icon={<DeleteOutlined />}
							onClick={handleDelete}
							style={{ borderRadius: 0 }}
						>
							Delete this club
						</Button>
					</div>
				</div>
			</div>

			{/* Add member modal */}
			<Modal
				title="Add player to roster"
				open={addMemberOpen}
				onCancel={() => setAddMemberOpen(false)}
				footer={null}
			>
				<Form form={addForm} layout="vertical" onFinish={handleAddMember}>
					<Form.Item label="Name" name="name" rules={[{ required: true }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Skill level (optional)" name="skillLevel">
						<Select allowClear options={SKILL_OPTIONS} size="large" />
					</Form.Item>
					<Button type="primary" htmlType="submit" block size="large">
						Add to roster
					</Button>
				</Form>
			</Modal>

			{/* Edit member modal */}
			<Modal
				title="Edit player"
				open={!!editingMember}
				onCancel={() => setEditingMember(null)}
				onOk={() => editForm.submit()}
			>
				<Form form={editForm} layout="vertical" onFinish={handleEditMember}>
					<Form.Item label="Name" name="name" rules={[{ required: true }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Skill level" name="skillLevel">
						<Select allowClear options={SKILL_OPTIONS} size="large" />
					</Form.Item>
				</Form>
			</Modal>
		</div>
	);
}
