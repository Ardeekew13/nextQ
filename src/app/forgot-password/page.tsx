"use client";

import { REQUEST_PASSWORD_RESET } from "@/graphql/documents/organiser";
import { useMutation } from "@apollo/client";
import { App, Button, Form, Input } from "antd";
import Link from "next/link";
import { useState } from "react";
import { AppLogo } from "@/components/AppLogo";

export default function ForgotPasswordPage() {
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState(false);
	const [requestPasswordReset] = useMutation(REQUEST_PASSWORD_RESET);
	const [form] = Form.useForm();

	async function onFinish(values: { email: string }) {
		setLoading(true);
		try {
			await requestPasswordReset({ variables: values });
			setSent(true);
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Something went wrong",
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
				* { border-radius: 0 !important; }
				body {
					background-color: #faf7f8;
					font-family: 'Barlow', system-ui, sans-serif;
					margin: 0;
					padding: 0;
				}
				h1, h2, h3, h4, h5, h6 {
					font-family: 'Barlow Condensed', sans-serif;
					font-weight: 600;
					text-transform: uppercase;
				}
				.fp-card { border-radius: 4px !important; }
			`,
				}}
			/>

			<main
				style={{
					minHeight: "100vh",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					padding: 24,
				}}
			>
				<div
					className="fp-card"
					style={{
						width: "100%",
						maxWidth: 420,
						background: "#fff",
						padding: "48px 40px",
						boxShadow: "0 12px 32px rgba(92,16,41,.10)",
					}}
				>
					<div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
						<AppLogo size="md" />
					</div>

					{!sent ? (
						<>
							<h2
								style={{
									fontSize: 28,
									lineHeight: 1,
									margin: "0 0 12px",
									color: "#1d1f20",
									textAlign: "center",
								}}
							>
								Forgot your password?
							</h2>
							<p
								style={{
									fontSize: 14,
									color: "rgba(29,31,32,.6)",
									margin: "0 0 28px",
									lineHeight: 1.5,
									textAlign: "center",
								}}
							>
								Enter the email on your account and we'll send you a link to
								reset it.
							</p>

							<Form
								form={form}
								layout="vertical"
								onFinish={onFinish}
								requiredMark={false}
							>
								<Form.Item
									label={
										<span style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}>
											Email
										</span>
									}
									name="email"
									rules={[
										{ required: true, type: "email", message: "Enter a valid email" },
									]}
								>
									<Input
										size="large"
										placeholder="you@club.ph"
										autoComplete="email"
										style={{ padding: "10px 12px", fontSize: 14 }}
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
										Send reset link
									</Button>
								</Form.Item>
							</Form>
						</>
					) : (
						<>
							<h2
								style={{
									fontSize: 24,
									lineHeight: 1.3,
									margin: "0 0 12px",
									color: "#1d1f20",
									textAlign: "center",
									textTransform: "none",
								}}
							>
								Check your email
							</h2>
							<p
								style={{
									fontSize: 14,
									color: "rgba(29,31,32,.6)",
									margin: "0 0 4px",
									lineHeight: 1.5,
									textAlign: "center",
								}}
							>
								If an account exists for that email, we've sent a link to reset
								your password. It expires in 1 hour.
							</p>
						</>
					)}

					<div
						style={{
							textAlign: "center",
							fontSize: 13,
							color: "rgba(29,31,32,.6)",
							marginTop: 24,
						}}
					>
						<Link
							href="/login"
							style={{ color: "#f43f75", fontWeight: 600, textDecoration: "none" }}
						>
							Back to log in
						</Link>
					</div>
				</div>
			</main>
		</>
	);
}
