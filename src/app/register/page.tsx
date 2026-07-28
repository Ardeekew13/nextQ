"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMutation } from "@apollo/client";
import { Form, Input, Button, Typography, Card, App } from "antd";
import { REGISTER_ORGANISER } from "@/graphql/documents/organiser";
import { BURGUNDY } from "@/theme/themeConfig";

const { Title, Text } = Typography;

export default function RegisterPage() {
  const router = useRouter();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [registerOrganiser] = useMutation(REGISTER_ORGANISER);

  async function onFinish(values: { name: string; email: string; password: string }) {
    setLoading(true);
    try {
      await registerOrganiser({ variables: values });
      message.success("Account created!");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background: "#f5f5f5",
      }}
    >
      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link
          href="/"
          style={{ display: "block", textAlign: "center", color: BURGUNDY.primary, fontWeight: 800, fontSize: 26, marginBottom: 20 }}
        >
          NextQ
        </Link>
        <Card>
          <Title level={3} style={{ textAlign: "center", marginTop: 0 }}>
            Create organiser account
          </Title>
          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <Form.Item label="Name" name="name" rules={[{ required: true, message: "Enter your name" }]}>
              <Input size="large" autoComplete="name" />
            </Form.Item>
            <Form.Item
              label="Email"
              name="email"
              rules={[{ required: true, type: "email", message: "Enter a valid email" }]}
            >
              <Input size="large" autoComplete="email" />
            </Form.Item>
            <Form.Item
              label="Password"
              name="password"
              rules={[{ required: true, min: 8, message: "At least 8 characters" }]}
            >
              <Input.Password size="large" autoComplete="new-password" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 12 }}>
              <Button type="primary" htmlType="submit" size="large" block loading={loading}>
                Register
              </Button>
            </Form.Item>
          </Form>
          <Text type="secondary">
            Already have an account? <Link href="/login">Log in</Link>
          </Text>
        </Card>
      </div>
    </main>
  );
}
