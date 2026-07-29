"use client";

import { useState, useEffect, type ReactNode } from "react";
import { useMutation, useQuery, useLazyQuery } from "@apollo/client";
import {
  Table, Switch, Button, Modal, Form, Input, Select,
  Popconfirm, Space, Tag, App, Tabs, Card, Typography, Badge, Checkbox, Empty, Spin,
} from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined, CheckOutlined, TeamOutlined } from "@ant-design/icons";
import {
  SESSION_PLAYERS_QUERY,
  ADD_SESSION_PLAYER,
  ADD_SESSION_PLAYERS,
  UPDATE_SESSION_PLAYER,
  REMOVE_SESSION_PLAYER,
  CHECK_IN_PLAYER,
  SET_PLAYER_ACTIVE_STATUS,
  CLUB_MEMBERS_QUERY,
  IMPORT_CLUB_MEMBERS_TO_SESSION,
} from "@/graphql/documents/organiser";
import { PageHeader } from "@/components/PageHeader";

const { Text } = Typography;

const SKILL_OPTIONS = [
  { value: "NOVICE", label: "Novice" },
  { value: "BEGINNER_LOW", label: "Beginner (low)" },
  { value: "BEGINNER_HIGH", label: "Beginner (high)" },
  { value: "INTERMEDIATE", label: "Intermediate" },
  { value: "ADVANCED", label: "Advanced" },
];

