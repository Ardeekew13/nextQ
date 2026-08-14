"use client";

import { REGISTER_ORGANISER } from "@/graphql/documents/organiser";
import { useMutation } from "@apollo/client";
import { App, Button, Form, Input, Checkbox } from "antd";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AppLogo } from "@/components/AppLogo";

export default function RegisterPage() {
	const router = useRouter();
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);
	const [registerOrganiser] = useMutation(REGISTER_ORGANISER);
	const [form] = Form.useForm();

	async function onFinish(values: {
		name: string;
		email: string;
		password: string;
	}) {
		setLoading(true);
		try {
			await registerOrganiser({ variables: values });
			message.success("Account created!");
			router.push("/dashboard");
			router.refresh();
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Registration failed",
			);
		} finally {
			setLoading(false);
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
				.register-main {
					grid-template-columns: 1fr 1fr;
				}
				@media (max-width: 768px) {
					body {
						overflow-x: hidden;
					}
					.register-main {
						grid-template-columns: 1fr;
					}
					.register-left {
						padding: 32px 16px !important;
						min-height: 50vh;
						justify-content: center !important;
					}
					.register-right {
						padding: 32px 16px !important;
					}
					.register-left h1 {
						font-size: 28px !important;
					}
					.register-right h2 {
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
				className="register-main"
			>
				{/* Left: Dark marketing section */}
				<section
					className="register-left"
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
								Organiser Account
							</div>
							<h1
								style={{
									fontSize: "52px",
									lineHeight: "1",
									margin: "0 0 20px",
									color: "#fff",
								}}
							>
								Run your first session tonight
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
								Set up courts, let players scan in, and let NextQ handle the
								draw. Free, no card required.
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
								"Fair random draws — everyone plays with everyone",
								"Players scan a QR at the gate — no app to install",
								"Standings post themselves as games finish",
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

				{/* Right: Registration form */}
				<section
					className="register-right"
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
							Create your account
						</h2>
						<p
							style={{
								fontSize: "15px",
								color: "rgba(29,31,32,.6)",
								margin: "0 0 32px",
								lineHeight: "1.5",
							}}
						>
							Takes about a minute. You can add your club right after.
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
										Full name
									</span>
								}
								name="name"
								rules={[{ required: true, message: "Enter your name" }]}
							>
								<Input
									size="large"
									placeholder="Ron Quilicot"
									autoComplete="name"
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
								rules={[
									{ required: true, min: 8, message: "At least 8 characters" },
								]}
							>
								<Input.Password
									size="large"
									autoComplete="new-password"
									style={{
										padding: "10px 12px",
										fontSize: 14,
									}}
								/>
							</Form.Item>

							<div style={{ marginBottom: 20 }}>
								<div
									style={{
										fontSize: 11,
										color: "rgba(29,31,32,.6)",
										marginTop: -16,
									}}
								>
									Strong · at least 8 characters, one number
								</div>
							</div>

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
									Create account
								</Button>
							</Form.Item>
						</Form>

						{/* Divider */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 12,
								margin: "24px 0",
							}}
						>
							<div
								style={{
									flex: 1,
									height: 1,
									background: "rgba(138,39,72,.18)",
								}}
							/>
							<span
								style={{
									fontSize: 12,
									color: "rgba(29,31,32,.5)",
									textTransform: "uppercase",
									fontWeight: 600,
								}}
							>
								Or
							</span>
							<div
								style={{
									flex: 1,
									height: 1,
									background: "rgba(138,39,72,.18)",
								}}
							/>
						</div>

						{/* Google button */}
						{/* <Button
							block
							size="large"
							style={{
								height: 48,
								fontSize: 14,
								fontFamily: "'Barlow Condensed', sans-serif",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: ".05em",
								background: "#fff",
								borderColor: "rgba(138,39,72,.24)",
								color: "#1d1f20",
								border: "1px solid rgba(138,39,72,.24)",
								marginBottom: 24,
							}}
						>
							Continue with Google
						</Button> */}

						{/* Login link */}
						<div
							style={{
								textAlign: "center",
								fontSize: 13,
								color: "rgba(29,31,32,.6)",
							}}
						>
							Already have an account?{" "}
							<Link
								href="/login"
								style={{
									color: "#f43f75",
									fontWeight: 600,
									textDecoration: "none",
								}}
							>
								Log in
							</Link>
						</div>
					</div>
				</section>
			</main>
		</>
	);
}
