"use client";

import { useQuery } from "@apollo/client";
import { Typography, Empty } from "antd";
import { SESSION_DASHBOARD_QUERY } from "@/graphql/documents/organiser";
import { Podium } from "@/components/Podium";
import { StandingsTable } from "@/components/StandingsTable";

const { Title } = Typography;

export function StatsTab({ sessionId }: { sessionId: string }) {
  const { data, loading, error } = useQuery(SESSION_DASHBOARD_QUERY, {
    variables: { id: sessionId },
    pollInterval: 5000,
  });

  if (loading && !data) return null;
  if (error) return <Empty description={error.message} />;
  const session = data?.session;
  if (!session) return <Empty description="Session not found" />;

  return (
    <div>
      {session.podium.length > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>
            Podium
          </Title>
          <Podium entries={session.podium} />
        </>
      )}

      <Title level={5} style={{ marginTop: 24, marginBottom: 12 }}>
        Standings
      </Title>
      <StandingsTable standings={session.standings} loading={loading} />
    </div>
  );
}
