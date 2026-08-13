"use client";

import Link from "next/link";
import { Button } from "antd";
import { CopyOutlined, PlusOutlined } from "@ant-design/icons";

interface ClubDetailHeaderProps {
	clubName: string;
	memberCount: number;
	sessionCount: number;
	createdAt: string;
	publicUrl: string;
	onCopyLink: () => void;
	onNewSession: () => void;
}

export function ClubDetailHeader({
	clubName,
	memberCount,
	sessionCount,
	createdAt,
	publicUrl,
	onCopyLink,
	onNewSession,
}: ClubDetailHeaderProps) {
	const clubAgeInfo = createdAt ? (() => {
		const diff = Date.now() - new Date(createdAt).getTime();
		const days = Math.floor(diff / 86400000);
		if (days === 0) return "created today";
		if (days === 1) return "created yesterday";
		return `created ${days} days ago`;
	})() : "";

	return (
		<div style={{ padding: "24px 32px", borderBottom: "1px solid rgba(138,39,72,0.12)", background: "#fff" }}>
			<style>{`
				.club-detail-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					gap: 24px;
				}
				@media (max-width: 768px) {
					.club-detail-header {
						flex-direction: column;
						align-items: flex-start;
					}
				}
				.club-detail-header-left {
					flex: 1;
				}
				.club-detail-breadcrumb {
					font-size: 12px;
					color: #ec4899;
					font-weight: 600;
					margin-bottom: 12px;
					text-transform: uppercase;
					letter-spacing: 0.1em;
				}
				.club-detail-breadcrumb a {
					color: #ec4899;
					text-decoration: none;
				}
				.club-detail-title {
					font-size: 36px;
					font-weight: 700;
					font-family: 'Barlow Condensed', sans-serif;
					text-transform: uppercase;
					color: #1d1f20;
					letter-spacing: 0.03em;
					margin: 0 0 8px 0;
					line-height: 1.2;
				}
				.club-detail-subtitle {
					font-size: 13px;
					color: rgba(29,31,32,0.6);
					margin: 0;
				}
				.club-detail-actions {
					display: flex;
					gap: 12px;
					flex-wrap: wrap;
					align-items: center;
				}
				.club-detail-actions button {
					font-weight: 600;
					white-space: nowrap;
				}
				@media (max-width: 768px) {
					.club-detail-title {
						font-size: 24px;
					}
					.club-detail-actions {
						width: 100%;
					}
				}
			`}</style>

			<div className="club-detail-header">
				<div className="club-detail-header-left">
					<div className="club-detail-breadcrumb">
						<Link href="/dashboard/clubs">Clubs</Link> / <span style={{ color: "#1d1f20" }}>{clubName.toUpperCase()}</span>
					</div>
					<h1 className="club-detail-title">{clubName}</h1>
					<p className="club-detail-subtitle">
						{memberCount} players · {sessionCount} session{sessionCount !== 1 ? 's' : ''} run · {clubAgeInfo}
					</p>
				</div>

				<div className="club-detail-actions">
					<Button
						icon={<CopyOutlined />}
						onClick={onCopyLink}
						style={{
							border: "1px solid #e5e7eb",
							background: "#fff",
							color: "#374151",
							fontWeight: 600,
							fontSize: 14,
							padding: "6px 14px",
							height: 32,
						}}
					>
						Copy invite link
					</Button>
					<Button
						type="primary"
						icon={<PlusOutlined />}
						onClick={onNewSession}
						style={{
							background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
							border: "none",
							fontWeight: 700,
							fontSize: 13,
							letterSpacing: "0.05em",
							padding: "8px 24px",
							height: 40,
							textTransform: "uppercase",
						}}
					>
						NEW SESSION
					</Button>
				</div>
			</div>
		</div>
	);
}
