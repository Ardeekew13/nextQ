"use client";

import { useState } from "react";
import { Modal } from "antd";

interface FixedPartnerTourProps {
	open: boolean;
	onDone: () => void;
}

const PINK = "#f43f75";
const DARK = "#5c1029";

function Avatar({ x, y, color = PINK }: { x: number; y: number; color?: string }) {
	return (
		<g transform={`translate(${x},${y})`}>
			<circle r="16" fill={color} />
			<circle cy="-4" r="6" fill="#fff" />
			<path d="M -9 10 A 9 9 0 0 1 9 10 L 9 14 L -9 14 Z" fill="#fff" />
		</g>
	);
}

function ChainLink({ x, y }: { x: number; y: number }) {
	return (
		<g transform={`translate(${x},${y})`} stroke={DARK} strokeWidth="3" fill="none" strokeLinecap="round">
			<rect x="-11" y="-6" width="12" height="12" rx="6" transform="rotate(-20)" />
			<rect x="-1" y="-6" width="12" height="12" rx="6" transform="rotate(-20)" />
		</g>
	);
}

function SlideOnePicture() {
	return (
		<svg viewBox="0 0 260 150" width="100%" height="150">
			<rect x="8" y="14" width="244" height="36" rx="8" fill="#fdecf1" />
			<rect x="8" y="58" width="244" height="36" rx="8" fill="#fdecf1" />
			<circle cx="26" cy="32" r="7" fill="none" stroke={PINK} strokeWidth="2.5" />
			<path d="M22 32 l3 3 l6 -7" stroke={PINK} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<circle cx="26" cy="76" r="7" fill="none" stroke={PINK} strokeWidth="2.5" />
			<path d="M22 76 l3 3 l6 -7" stroke={PINK} strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
			<text x="44" y="37" fontSize="12" fontWeight="700" fill="#1d1f20" fontFamily="sans-serif">
				PLAYER A
			</text>
			<text x="44" y="81" fontSize="12" fontWeight="700" fill="#1d1f20" fontFamily="sans-serif">
				PLAYER B
			</text>
			<ChainLink x={236} y={55} />
			<rect x="22" y="110" width="216" height="30" rx="15" fill={DARK} />
			<text x="130" y="129" fontSize="10.5" fontWeight="700" fill="#fff" fontFamily="sans-serif" textAnchor="middle" letterSpacing="0.01em">
				PAIR AS FIXED PARTNERS
			</text>
		</svg>
	);
}

function SlideTwoPicture() {
	return (
		<svg viewBox="0 0 260 150" width="100%" height="150">
			<rect x="20" y="20" width="220" height="110" rx="10" fill="#f3f4f6" />
			<line x1="130" y1="20" x2="130" y2="130" stroke="#d1d5db" strokeWidth="2" strokeDasharray="4 4" />
			<text x="70" y="38" fontSize="10" fontWeight="700" fill="#9ca3af" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">
				TEAM A
			</text>
			<text x="190" y="38" fontSize="10" fontWeight="700" fill="#9ca3af" fontFamily="sans-serif" textAnchor="middle" letterSpacing="1">
				TEAM B
			</text>
			<Avatar x={55} y={85} />
			<Avatar x={90} y={85} />
			<ChainLink x={72} y={60} />
			<Avatar x={175} y={85} color="#9ca3af" />
			<Avatar x={210} y={85} color="#9ca3af" />
		</svg>
	);
}

function SlideThreePicture() {
	return (
		<svg viewBox="0 0 260 150" width="100%" height="150">
			<text x="10" y="20" fontSize="10" fontWeight="700" fill="#9ca3af" fontFamily="sans-serif" letterSpacing="1">
				QUEUE
			</text>
			{[0, 1, 2, 3].map((i) => (
				<rect key={i} x={10 + i * 60} y="30" width="50" height="34" rx="6" fill={i === 3 ? "#fdecf1" : "#f3f4f6"} />
			))}
			<text x="35" y="51" fontSize="11" fontWeight="700" fill="#1d1f20" fontFamily="sans-serif" textAnchor="middle">
				C
			</text>
			<text x="95" y="51" fontSize="11" fontWeight="700" fill="#1d1f20" fontFamily="sans-serif" textAnchor="middle">
				D
			</text>
			<text x="155" y="51" fontSize="11" fontWeight="700" fill="#1d1f20" fontFamily="sans-serif" textAnchor="middle">
				E
			</text>
			<text x="215" y="51" fontSize="11" fontWeight="700" fill={PINK} fontFamily="sans-serif" textAnchor="middle">
				A
			</text>
			<path d="M 40 78 C 40 100, 210 60, 210 82" stroke={PINK} strokeWidth="2" fill="none" strokeDasharray="3 4" markerEnd="url(#arrow)" />
			<defs>
				<marker id="arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
					<path d="M0,0 L8,4 L0,8 Z" fill={PINK} />
				</marker>
			</defs>
			<text x="40" y="100" fontSize="9" fill="#9ca3af" fontFamily="sans-serif" textAnchor="middle">
				would've
			</text>
			<text x="40" y="111" fontSize="9" fill="#9ca3af" fontFamily="sans-serif" textAnchor="middle">
				played 1st
			</text>
			<ChainLink x={247} y={47} />
			<text x="130" y="140" fontSize="10" fontWeight="700" fill={DARK} fontFamily="sans-serif" textAnchor="middle">
				A holds back for B, so they enter together
			</text>
		</svg>
	);
}

