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
		<div style={{ padding: "24px" }}>
			<table style={{ width: "100%" }}>
				<thead>
					<tr style={{ background: "#fff1f5", borderBottom: "1px solid rgba(138,39,72,0.12)" }}>
						<th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8d1a3f" }}>Rank</th>
						<th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8d1a3f" }}>Player</th>
						<th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8d1a3f" }}>Games</th>
						<th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8d1a3f" }}>W–L</th>
						<th style={{ padding: "12px", textAlign: "left", fontSize: 12, fontWeight: 700, color: "#8d1a3f" }}>Win %</th>
					</tr>
				</thead>
				<tbody>
					{clubStandings.map((row: any, idx: number) => (
						<tr key={`${row.name}-${row.rank}`} style={{ borderBottom: "1px solid rgba(138,39,72,0.12)", background: idx % 2 === 0 ? "#fff" : "#fdf9fb" }}>
							<td style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: "#1d1f20" }}>{row.rank}</td>
							<td style={{ padding: "12px", fontSize: 13, color: "#1d1f20" }}>{row.nickname || row.name}</td>
							<td style={{ padding: "12px", fontSize: 13, color: "rgba(29,31,32,0.6)" }}>{row.totalGames}</td>
							<td style={{ padding: "12px", fontSize: 13, color: "rgba(29,31,32,0.6)" }}>{row.wins}–{row.losses}</td>
							<td style={{ padding: "12px", fontSize: 13, fontWeight: 700, color: "#ec4899" }}>
								{(row.winRate * 100).toFixed(0)}%
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
