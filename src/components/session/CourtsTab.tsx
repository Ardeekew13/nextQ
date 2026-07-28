"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Table, Button, Modal, Form, Input, InputNumber, Switch, Tag, Space, App, Card } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import {
  SESSION_DASHBOARD_QUERY,
  ADD_COURT,
  UPDATE_COURT,
  DISABLE_COURT,
} from "@/graphql/documents/organiser";
import { humanizeStatus } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";

const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "green",
  IN_USE: "blue",
  DISABLED: "default",
};

export function CourtsTab({ sessionId, onHeader }: { sessionId: string; onHeader?: (node: ReactNode) => void }) {
  const { message } = App.useApp();
  const { data, refetch } = useQuery(SESSION_DASHBOARD_QUERY, { variables: { id: sessionId } });

  const [addOpen, setAddOpen] = useState(false);
  const [editingCourt, setEditingCourt] = useState<any>(null);
  const [addForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const [addCourt, { loading: adding }] = useMutation(ADD_COURT);
  const [updateCourt] = useMutation(UPDATE_COURT);
  const [disableCourt] = useMutation(DISABLE_COURT);

  const courts = data?.session?.courts ?? [];
  const nextCourtNumber = (courts.reduce((max: number, c: any) => Math.max(max, c.courtNumber), 0) || 0) + 1;

  useEffect(() => {
    onHeader?.(
      <PageHeader title="Courts">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            addForm.setFieldsValue({ courtNumber: nextCourtNumber });
            setAddOpen(true);
          }}
        >
          Add court
        </Button>
      </PageHeader>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextCourtNumber]);

  async function handleAdd(values: { courtNumber: number; name?: string }) {
    try {
      await addCourt({ variables: { sessionId, input: values } });
      message.success("Court added");
      setAddOpen(false);
      addForm.resetFields();
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not add court");
    }
  }

  async function handleEditSubmit(values: { name?: string; courtNumber?: number }) {
    try {
      await updateCourt({ variables: { id: editingCourt.id, input: values } });
      message.success("Court updated");
      setEditingCourt(null);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not update court");
    }
  }

  async function handleToggleDisabled(court: any, disabled: boolean) {
    try {
      await disableCourt({ variables: { id: court.id, disabled } });
      message.success(disabled ? "Court disabled" : "Court enabled");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not update court");
    }
  }

  return (
    <div>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          dataSource={courts}
          scroll={{ x: true }}
          columns={[
            { title: "#", dataIndex: "courtNumber", width: 60 },
            { title: "Name", dataIndex: "name" },
            {
              title: "Status",
              dataIndex: "status",
              render: (status: string) => <Tag color={STATUS_COLORS[status]}>{humanizeStatus(status)}</Tag>,
            },
            {
              title: "Current game",
              render: (_: unknown, court: any) =>
                court.currentGame
                  ? `${court.currentGame.teamA.players.map((p: any) => p.name).join(" & ")} vs ${court.currentGame.teamB.players.map((p: any) => p.name).join(" & ")}`
                  : "-",
            },
            {
              title: "Actions",
              render: (_: unknown, court: any) => (
                <Space>
                  <Button size="small" onClick={() => { setEditingCourt(court); editForm.setFieldsValue(court); }}>
                    Edit
                  </Button>
                  <Switch
                    checkedChildren="Enabled"
                    unCheckedChildren="Disabled"
                    checked={court.status !== "DISABLED"}
                    disabled={!!court.currentGame}
                    onChange={(checked) => handleToggleDisabled(court, !checked)}
                  />
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="Add court" open={addOpen} onCancel={() => setAddOpen(false)} onOk={() => addForm.submit()} confirmLoading={adding}>
        <Form form={addForm} layout="vertical" onFinish={handleAdd}>
          <Form.Item label="Court number" name="courtNumber" rules={[{ required: true }]}>
            <InputNumber size="large" min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Name (optional)" name="name">
            <Input size="large" placeholder="Court A" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="Edit court" open={!!editingCourt} onCancel={() => setEditingCourt(null)} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item label="Court number" name="courtNumber" rules={[{ required: true }]}>
            <InputNumber size="large" min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item label="Name" name="name">
            <Input size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
