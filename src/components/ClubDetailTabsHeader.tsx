"use client";

import { TeamOutlined, TrophyOutlined, UnorderedListOutlined } from "@ant-design/icons";

interface ClubDetailTabsHeaderProps {
	activeTab: string;
	onTabChange: (key: string) => void;
	playerCount: number;
	gamesLogged: number;
	sessionsCount: number;
}

export function ClubDetailTabsHeader({
	activeTab,
	onTabChange,
	playerCount,
	gamesLogged,
	sessionsCount,
}: ClubDetailTabsHeaderProps) {
	return (
		<div style={{ background: "#fff", borderBottom: "1px solid rgba(138,39,72,0.12)" }}>
			<style>{`
				.club-tabs-header {
					display: flex;
					justify-content: space-between;
					align-items: stretch;
					padding: 0 32px;
				}
				.club-tabs-nav {
					display: flex;
					gap: 0;
					border-bottom: none;
					margin: 0;
					padding: 0;
				}
				.club-tabs-tab {
					font-family: 'Barlow Condensed', sans-serif;
					font-weight: 700;
					font-size: 13px;
					letter-spacing: 0.1em;
					text-transform: uppercase;
					padding: 12px 0;
					margin: 0 24px 0 0;
					border: none;
					border-bottom: 3px solid transparent;
					background: none;
					cursor: pointer;
					color: rgba(29,31,32,0.6);
					transition: all 0.2s;
				}
				.club-tabs-tab:hover {
					color: #1d1f20;
				}
				.club-tabs-tab.active {
					color: #ec4899;
					border-bottom-color: #ec4899;
				}
				.club-stats-container {
					display: flex;
					align-items: center;
					gap: 0;
					border-left: 1px solid rgba(138,39,72,0.12);
				}
				.club-stat-item {
					text-align: center;
					padding: 12px 32px;
					border-right: 1px solid rgba(138,39,72,0.12);
				}
				.club-stat-item:last-child {
					border-right: none;
				}
				.club-stat-label {
					font-size: 10px;
					font-weight: 700;
					letter-spacing: 0.15em;
					text-transform: uppercase;
					color: rgba(29,31,32,0.5);
					display: block;
					margin-bottom: 8px;
				}
				.club-stat-value {
					font-size: 24px;
					font-weight: 700;
					font-family: 'Barlow Condensed', sans-serif;
					color: #1d1f20;
				}
				@media (max-width: 768px) {
					.club-tabs-header {
						flex-direction: column;
						padding: 0;
					}
					.club-tabs-nav {
						padding: 0 32px;
						border-bottom: 1px solid rgba(138,39,72,0.12);
					}
					.club-stats-container {
						border-left: none;
						border-top: 1px solid rgba(138,39,72,0.12);
					}
					.club-stat-item {
						flex: 1;
						padding: 12px 16px;
					}
				}
			`}</style>

			<div className="club-tabs-header">
				<nav className="club-tabs-nav">
					<button
						className={`club-tabs-tab ${activeTab === "sessions" ? "active" : ""}`}
						onClick={() => onTabChange("sessions")}
					>
						<UnorderedListOutlined style={{ marginRight: 6 }} />
						Sessions
					</button>
					<button
						className={`club-tabs-tab ${activeTab === "roster" ? "active" : ""}`}
						onClick={() => onTabChange("roster")}
					>
						<TeamOutlined style={{ marginRight: 6 }} />
						Players
					</button>
					<button
						className={`club-tabs-tab ${activeTab === "standings" ? "active" : ""}`}
						onClick={() => onTabChange("standings")}
					>
						<TrophyOutlined style={{ marginRight: 6 }} />
						Standings
					</button>
				</nav>

				<div className="club-stats-container">
					<div className="club-stat-item">
						<span className="club-stat-label">Players</span>
						<span className="club-stat-value">{playerCount}</span>
					</div>
					<div className="club-stat-item">
						<span className="club-stat-label">Games Logged</span>
						<span className="club-stat-value">{gamesLogged}</span>
					</div>
					<div className="club-stat-item">
						<span className="club-stat-label">Sessions</span>
						<span className="club-stat-value">{sessionsCount}</span>
					</div>
				</div>
			</div>
		</div>
	);
}
