"use client";

import { Skeleton, Typography } from "antd";

const { Text } = Typography;

interface StandingsTabProps {
	activeTab: string;
	clubStandings: any[];
	standingsLoading: boolean;
}

export function StandingsTab({ activeTab, clubStandings, standingsLoading }: StandingsTabProps) {
	if (activeTab !== "standings") return null;

	if (standingsLoading) return <Skeleton active />;

	if (clubStandings.length === 0) {
		return <Text type="secondary">No standings yet. Standings are built from completed sessions.</Text>;
	}

	return (
		<div style={{ padding: "24px", display: "flex", justifyContent: "center" }}>
			<style>{`
				.standings-table {
					width: auto;
					border-collapse: collapse;
					max-width: 100%;
				}
				.standings-table th,
				.standings-table td {
					padding: 12px;
					font-size: 13px;
					text-align: left;
					white-space: nowrap;
				}
				.standings-table th:first-child,
				.standings-table td:first-child {
					width: 50px;
					min-width: 50px;
				}
				.standings-table th:nth-child(2),
				.standings-table td:nth-child(2) {
					min-width: 100px;
				}
				.standings-table th:nth-child(3),
				.standings-table td:nth-child(3) {
					width: 70px;
					min-width: 70px;
				}
				.standings-table th:nth-child(4),
				.standings-table td:nth-child(4) {
					width: 70px;
					min-width: 70px;
				}
				.standings-table th:nth-child(5),
				.standings-table td:nth-child(5) {
					width: 80px;
					min-width: 80px;
				}
				@media (max-width: 768px) {
					.standings-table th,
					.standings-table td {
						padding: 10px 8px;
						font-size: 12px;
					}
					.standings-table th:nth-child(2),
					.standings-table td:nth-child(2) {
						min-width: 80px;
					}
				}
			`}</style>
			<table className="standings-table">
				<thead>
					<tr style={{ background: "#fff1f5", borderBottom: "1px solid rgba(138,39,72,0.12)" }}>
						<th style={{ fontWeight: 700, color: "#8d1a3f" }}>Rank</th>
						<th style={{ fontWeight: 700, color: "#8d1a3f" }}>Player</th>
						<th style={{ fontWeight: 700, color: "#8d1a3f" }}>Games</th>
						<th style={{ fontWeight: 700, color: "#8d1a3f" }}>W–L</th>
						<th style={{ fontWeight: 700, color: "#8d1a3f" }}>Win %</th>
					</tr>
				</thead>
				<tbody>
					{clubStandings.map((row: any, idx: number) => (
						<tr key={`${row.name}-${row.rank}`} style={{ borderBottom: "1px solid rgba(138,39,72,0.12)", background: idx % 2 === 0 ? "#fff" : "#fdf9fb" }}>
							<td style={{ fontWeight: 700, color: "#1d1f20" }}>{row.rank}</td>
							<td style={{ color: "#1d1f20" }}>{row.nickname || row.name}</td>
							<td style={{ color: "rgba(29,31,32,0.6)" }}>{row.totalGames}</td>
							<td style={{ color: "rgba(29,31,32,0.6)" }}>{row.wins}–{row.losses}</td>
							<td style={{ fontWeight: 700, color: "#ec4899" }}>
								{(row.winRate * 100).toFixed(0)}%
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
