"use client";

import { LOGIN_ORGANISER } from "@/graphql/documents/organiser";
import { useMutation } from "@apollo/client";
import { App, Button, Card, Form, Input, Typography } from "antd";
import NextImage from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import { useState } from "react";

const { Title, Text } = Typography;

export default function LoginPage() {
	const router = useRouter();
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);
	const [loginOrganiser] = useMutation(LOGIN_ORGANISER);

	async function onFinish(values: { email: string; password: string }) {
		setLoading(true);
		NProgress.start();
		try {
			await loginOrganiser({ variables: values });
			message.success("Welcome back!");
			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			NProgress.done();
			message.error(error instanceof Error ? error.message : "Login failed");
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
				<Card>
					<div
						style={{
							display: "flex",
							justifyContent: "center",
							marginBottom: 8,
							overflow: "hidden",
							width: 160,
							height: 170,
							margin: "0 auto 12px",
						}}
					>
						<NextImage
							src="/nextQ.png"
							alt="NextQ"
							width={180}
							height={180}
							style={{
								objectFit: "contain",
							}}
							priority
						/>
					</div>

					<Form layout="vertical" onFinish={onFinish} requiredMark={false}>
						<Form.Item
							label="Email"
							name="email"
							rules={[
								{
									required: true,
									type: "email",
									message: "Enter a valid email",
								},
							]}
						>
							<Input size="large" autoComplete="email" />
						</Form.Item>
						<Form.Item
							label="Password"
							name="password"
							rules={[{ required: true, message: "Enter your password" }]}
						>
							<Input.Password size="large" autoComplete="current-password" />
						</Form.Item>
						<Form.Item style={{ marginBottom: 12 }}>
							<Button
								type="primary"
								htmlType="submit"
								size="large"
								block
								loading={loading}
							>
								Log in
							</Button>
						</Form.Item>
					</Form>
					<Text type="secondary">
						No account yet?{" "}
						<Link href="/register">Register as an organiser</Link>
					</Text>
				</Card>
			</div>
		</main>
	);
}
