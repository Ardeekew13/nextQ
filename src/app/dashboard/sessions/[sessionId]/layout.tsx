"use client";

import { type ReactNode, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { Tag, Button, Typography, Space, Skeleton, Popconfirm, App } from "antd";
import { QrPopover } from "@/components/QrPopover";
import { FinishCelebrationModal } from "@/components/FinishCelebrationModal";
import {
  SESSION_HEADER_QUERY,
  SESSION_DASHBOARD_QUERY,
  PAUSE_SESSION,
  RESUME_SESSION,
  FINISH_SESSION,
  CANCEL_SESSION,
} from "@/graphql/documents/organiser";
import { humanizeStatus } from "@/lib/format";
import { useNavbarActions } from "@/components/NavbarActionsContext";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  PAUSED: "orange",
  COMPLETED: "blue",
  CANCELLED: "red",
};

export default function SessionLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { message } = App.useApp();

  const [celebrationOpen, setCelebrationOpen] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    sessionName: string;
    publicUrl: string;
    podium: import("@/components/Podium").PodiumEntryView[];
  } | null>(null);

  // Layout only needs header-level data (name, status, publicUrl)
  const { data, loading, error, refetch } = useQuery(SESSION_HEADER_QUERY, {
    variables: { id: params.sessionId },
  });

  // Used only after finishSession to grab podium for the celebration modal
  const { refetch: refetchFull } = useQuery(SESSION_DASHBOARD_QUERY, {
    variables: { id: params.sessionId },
    skip: true,
  });

  const [pauseSession] = useMutation(PAUSE_SESSION);
  const [resumeSession] = useMutation(RESUME_SESSION);
  const [finishSession] = useMutation(FINISH_SESSION);
  const [cancelSession] = useMutation(CANCEL_SESSION);

  const { setActions, setTitle } = useNavbarActions();

  const session = data?.session;
  const base = `/dashboard/sessions/${params.sessionId}`;

  async function run(action: () => Promise<unknown>, successMessage: string) {
    try {
      await action();
      message.success(successMessage);
      refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Action failed");
    }
  }

  useEffect(() => {
    if (!session) return;
    setTitle(
      <Space align="center" size={8}>
        <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "-0.2px", color: "#111827" }}>
          {session.name}
        </span>
        <Tag color={STATUS_COLORS[session.status]} style={{ margin: 0 }}>
          {humanizeStatus(session.status)}
        </Tag>
      </Space>
    );
    return () => setTitle(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.name, session?.status]);

  useEffect(() => {
    if (!session) return;
    setActions(
      <Space wrap size={6}>
        <QrPopover url={session.publicUrl} />
        {session.status === "ACTIVE" && (
          <Button size="small" onClick={() => run(() => pauseSession({ variables: { id: session.id } }), "Session paused")}>
            Pause
          </Button>
        )}
        {session.status === "PAUSED" && (
          <Button size="small" type="primary" onClick={() => run(() => resumeSession({ variables: { id: session.id } }), "Session resumed")}>
            Resume
          </Button>
        )}
        {(session.status === "ACTIVE" || session.status === "PAUSED") && (
          <Popconfirm
            title="End this session permanently?"
            description={
              <div style={{ maxWidth: 260 }}>
                <p style={{ margin: "4px 0 6px" }}>
                  Final standings will be published and the session will be <strong>locked</strong>.
                </p>
                <p style={{ margin: 0, color: "#dc2626", fontWeight: 600 }}>
                  ⚠️ This cannot be undone or restarted.
                </p>
              </div>
            }
            okText="Yes, finish session"
            cancelText="Go back"
            okButtonProps={{ danger: false }}
            onConfirm={async () => {
                try {
                  await finishSession({ variables: { id: session.id } });
                  // Use full query to get podium for celebration modal
                  const result = await refetchFull();
                  const finished = result.data?.session;
                  await refetch(); // refresh header too
                  setCelebrationData({
                    sessionName: finished?.name ?? session.name,
                    publicUrl: finished?.publicUrl ?? session.publicUrl,
                    podium: finished?.podium ?? [],
                  });
                  setCelebrationOpen(true);
                  message.success("Session finished!");
                } catch (error) {
                  message.error(error instanceof Error ? error.message : "Action failed");
                }
              }}
          >
            <Button size="small" type="primary">Finish session</Button>
          </Popconfirm>
        )}
        {session.status !== "COMPLETED" && session.status !== "CANCELLED" && (
          <Popconfirm title="Cancel this session?" onConfirm={() => run(() => cancelSession({ variables: { id: session.id } }), "Session cancelled")}>
            <Button size="small" danger type="text">Cancel</Button>
          </Popconfirm>
        )}
      </Space>
    );
    return () => setActions(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.status, session?.id, session?.publicUrl]);

  if (loading && !data) return <Skeleton active />;
  if (error) return <Typography.Text type="danger">{error.message}</Typography.Text>;
  if (!session) return <Typography.Text>Session not found.</Typography.Text>;

  return (
    <>
      {children}
      {celebrationData && (
        <FinishCelebrationModal
          open={celebrationOpen}
          sessionName={celebrationData.sessionName}
          publicUrl={celebrationData.publicUrl}
          podium={celebrationData.podium}
          onClose={() => {
            setCelebrationOpen(false);
            router.push(`${base}/standings`);
          }}
        />
      )}
    </>
  );
}
