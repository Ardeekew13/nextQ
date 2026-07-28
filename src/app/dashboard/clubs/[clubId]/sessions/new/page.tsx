"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { Card, Form, Input, InputNumber, DatePicker, TimePicker, Button, Typography, Switch, App } from "antd";
import { CheckCircleFilled } from "@ant-design/icons";
import dayjs from "dayjs";
import { CREATE_SESSION } from "@/graphql/documents/organiser";
import { Badge } from "@/components/Badge";

const { Title, Text } = Typography;

type QueueMode = "BALANCED" | "SMART" | "HYBRID";

const QUEUE_MODES: {
  key: QueueMode;
  label: string;
  description: string;
  recommended?: boolean;
  catchUp: "full" | "limited" | "none";
  catchUpLabel: string;
}[] = [
  {
    key: "HYBRID",
    label: "Hybrid",
    description: "Wait time first, then gentle catch-up for late arrivals. Best for most clubs.",
    recommended: true,
    catchUp: "limited",
    catchUpLabel: "Late players gradually catch up.",
  },
  {
    key: "BALANCED",
    label: "Balanced",
    description: "Everyone finishes with the same number of games. Late arrivals are prioritised until they catch up.",
    catchUp: "full",
    catchUpLabel: "Late players are prioritised until equal.",
  },
  {
    key: "SMART",
    label: "Smart",
    description: "Strict queue order by wait time. Late arrivals join the back of the queue — no catch-up.",
    catchUp: "none",
    catchUpLabel: "No catch-up. Queue order only.",
  },
];

interface FormValues {
  name: string;
  sessionDate: dayjs.Dayjs;
  timeRange?: [dayjs.Dayjs, dayjs.Dayjs];
  numberOfCourts: number;
  pointsTarget: number;
  winByTwo: boolean;
  maxConsecutiveGames: number;
}

export default function NewSessionPage() {
  const params = useParams<{ clubId: string }>();
  const router = useRouter();
  const { message } = App.useApp();
  const [createSession, { loading }] = useMutation(CREATE_SESSION);
  const [form] = Form.useForm<FormValues>();
  const [queueMode, setQueueMode] = useState<QueueMode>("HYBRID");

  async function handleFinish(values: FormValues) {
    try {
      const result = await createSession({
        variables: {
          input: {
            clubId: params.clubId,
            name: values.name,
            sessionDate: values.sessionDate.toISOString(),
            startTime: values.timeRange?.[0]?.format("HH:mm"),
            endTime: values.timeRange?.[1]?.format("HH:mm"),
            numberOfCourts: values.numberOfCourts,
            settings: {
              scoring: { pointsTarget: values.pointsTarget, winByTwo: values.winByTwo },
              queueMode,
              maxConsecutiveGames: values.maxConsecutiveGames,
            },
          },
        },
      });
      message.success("Session created");
      router.push(`/dashboard/sessions/${result.data.createSession.id}`);
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not create session");
    }
  }

  const selectedMode = QUEUE_MODES.find((m) => m.key === queueMode)!;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto" }}>
      <Title level={3}>New session</Title>
      <Card>
        <Form<FormValues>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={{ numberOfCourts: 2, pointsTarget: 11, winByTwo: true, sessionDate: dayjs(), maxConsecutiveGames: 2 }}
          onFinish={handleFinish}
        >
          <Form.Item label="Session name" name="name" rules={[{ required: true, message: "Enter a session name" }]}>
            <Input size="large" placeholder="Saturday Open Play" />
          </Form.Item>

          <Form.Item label="Queue mode" required>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {QUEUE_MODES.map((m) => {
                const selected = queueMode === m.key;
                return (
                  <div
                    key={m.key}
                    onClick={() => setQueueMode(m.key)}
                    style={{
                      border: selected ? "2px solid #ec4899" : "1px solid #e5e7eb",
                      borderRadius: 12,
                      padding: "14px 16px",
                      background: selected ? "#fdf2f8" : "#fff",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      {selected ? (
                        <CheckCircleFilled style={{ color: "#ec4899", fontSize: 18 }} />
                      ) : (
                        <div style={{ width: 18, height: 18, borderRadius: "50%", border: "2px solid #d1d5db", flexShrink: 0 }} />
                      )}
                      <Text strong style={{ color: selected ? "#ec4899" : "#111", fontSize: 15 }}>
                        {m.label}
                      </Text>
                      {m.recommended && (
                        <Badge variant="green" style={{ fontSize: 10, letterSpacing: 0.5, textTransform: "uppercase" }}>
                          Recommended
                        </Badge>
                      )}
                    </div>
                    <Text
                      type="secondary"
                      style={{ paddingLeft: 26, display: "block", fontSize: 13, color: selected ? "#db2777" : undefined }}
                    >
                      {m.description}
                    </Text>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 10, padding: "10px 14px", background: "#f9fafb", borderRadius: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Badge
                variant={selectedMode.catchUp === "full" ? "green" : selectedMode.catchUp === "limited" ? "blue" : "gray"}
                style={{ flexShrink: 0 }}
              >
                {selectedMode.catchUp === "full" ? "Full catch-up" : selectedMode.catchUp === "limited" ? "Partial catch-up" : "No catch-up"}
              </Badge>
              <Text type="secondary" style={{ fontSize: 12 }}>{selectedMode.catchUpLabel}</Text>
            </div>
          </Form.Item>

          <Form.Item
            label="Max consecutive games per player"
            name="maxConsecutiveGames"
            extra="How many games in a row a player can play before being rested. Default of 2 works for most sessions."
          >
            <InputNumber size="large" min={1} max={10} style={{ width: "100%" }} />
          </Form.Item>

          <Form.Item label="Session date" name="sessionDate" rules={[{ required: true }]}>
            <DatePicker size="large" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Start / end time" name="timeRange">
            <TimePicker.RangePicker size="large" format="HH:mm" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Number of courts" name="numberOfCourts" rules={[{ required: true }]}>
            <InputNumber size="large" min={1} max={20} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Points to win" name="pointsTarget">
            <InputNumber size="large" min={1} max={30} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Require winning by two points" name="winByTwo" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block loading={loading}>
              Create session
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
