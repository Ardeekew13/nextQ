"use client";

import { useQuery } from "@apollo/client";
import { Typography, Button, App } from "antd";
import { ShareAltOutlined, LinkOutlined } from "@ant-design/icons";
import { SESSION_STANDINGS_QUERY } from "@/graphql/documents/organiser";
import { Podium } from "@/components/Podium";
import { StandingsTable } from "@/components/StandingsTable";

const { Title } = Typography;

export function StandingsTab({ sessionId }: { sessionId: string }) {
  const { message } = App.useApp();
  const { data, loading } = useQuery(SESSION_STANDINGS_QUERY, {
    variables: { id: sessionId },
    pollInterval: 8000,
  });

  const session = data?.session;
  const isFinished = session?.status === "COMPLETED";

  function handleCopyLink() {
    if (!session?.publicUrl) return;
    navigator.clipboard.writeText(session.publicUrl);
    message.success("Session link copied!");
  }

  return (
    <div>
      {isFinished && (session?.podium?.length ?? 0) > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
            <Title level={5} style={{ margin: 0 }}>🏆 Podium</Title>
            <Button
              size="small"
              icon={<LinkOutlined />}
              onClick={handleCopyLink}
              style={{ borderColor: "#ec4899", color: "#ec4899" }}
            >
              Share results
            </Button>
          </div>
          <Podium entries={session?.podium ?? []} />
          <Title level={5} style={{ marginTop: 28, marginBottom: 12 }}>Full standings</Title>
        </>
      )}

      <StandingsTable standings={session?.standings ?? []} loading={loading} />
    </div>
  );
}
