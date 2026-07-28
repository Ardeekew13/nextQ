"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Tabs } from "antd";
import { OverviewTab } from "@/components/session/OverviewTab";
import { PlayersTab } from "@/components/session/PlayersTab";
import { CourtsTab } from "@/components/session/CourtsTab";
import { GamesTab } from "@/components/session/GamesTab";
import { StandingsTab } from "@/components/session/StandingsTab";
import { StatsTab } from "@/components/session/StatsTab";
import { PageHeader } from "@/components/PageHeader";
import type { ReactNode } from "react";

type TabKey = "overview" | "players" | "courts" | "games" | "standings" | "stats";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [tabHeader, setTabHeader] = useState<ReactNode>(null);

  const tabItems = [
    { key: "overview", label: "Overview" },
    { key: "players", label: "Players" },
    { key: "courts", label: "Courts" },
    { key: "games", label: "Games" },
    { key: "standings", label: "Standings" },
    { key: "stats", label: "Stats" },
  ];

  const defaultHeaders: Record<TabKey, ReactNode> = {
    overview: <PageHeader title="Overview" />,
    players: <PageHeader title="Players" />,
    courts: <PageHeader title="Courts" />,
    games: <PageHeader title="Games" />,
    standings: <PageHeader title="Standings" />,
    stats: <PageHeader title="Stats" />,
  };

  return (
    <div>
      {tabHeader ?? defaultHeaders[activeTab]}

      <Tabs
        activeKey={activeTab}
        onChange={(key) => { setActiveTab(key as TabKey); setTabHeader(null); }}
        items={tabItems}
        style={{ marginBottom: 16, marginTop: -8 }}
      />

      {activeTab === "overview" && <OverviewTab sessionId={params.sessionId} />}
      {activeTab === "players" && <PlayersTab sessionId={params.sessionId} onHeader={setTabHeader} />}
      {activeTab === "courts" && <CourtsTab sessionId={params.sessionId} onHeader={setTabHeader} />}
      {activeTab === "games" && <GamesTab sessionId={params.sessionId} />}
      {activeTab === "standings" && <StandingsTab sessionId={params.sessionId} />}
      {activeTab === "stats" && <StatsTab sessionId={params.sessionId} />}
    </div>
  );
}
