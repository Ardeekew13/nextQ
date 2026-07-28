"use client";

import { useQuery } from "@apollo/client";
import { Typography } from "antd";
import { SESSION_DASHBOARD_QUERY } from "@/graphql/documents/organiser";
import { Podium } from "@/components/Podium";
import { StandingsTable } from "@/components/StandingsTable";
import { PageHeader } from "@/components/PageHeader";

const { Title } = Typography;

export function StandingsTab({ sessionId }: { sessionId: string }) {
  const { data, loading } = useQuery(SESSION_DASHBOARD_QUERY, {
    variables: { id: sessionId },
    pollInterval: 5000,
  });

  const session = data?.session;
  const isFinished = session?.status === "COMPLETED";

  return (
    <div>
      {isFinished && (session?.podium?.length ?? 0) > 0 && (
        <>
          <Title level={5} style={{ marginBottom: 12 }}>Podium</Title>
          <Podium entries={session?.podium ?? []} />
          <Title level={5} style={{ marginTop: 28, marginBottom: 12 }}>Full standings</Title>
        </>
      )}

      <StandingsTable standings={session?.standings ?? []} loading={loading} />
    </div>
  );
}
