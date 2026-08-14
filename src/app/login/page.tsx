"use client";

import { LOGIN_ORGANISER } from "@/graphql/documents/organiser";
import { useMutation } from "@apollo/client";
import { App, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import { useState } from "react";

export default function LoginPage() {
	const router = useRouter();
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);
	const [loginOrganiser] = useMutation(LOGIN_ORGANISER);
	const [form] = Form.useForm();

	async function onFinish(values: { email: string; password: string }) {
		setLoading(true);
		NProgress.start();
		try {
			await loginOrganiser({ variables: values });
			message.success("Welcome back!");
			NProgress.done();
			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			NProgress.done();
			setLoading(false);
			message.error(error instanceof Error ? error.message : "Login failed");
		}
	}

	return (
		<>
			<style
				dangerouslySetInnerHTML={{
					__html: `
				* {
					border-radius: 0 !important;
				}
				body {
					background-color: #ffffff;
					font-family: 'Barlow', system-ui, sans-serif;
					margin: 0;
					padding: 0;
				}
				h1, h2, h3, h4, h5, h6 {
					font-family: 'Barlow Condensed', sans-serif;
					font-weight: 600;
					text-transform: uppercase;
				}
				.login-main {
					grid-template-columns: 1fr 1fr;
				}
				@media (max-width: 768px) {
					body {
						overflow-x: hidden;
					}
					.login-main {
						grid-template-columns: 1fr;
					}
					.login-left {
						padding: 32px 16px !important;
						min-height: 50vh;
						justify-content: center !important;
					}
					.login-right {
						padding: 32px 16px !important;
					}
					.login-left h1 {
						font-size: 28px !important;
					}
					.login-right h2 {
						font-size: 24px !important;
					}
				}
			`,
				}}
			/>

			<main
				style={{
					minHeight: "100vh",
					display: "grid",
					gridTemplateColumns: "1fr 1fr",
				}}
				className="login-main"
			>
				{/* Left: Dark section */}
				<section
					className="login-left"
					style={{
						background: "#5c1029",
						padding: "64px 48px",
						display: "flex",
						flexDirection: "column",
						justifyContent: "space-between",
						color: "#fff",
					}}
				>
					<div>
						<div style={{ marginBottom: 48 }}>
							<div
								style={{
									fontSize: "10px",
									fontWeight: 600,
									textTransform: "uppercase",
									letterSpacing: ".2em",
									color: "#ffb9cd",
									marginBottom: 16,
								}}
							>
								ORGANISER LOGIN
							</div>
							<h1
								style={{
									fontSize: "52px",
									lineHeight: "1",
									margin: "0 0 20px",
									color: "#fff",
								}}
							>
								Welcome back
							</h1>
							<p
								style={{
									fontSize: "16px",
									lineHeight: "1.5",
									color: "rgba(255,255,255,.85)",
									margin: 0,
									maxWidth: "42ch",
								}}
							>
								Access your sessions, manage draws, and track standings.
							</p>
						</div>

						<div
							style={{
								display: "flex",
								flexDirection: "column",
								gap: 14,
								marginBottom: 48,
							}}
						>
							{[
								"Manage live sessions from any device",
								"View real-time player standings",
								"Access historical session data",
							].map((item, idx) => (
								<div
									key={idx}
									style={{
										display: "flex",
										alignItems: "flex-start",
										gap: 12,
										fontSize: "15px",
										lineHeight: "1.5",
										color: "#fff",
									}}
								>
									<span
										style={{
											color: "#ffb9cd",
											marginTop: 2,
											flexShrink: 0,
										}}
									>
										✓
									</span>
									<span>{item}</span>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* Right: Form section */}
				<section
					className="login-right"
					style={{
						background: "#fff",
						padding: "64px 48px",
						display: "flex",
						flexDirection: "column",
						justifyContent: "center",
					}}
				>
					<div style={{ maxWidth: "100%" }}>
						<h2
							style={{
								fontSize: "40px",
								lineHeight: "1",
								margin: "0 0 16px",
								color: "#1d1f20",
							}}
						>
							Log in
						</h2>
						<p
							style={{
								fontSize: "15px",
								color: "rgba(29,31,32,.6)",
								margin: "0 0 32px",
								lineHeight: "1.5",
							}}
						>
							Enter your email and password to continue.
						</p>

						<Form
							form={form}
							layout="vertical"
							onFinish={onFinish}
							requiredMark={false}
							style={{ marginBottom: 24 }}
						>
							<Form.Item
								label={
									<span
										style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}
									>
										Email
									</span>
								}
								name="email"
								rules={[
									{
										required: true,
										type: "email",
										message: "Enter a valid email",
									},
								]}
							>
								<Input
									size="large"
									placeholder="you@club.ph"
									autoComplete="email"
									style={{
										padding: "10px 12px",
										fontSize: 14,
									}}
								/>
							</Form.Item>

							<Form.Item
								label={
									<span
										style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}
									>
										Password
									</span>
								}
								name="password"
								rules={[{ required: true, message: "Enter your password" }]}
							>
								<Input.Password
									size="large"
									autoComplete="current-password"
									style={{
										padding: "10px 12px",
										fontSize: 14,
									}}
								/>
							</Form.Item>

							<Form.Item style={{ marginBottom: 0 }}>
								<Button
									type="primary"
									htmlType="submit"
									size="large"
									block
									loading={loading}
									style={{
										height: 48,
										fontSize: 16,
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										letterSpacing: ".06em",
										background: "#f43f75",
										borderColor: "#f43f75",
										color: "#fff",
										border: "none",
									}}
								>
									Log in
								</Button>
							</Form.Item>
						</Form>

						<div
							style={{
								textAlign: "center",
								fontSize: "14px",
								color: "#1d1f20",
							}}
						>
							No account yet?{" "}
							<Link
								href="/register"
								style={{
									color: "#f43f75",
									textDecoration: "none",
									fontWeight: 600,
								}}
							>
								Create one
							</Link>
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
