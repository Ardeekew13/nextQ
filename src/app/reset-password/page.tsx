"use client";

import { RESET_PASSWORD } from "@/graphql/documents/organiser";
import { useMutation } from "@apollo/client";
import { App, Button, Form, Input } from "antd";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { AppLogo } from "@/components/AppLogo";

function ResetPasswordForm() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const token = searchParams.get("token");
	const { message } = App.useApp();
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);
	const [resetPassword] = useMutation(RESET_PASSWORD);
	const [form] = Form.useForm();

	async function onFinish(values: { newPassword: string }) {
		if (!token) return;
		setLoading(true);
		try {
			await resetPassword({ variables: { token, newPassword: values.newPassword } });
			setDone(true);
			message.success("Password updated");
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Could not reset password",
			);
		} finally {
			setLoading(false);
		}
	}

	const card = (children: React.ReactNode) => (
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
				{children}
			</div>
		</main>
	);

	if (!token) {
		return card(
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
					Invalid reset link
				</h2>
				<p
					style={{
						fontSize: 14,
						color: "rgba(29,31,32,.6)",
						margin: "0 0 24px",
						lineHeight: 1.5,
						textAlign: "center",
					}}
				>
					This link is missing its token. Request a new one below.
				</p>
				<div style={{ textAlign: "center" }}>
					<Link
						href="/forgot-password"
						style={{ color: "#f43f75", fontWeight: 600, textDecoration: "none" }}
					>
						Request a new link
					</Link>
				</div>
			</>,
		);
	}

	if (done) {
		return card(
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
					Password updated
				</h2>
				<p
					style={{
						fontSize: 14,
						color: "rgba(29,31,32,.6)",
						margin: "0 0 24px",
						lineHeight: 1.5,
						textAlign: "center",
					}}
				>
					You can log in with your new password now.
				</p>
				<Button
					type="primary"
					size="large"
					block
					onClick={() => router.push("/login")}
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
					Go to log in
				</Button>
			</>,
		);
	}

	return card(
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
				Set a new password
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
				Choose a new password for your account.
			</p>

			<Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
				<Form.Item
					label={
						<span style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}>
							New password
						</span>
					}
					name="newPassword"
					rules={[
						{ required: true, message: "Enter a new password" },
						{ min: 12, message: "At least 12 characters" },
						{
							pattern: /[A-Z]/,
							message: "Include at least one uppercase letter",
						},
						{ pattern: /[0-9]/, message: "Include at least one number" },
						{
							pattern: /[!@#$%^&*]/,
							message: "Include one special character (!@#$%^&*)",
						},
					]}
					hasFeedback
				>
					<Input.Password
						size="large"
						autoComplete="new-password"
						style={{ padding: "10px 12px", fontSize: 14 }}
					/>
				</Form.Item>

				<Form.Item
					label={
						<span style={{ fontSize: 13, fontWeight: 600, color: "#1d1f20" }}>
							Confirm new password
						</span>
					}
					name="confirmPassword"
					dependencies={["newPassword"]}
					rules={[
						{ required: true, message: "Confirm your new password" },
						({ getFieldValue }) => ({
							validator(_, value) {
								if (!value || getFieldValue("newPassword") === value) {
									return Promise.resolve();
								}
								return Promise.reject(new Error("Passwords don't match"));
							},
						}),
					]}
				>
					<Input.Password
						size="large"
						autoComplete="new-password"
						style={{ padding: "10px 12px", fontSize: 14 }}
					/>
				</Form.Item>

				<div style={{ fontSize: 11, color: "rgba(29,31,32,.6)", marginBottom: 20, marginTop: -8 }}>
					At least 12 characters, with an uppercase letter, a number, and a
					special character (!@#$%^&*).
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
						Update password
					</Button>
				</Form.Item>
			</Form>
		</>,
	);
}

export default function ResetPasswordPage() {
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
			`,
				}}
			/>
			<Suspense fallback={null}>
				<ResetPasswordForm />
			</Suspense>
		</>
	);
}
