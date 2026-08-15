"use client";

import { LOGIN_ORGANISER } from "@/graphql/documents/organiser";
import { useMutation } from "@apollo/client";
import { App, Button, Form, Input } from "antd";
import { Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import NProgress from "nprogress";
import { useEffect, useState } from "react";

export default function LoginPage() {
	const router = useRouter();
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);
	const [isMobile, setIsMobile] = useState(false);
	const [loginOrganiser] = useMutation(LOGIN_ORGANISER);
	const [form] = Form.useForm();

	useEffect(() => {
		const mq = window.matchMedia("(max-width: 768px)");
		const update = () => setIsMobile(mq.matches);
		update();
		mq.addEventListener("change", update);
		return () => mq.removeEventListener("change", update);
	}, []);

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
				html, body {
					background-color: #ffffff;
					font-family: 'Barlow', system-ui, sans-serif;
					margin: 0;
					padding: 0;
					height: 100% !important;
					overflow: hidden !important;
				}
				h1, h2, h3, h4, h5, h6 {
					font-family: 'Barlow Condensed', sans-serif;
					font-weight: 600;
					text-transform: uppercase;
				}
				.login-main {
					height: 100vh;
					display: grid;
					grid-template-columns: 1fr 1fr;
				}
				.login-form-container {
					display: flex;
					flex-direction: column;
					align-items: center;
					width: 100%;
					max-width: 400px;
					margin-left: auto;
					margin-right: auto;
					padding: 0 24px;
					box-sizing: border-box;
				}
				.login-form-container .ant-form {
					width: 100%;
				}
				.login-form-container .ant-form-item {
					margin-bottom: 16px;
				}

				/* Mobile redesign */
				.login-mobile-page {
					height: 100vh;
					width: 100%;
					overflow: hidden;
					box-sizing: border-box;
					display: flex;
					align-items: center;
					justify-content: center;
					padding: 32px 24px;
					background: linear-gradient(160deg, #fff5f8 0%, #ffe1ec 55%, #ffd0e2 100%);
				}
				.login-mobile-card {
					display: flex;
					flex-direction: column;
					align-items: center;
					width: 100%;
					max-width: 380px;
				}
				.login-mobile-card img {
					height: 180px;
					width: auto;
					margin-bottom: 8px;
				}
				.login-mobile-inner-card {
					width: 100%;
					background: #fff;
					border-radius: 28px !important;
					padding: 32px 24px;
					box-sizing: border-box;
					box-shadow: 0 12px 32px rgba(92,16,41,.12);
					display: flex;
					flex-direction: column;
					align-items: center;
				}
				.login-mobile-inner-card h1 {
					font-size: 26px;
					line-height: 1;
					margin: 0 0 8px;
					color: #1d1f20;
					text-align: center;
				}
				.login-mobile-inner-card .login-mobile-subtitle {
					font-size: 14px;
					color: rgba(29,31,32,.6);
					text-align: center;
					margin: 0 0 24px;
					line-height: 1.4;
				}
				.login-mobile-inner-card .ant-form {
					width: 100%;
				}
				.login-mobile-inner-card .ant-form-item {
					margin-bottom: 16px;
				}
				.login-mobile-inner-card .ant-input-affix-wrapper {
					position: relative !important;
					border-radius: 999px !important;
					height: 54px !important;
					min-height: 54px !important;
					padding: 0 20px !important;
					background: #faf7f8 !important;
					border: 1px solid rgba(29,31,32,.08) !important;
					box-sizing: border-box !important;
				}
				.login-mobile-inner-card .ant-input-affix-wrapper .ant-input {
					height: 100% !important;
					padding: 0 !important;
					font-size: 15px !important;
					background: transparent !important;
				}
				.login-mobile-inner-card .ant-input-prefix {
					margin-right: 12px;
					color: #f43f75;
					display: flex;
					align-items: center;
				}
				.login-mobile-inner-card .ant-input-suffix {
					position: absolute !important;
					top: 50% !important;
					right: 20px !important;
					transform: translateY(-50%) !important;
					margin: 0 !important;
				}
				.login-mobile-inner-card .ant-btn {
					border-radius: 999px !important;
					height: 54px !important;
					font-size: 16px;
					font-family: 'Barlow Condensed', sans-serif;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: .06em;
					background: #f43f75;
					border-color: #f43f75;
					color: #fff;
					border: none;
					box-shadow: 0 8px 20px rgba(244,63,117,.35);
				}
			`,
				}}
			/>

			{isMobile ? (
				<div className="login-mobile-page">
					<div className="login-mobile-card">
						<img src="/transparent.png" alt="NextQ" />
						<div className="login-mobile-inner-card">
							<h1>Welcome back</h1>
							<p className="login-mobile-subtitle">
								Access your sessions, manage draws, and track standings.
							</p>

							<Form
								form={form}
								layout="vertical"
								onFinish={onFinish}
								requiredMark={false}
							>
								<Form.Item
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
										placeholder="Enter your email"
										autoComplete="email"
										prefix={<Mail size={18} />}
									/>
								</Form.Item>

								<Form.Item
									name="password"
									rules={[{ required: true, message: "Enter your password" }]}
								>
									<Input.Password
										size="large"
										placeholder="Password"
										autoComplete="current-password"
										prefix={<Lock size={18} />}
									/>
								</Form.Item>

								<Form.Item style={{ marginBottom: 0 }}>
									<Button
										type="primary"
										htmlType="submit"
										size="large"
										block
										loading={loading}
									>
										Log In
									</Button>
								</Form.Item>
							</Form>
						</div>
					</div>
				</div>
			) : (
				<main className="login-main">
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
									ORGANIZER LOGIN
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
						<div className="login-form-container" style={{ maxWidth: "100%" }}>
							<img
								src="/transparent.png"
								alt="NextQ"
								style={{ height: 220, marginBottom: 24 }}
							/>
							<h2
								style={{
									fontSize: "40px",
									lineHeight: "1",
									margin: "0 0 16px",
									color: "#1d1f20",
									textAlign: "center",
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
									textAlign: "center",
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
						</div>
					</section>
				</main>
			)}
		</>
	);
}
