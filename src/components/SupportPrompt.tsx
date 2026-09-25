"use client";

import { Modal } from "antd";

interface SupportPromptProps {
	open: boolean;
	onClose: () => void;
	variant: "mid" | "end";
}

const COPY: Record<SupportPromptProps["variant"], { title: string; body: string }> = {
	mid: {
		title: "Enjoying the session so far?",
		body: "Glad it's going well! NextQ is a side project one person builds and maintains — if it's making your sessions easier to run, a small tip is always appreciated (and totally optional).",
	},
	end: {
		title: "Session's done — how'd it go?",
		body: "Thanks for running your session on NextQ! If it helped you out today, you can support the developer with a small tip below. No pressure either way.",
	},
};

/**
 * Soft, dismissible "support the developer" prompt. Shown once per session
 * per device at two points: mid-session (after a game-count milestone) and
 * end-of-session (right after the organiser finishes the session). Purely a
 * QR code today — no in-app payment processing, nothing tracked server-side.
 */
export function SupportPrompt({ open, onClose, variant }: SupportPromptProps) {
	const copy = COPY[variant];
	return (
		<Modal open={open} onCancel={onClose} footer={null} centered title={copy.title} width={620}>
			<p style={{ marginTop: 0, marginBottom: 16, color: "#555", fontSize: 14, lineHeight: 1.5 }}>{copy.body}</p>
			<div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
				{/* eslint-disable-next-line @next/next/no-img-element */}
				<img
					src="/support-qr.png"
					alt="Scan to support the developer"
					style={{ width: 380, maxWidth: "100%", borderRadius: 8, border: "1px solid #eee" }}
				/>
			</div>
			<p style={{ textAlign: "center", color: "#999", fontSize: 12, marginBottom: 20 }}>
				Scan with your banking or InstaPay-enabled app.
			</p>
			<div style={{ textAlign: "center" }}>
				<button
					onClick={onClose}
					style={{
						background: "none",
						border: "none",
						color: "#999",
						cursor: "pointer",
						fontSize: 13,
						textDecoration: "underline",
						padding: 4,
					}}
				>
					Maybe later
				</button>
			</div>
		</Modal>
	);
}
