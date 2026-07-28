"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@apollo/client";
import { List, Button, Typography, Empty, Skeleton, Modal, Form, Input, App, Card, Avatar, Space } from "antd";
import { PlusOutlined, TeamOutlined, EnvironmentOutlined } from "@ant-design/icons";
import { MY_CLUBS_QUERY, CREATE_CLUB } from "@/graphql/documents/organiser";
import { BURGUNDY } from "@/theme/themeConfig";

const { Title, Text } = Typography;

export default function ClubsPage() {
  const { data, loading, refetch } = useQuery(MY_CLUBS_QUERY);
  const { message } = App.useApp();
  const [open, setOpen] = useState(false);
  const [createClub, { loading: creating }] = useMutation(CREATE_CLUB);
  const [form] = Form.useForm();

  async function handleCreate(values: { name: string; location?: string; description?: string }) {
    try {
      await createClub({ variables: { input: values } });
      message.success("Club created");
      setOpen(false);
      form.resetFields();
      refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not create club");
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          Clubs
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
          Create club
        </Button>
      </div>

      {loading && <Skeleton active />}

      {!loading && (data?.myClubs?.length ?? 0) === 0 && (
        <Empty description="No clubs yet.">
          <Button type="primary" onClick={() => setOpen(true)}>
            Create club
          </Button>
        </Empty>
      )}

      <List
        grid={{ gutter: 16, xs: 1, sm: 2, lg: 3 }}
        dataSource={data?.myClubs ?? []}
        renderItem={(club: any) => (
          <List.Item>
            <Link href={`/dashboard/clubs/${club.id}`}>
              <Card hoverable styles={{ body: { padding: 18 } }}>
                <Space align="start" size={12}>
                  <Avatar shape="square" size={40} style={{ backgroundColor: BURGUNDY.soft, color: BURGUNDY.primary, flexShrink: 0 }} icon={<TeamOutlined />} />
                  <div>
                    <Text strong style={{ fontSize: 16, display: "block" }}>
                      {club.name}
                    </Text>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      <EnvironmentOutlined /> {club.location || "No location set"}
                    </Text>
                    <br />
                    <Text code style={{ marginTop: 4, display: "inline-block" }}>
                      /club/{club.slug}
                    </Text>
                  </div>
                </Space>
              </Card>
            </Link>
          </List.Item>
        )}
      />

      <Modal
        title="Create club"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate} requiredMark={false}>
          <Form.Item label="Club name" name="name" rules={[{ required: true, message: "Enter a club name" }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input size="large" />
          </Form.Item>
          <Form.Item label="Description" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