const SLIDES = [
	{
		title: "Pair up two players",
		body: "Select any two players in the Players tab and hit “Pair as fixed partners,” or set it from a player's Edit form. They're now linked — you can unpair either one any time from the same menu.",
		picture: SlideOnePicture,
	},
	{
		title: "They always play together",
		body: "Whenever both fixed partners are in the queue, the app keeps them on the same team, every game. Neither one gets matched up against the other, and neither plays a round without the other unless they're sitting out.",
		picture: SlideTwoPicture,
	},
	{
		title: "One rule once the session is live",
		body: "If you pair two players mid-session and one of them was already further ahead in the queue, that player's turn holds back so it lines up with their partner's — that way they still start playing together instead of getting split up.",
		picture: SlideThreePicture,
	},
];

/**
 * One-time, 3-slide walkthrough of the fixed-partner feature. Shown by
 * DashboardShell the first time an organiser logs in after this shipped
 * (driven by User.hasSeenFixedPartnerTour), and marked seen via the
 * markFixedPartnerTourSeen mutation once they finish or skip it.
 */
export function FixedPartnerTour({ open, onDone }: FixedPartnerTourProps) {
	const [index, setIndex] = useState(0);
	const slide = SLIDES[index];
	const isLast = index === SLIDES.length - 1;
	const Picture = slide.picture;

	function reset() {
		setIndex(0);
	}

	return (
		<Modal
			open={open}
			onCancel={() => {
				onDone();
				reset();
			}}
			footer={null}
			centered
			width={440}
			closeIcon={<span className="fpt-skip">Skip</span>}
			styles={{ body: { padding: "28px 30px 26px" }, content: { borderRadius: 16, overflow: "hidden" } }}
		>
			<style>{`
				.fpt-skip {
					font-size: 12px;
					font-weight: 700;
					letter-spacing: 0.04em;
					color: #9ca3af;
					padding: 4px 10px;
					border-radius: 999px;
					transition: background 0.15s, color 0.15s;
				}
				.fpt-skip:hover {
					background: #f3f4f6;
					color: #555;
				}
				.fpt-slide-enter {
					animation: fptFade 0.25s ease;
				}
				@keyframes fptFade {
					from { opacity: 0; transform: translateY(4px); }
					to { opacity: 1; transform: translateY(0); }
				}
				.fpt-btn-back {
					transition: background 0.15s, border-color 0.15s;
				}
				.fpt-btn-back:not(:disabled):hover {
					background: #f9fafb;
					border-color: #d1d5db;
				}
				.fpt-btn-next {
					transition: filter 0.15s, transform 0.1s;
				}
				.fpt-btn-next:hover {
					filter: brightness(1.06);
				}
				.fpt-btn-next:active {
					transform: scale(0.98);
				}
			`}</style>

			<div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
				<span
					style={{
						display: "inline-flex",
						alignItems: "center",
						gap: 6,
						fontSize: 11,
						fontWeight: 800,
						letterSpacing: "0.1em",
						color: PINK,
						textTransform: "uppercase",
						background: "#fdecf1",
						padding: "5px 14px",
						borderRadius: 999,
					}}
				>
					<span style={{ width: 5, height: 5, borderRadius: "50%", background: PINK, display: "inline-block" }} />
					New &middot; Fixed partners
				</span>
			</div>

			<div key={index} className="fpt-slide-enter">
				<div
					style={{
						display: "flex",
						justifyContent: "center",
						alignItems: "center",
						background: "#fafafa",
						border: "1px solid #f0f0f0",
						borderRadius: 12,
						padding: "10px 8px",
						marginBottom: 20,
					}}
				>
					<Picture />
				</div>
				<h3 style={{ textAlign: "center", margin: "0 0 10px", fontSize: 19, fontWeight: 700, color: "#1d1f20" }}>{slide.title}</h3>
				<p style={{ textAlign: "center", color: "#666", fontSize: 14, lineHeight: 1.6, margin: "0 0 24px" }}>{slide.body}</p>
			</div>

			<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 22 }}>
				{SLIDES.map((_, i) => (
					<span
						key={i}
						style={{
							width: i === index ? 20 : 6,
							height: 6,
							borderRadius: 3,
							background: i === index ? PINK : "#e5e7eb",
							transition: "all 0.2s",
						}}
					/>
				))}
				<span style={{ marginLeft: 8, fontSize: 12, color: "#aaa", fontWeight: 600 }}>
					{index + 1} / {SLIDES.length}
				</span>
			</div>

			<div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
				<button
					className="fpt-btn-back"
					onClick={() => setIndex((i) => Math.max(0, i - 1))}
					disabled={index === 0}
					style={{
						flex: 1,
						padding: "12px 0",
						borderRadius: 10,
						border: "1px solid #e5e7eb",
						background: "#fff",
						color: index === 0 ? "#d4d4d4" : "#555",
						fontWeight: 600,
						fontSize: 14,
						cursor: index === 0 ? "default" : "pointer",
					}}
				>
					Back
				</button>
				<button
					className="fpt-btn-next"
					onClick={() => {
						if (isLast) {
							onDone();
							reset();
						} else {
							setIndex((i) => Math.min(SLIDES.length - 1, i + 1));
						}
					}}
					style={{
						flex: 1.4,
						padding: "12px 0",
						borderRadius: 10,
						border: "none",
						background: PINK,
						color: "#fff",
						fontWeight: 700,
						fontSize: 14,
						cursor: "pointer",
						boxShadow: "0 4px 12px rgba(244,63,117,0.28)",
					}}
				>
					{isLast ? "Got it, thanks!" : "Next"}
				</button>
			</div>
		</Modal>
	);
}