export function PlayersTab({ sessionId, onHeader }: { sessionId: string; onHeader?: (node: ReactNode) => void }) {
  const { message } = App.useApp();
  const { data, refetch } = useQuery(SESSION_PLAYERS_QUERY, { variables: { id: sessionId }, pollInterval: 5000 });

  const [addOpen, setAddOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [checkingIn, setCheckingIn] = useState(false);
  const [singleForm] = Form.useForm();
  const [bulkForm] = Form.useForm();
  const [editForm] = Form.useForm();

  const [addSessionPlayer, { loading: addingSingle }] = useMutation(ADD_SESSION_PLAYER);
  const [addSessionPlayers, { loading: addingBulk }] = useMutation(ADD_SESSION_PLAYERS);
  const [updateSessionPlayer] = useMutation(UPDATE_SESSION_PLAYER);
  const [removeSessionPlayer] = useMutation(REMOVE_SESSION_PLAYER);
  const [checkInPlayer] = useMutation(CHECK_IN_PLAYER);
  const [setPlayerActiveStatus] = useMutation(SET_PLAYER_ACTIVE_STATUS);
  const [importMembers] = useMutation(IMPORT_CLUB_MEMBERS_TO_SESSION);

  // Club roster import
  const [selectedImportIds, setSelectedImportIds] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [fetchClubMembers, { data: membersData, loading: membersLoading }] = useLazyQuery(CLUB_MEMBERS_QUERY);

  const session = data?.session;
  const isDraft = session?.status === "DRAFT";
  const clubId: string | undefined = session?.clubId;

  // Derive which selected players are checked-in vs not
  const players: any[] = session?.players ?? [];
  const existingNames = new Set(players.map((p: any) => p.name.toLowerCase()));
  const selectedPlayers = players.filter((p) => selectedKeys.includes(p.id));
  const allSelectedCheckedIn = selectedPlayers.length > 0 && selectedPlayers.every((p) => p.checkedIn);
  const someSelectedCheckedIn = selectedPlayers.some((p) => p.checkedIn);

  const clubMembers: any[] = membersData?.clubMembers ?? [];
  const importableMembers = clubMembers.filter((m) => !existingNames.has(m.name.toLowerCase()));

  useEffect(() => {
    onHeader?.(
      <PageHeader title="Players">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setAddOpen(true)}>
          Add players
        </Button>
      </PageHeader>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBulkCheckIn(checkedIn: boolean) {
    if (selectedKeys.length === 0) return;
    setCheckingIn(true);
    try {
      await Promise.all(selectedKeys.map((id) => checkInPlayer({ variables: { id, checkedIn } })));
      message.success(`${selectedKeys.length} player${selectedKeys.length > 1 ? "s" : ""} ${checkedIn ? "checked in" : "checked out"}`);
      setSelectedKeys([]);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not update check-in status");
    } finally {
      setCheckingIn(false);
    }
  }

  async function handleAddSingle(values: { name: string; nickname?: string; skillLevel?: string }) {
    const name = values.name.trim().toUpperCase();
    if (existingNames.has(name.toLowerCase())) {
      message.error(`"${name}" is already in this session`);
      return;
    }
    try {
      const result = await addSessionPlayer({ variables: { sessionId, input: { ...values, name } } });
      const newId = result.data?.addSessionPlayer?.id;
      if (newId) await checkInPlayer({ variables: { id: newId, checkedIn: true } });
      message.success("Player added and checked in");
      singleForm.resetFields();
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not add player");
    }
  }

  async function handleAddBulk(values: { names: string }) {
    const lines = values.names.split("\n").map((l) => l.trim().toUpperCase()).filter(Boolean);
    // Deduplicate within input
    const unique = [...new Set(lines)];
    // Remove already-existing players
    const dupes = unique.filter((n) => existingNames.has(n.toLowerCase()));
    const inputs = unique.filter((n) => !existingNames.has(n.toLowerCase())).map((name) => ({ name }));

    if (dupes.length > 0) {
      message.warning(`Skipped ${dupes.length} duplicate${dupes.length > 1 ? "s" : ""}: ${dupes.join(", ")}`);
    }
    if (inputs.length === 0) return;
    try {
      const result = await addSessionPlayers({ variables: { sessionId, inputs } });
      const newIds: string[] = result.data?.addSessionPlayers?.map((p: any) => p.id) ?? [];
      if (newIds.length > 0) await Promise.all(newIds.map((id) => checkInPlayer({ variables: { id, checkedIn: true } })));
      message.success(`${inputs.length} player${inputs.length > 1 ? "s" : ""} added and checked in`);
      bulkForm.resetFields();
      setAddOpen(false);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not add players");
    }
  }

  async function handleActive(id: string, active: boolean) {
    await setPlayerActiveStatus({ variables: { id, active } });
    refetch();
  }

  async function handleRemove(id: string) {
    try {
      await removeSessionPlayer({ variables: { id } });
      message.success("Player removed");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not remove player");
    }
  }

  async function handleEditSubmit(values: any) {
    try {
      await updateSessionPlayer({ variables: { id: editingPlayer.id, input: values } });
      message.success("Player updated");
      setEditingPlayer(null);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not update player");
    }
  }

  async function handleImportMembers() {
    if (selectedImportIds.length === 0) return;
    setImporting(true);
    try {
      const result = await importMembers({ variables: { sessionId, memberIds: selectedImportIds } });
      const imported: any[] = result.data?.importClubMembersToSession ?? [];
      if (imported.length > 0) {
        await Promise.all(imported.map((p) => checkInPlayer({ variables: { id: p.id, checkedIn: true } })));
      }
      message.success(`${imported.length} player${imported.length !== 1 ? "s" : ""} imported and checked in`);
      setSelectedImportIds([]);
      setAddOpen(false);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not import players");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ position: "relative" }}>
      <Card styles={{ body: { padding: 0 } }}>
        <Table
          rowKey="id"
          dataSource={players}
          scroll={{ x: true }}
          rowSelection={{
            selectedRowKeys: selectedKeys,
            onChange: (keys) => setSelectedKeys(keys as string[]),
            getCheckboxProps: () => ({}),
          }}
          columns={[
            {
              title: "Name",
              dataIndex: "name",
              render: (name: string, row: any) => (
                <Space direction="vertical" size={0}>
                  <Text strong>{name}</Text>
                  {row.nickname && <Text type="secondary" style={{ fontSize: 12 }}>{row.nickname}</Text>}
                </Space>
              ),
            },
            {
              title: "Skill",
              dataIndex: "skillLevel",
              render: (v: string) => (
                <Tag>{v ? (SKILL_OPTIONS.find((o) => o.value === v)?.label ?? v) : "Unrated"}</Tag>
              ),
            },
            {
              title: "Checked in",
              dataIndex: "checkedIn",
              render: (checkedIn: boolean) => (
                <Tag color={checkedIn ? "green" : "default"}>{checkedIn ? "Yes" : "No"}</Tag>
              ),
            },
            {
              title: "Active",
              dataIndex: "active",
              render: (active: boolean, row: any) => (
                <Switch checked={active} onChange={(v) => handleActive(row.id, v)} />
              ),
            },
            { title: "GP", dataIndex: "gamesPlayed", width: 60 },
            { title: "W-L", render: (_: unknown, row: any) => `${row.wins}-${row.losses}` },
            {
              title: "Actions",
              render: (_: unknown, row: any) => (
                <Space>
                  <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingPlayer(row); editForm.setFieldsValue(row); }} />
                  {isDraft && (
                    <Popconfirm title="Remove this player?" onConfirm={() => handleRemove(row.id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      {/* Floating check-in bar */}
      {selectedKeys.length > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 32,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 200,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
            padding: "12px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
            minWidth: 320,
          }}
        >
          <Text strong style={{ flex: 1 }}>
            <Badge count={selectedKeys.length} style={{ backgroundColor: "#ec4899", marginRight: 8 }} />
            {selectedKeys.length} player{selectedKeys.length > 1 ? "s" : ""} selected
          </Text>
          <Space>
            {someSelectedCheckedIn && (
              <Button
                loading={checkingIn}
                onClick={() => handleBulkCheckIn(false)}
              >
                Check out
              </Button>
            )}
            {!allSelectedCheckedIn && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                loading={checkingIn}
                onClick={() => handleBulkCheckIn(true)}
              >
                Check in
              </Button>
            )}
            <Button type="text" onClick={() => setSelectedKeys([])}>Clear</Button>
          </Space>
        </div>
      )}

      <Modal title="Add players" open={addOpen} onCancel={() => setAddOpen(false)} footer={null}>
        <Tabs
          onChange={(key) => {
            if (key === "import" && clubId) {
              fetchClubMembers({ variables: { clubId } });
            }
          }}
          items={[
            {
              key: "single",
              label: "One player",
              children: (
                <Form form={singleForm} layout="vertical" onFinish={handleAddSingle}>
                  <Form.Item
                    label="Name"
                    name="name"
                    rules={[{ required: true, message: "Enter a name" }]}
                    normalize={(v: string) => v?.toUpperCase()}
                  >
                    <Input size="large" style={{ textTransform: "uppercase" }} placeholder="PLAYER NAME" />
                  </Form.Item>
                  <Form.Item label="Nickname" name="nickname">
                    <Input size="large" />
                  </Form.Item>
                  <Form.Item label="Skill level (optional)" name="skillLevel">
                    <Select allowClear options={SKILL_OPTIONS} size="large" />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={addingSingle}>
                    Add player
                  </Button>
                </Form>
              ),
            },
            {
              key: "bulk",
              label: "Multiple players",
              children: (
                <Form form={bulkForm} layout="vertical" onFinish={handleAddBulk}>
                  <Form.Item
                    label="One name per line"
                    name="names"
                    rules={[{ required: true, message: "Enter at least one name" }]}
                    extra="Names will be saved in UPPERCASE. Duplicates are skipped automatically."
                  >
                    <Input.TextArea
                      rows={8}
                      placeholder={"ALEX\nJORDAN\nSAM"}
                      style={{ textTransform: "uppercase" }}
                      onChange={(e) => {
                        bulkForm.setFieldValue("names", e.target.value.toUpperCase());
                      }}
                    />
                  </Form.Item>
                  <Button type="primary" htmlType="submit" block size="large" loading={addingBulk}>
                    Add players
                  </Button>
                </Form>
              ),
            },
            {
              key: "import",
              label: (
                <span><TeamOutlined /> Club roster</span>
              ),
              children: (
                <div>
                  {membersLoading ? (
                    <div style={{ textAlign: "center", padding: 32 }}><Spin /></div>
                  ) : importableMembers.length === 0 ? (
                    <Empty
                      description={
                        clubMembers.length === 0
                          ? "No players in the club roster yet. Add players to a session and they'll appear here automatically."
                          : "All club members are already in this session."
                      }
                    />
                  ) : (
                    <div>
                      <div style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <Typography.Text type="secondary">{importableMembers.length} available • {selectedImportIds.length} selected</Typography.Text>
                        <Button
                          size="small"
                          type="link"
                          onClick={() =>
                            setSelectedImportIds(
                              selectedImportIds.length === importableMembers.length
                                ? []
                                : importableMembers.map((m) => m.id)
                            )
                          }
                        >
                          {selectedImportIds.length === importableMembers.length ? "Deselect all" : "Select all"}
                        </Button>
                      </div>
                      <div style={{ maxHeight: 260, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                        {importableMembers.map((m) => (
                          <div
                            key={m.id}
                            onClick={() =>
                              setSelectedImportIds((prev) =>
                                prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]
                              )
                            }
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 10px",
                              borderRadius: 8,
                              cursor: "pointer",
                              background: selectedImportIds.includes(m.id) ? "#f0fdf4" : "#fafafa",
                              border: `1px solid ${selectedImportIds.includes(m.id) ? "#86efac" : "#e5e7eb"}`,
                            }}
                          >
                            <Checkbox checked={selectedImportIds.includes(m.id)} />
                            <div style={{ flex: 1 }}>
                              <Typography.Text strong>{m.name}</Typography.Text>
                              {m.nickname && <Typography.Text type="secondary" style={{ marginLeft: 6, fontSize: 12 }}>{m.nickname}</Typography.Text>}
                            </div>
                            {m.skillLevel && <Tag style={{ margin: 0 }}>{SKILL_OPTIONS.find((o) => o.value === m.skillLevel)?.label ?? m.skillLevel}</Tag>}
                            <Typography.Text type="secondary" style={{ fontSize: 11 }}>{m.sessionsPlayed} sessions</Typography.Text>
                          </div>
                        ))}
                      </div>
                      <Button
                        type="primary"
                        block
                        size="large"
                        style={{ marginTop: 16 }}
                        disabled={selectedImportIds.length === 0}
                        loading={importing}
                        onClick={handleImportMembers}
                      >
                        Import {selectedImportIds.length > 0 ? `${selectedImportIds.length} ` : ""}player{selectedImportIds.length !== 1 ? "s" : ""}
                      </Button>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />
      </Modal>

      <Modal title="Edit player" open={!!editingPlayer} onCancel={() => setEditingPlayer(null)} onOk={() => editForm.submit()}>
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item label="Name" name="name" rules={[{ required: true }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label="Nickname" name="nickname">
            <Input size="large" />
          </Form.Item>
          <Form.Item label="Skill level" name="skillLevel">
            <Select allowClear options={SKILL_OPTIONS} size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
