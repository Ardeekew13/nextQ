"use client";

import Link from "next/link";
import { Button } from "antd";
import { UserPlus, AlignLeft, BarChart3, Share2 } from "lucide-react";
import { AppLogo } from "@/components/AppLogo";

const FEATURES = [
	{
		icon: UserPlus,
		title: "Random matchmaking",
		desc: "Fair partner and opponent rotation so everyone plays with everyone.",
	},
	{
		icon: AlignLeft,
		title: "Instant court queuing",
		desc: "Games auto-fill courts the moment a slot opens. No clipboard needed.",
	},
	{
		icon: BarChart3,
		title: "Live standings",
		desc: "Win/loss rankings update in real time throughout the session.",
	},
	{
		icon: Share2,
		title: "Shareable results",
		desc: "One public link lets players follow results on their own phone.",
	},
];

export default function HomeContent() {
	return (
		<>
			<style
				dangerouslySetInnerHTML={{
					__html: `
        * {
          border-radius: 0 !important;
        }

        @keyframes nq-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        body {
          background-color: #ffffff;
          font-family: 'Barlow', system-ui, sans-serif;
          margin: 0;
          padding: 0;
        }

        .barlow-condensed {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 600;
        }

        .nav-link {
          font-size: 13px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: #1d1f20;
          text-decoration: none;
          cursor: pointer;
          line-height: 1;
        }

        .nav-link-login {
          color: #8d1a3f;
        }

        .pulse-dot {
          animation: nq-pulse 1.6s infinite;
        }

        h1, h2, h3, h4, h5, h6 {
          font-family: 'Barlow Condensed', sans-serif;
          font-weight: 600;
          text-transform: uppercase;
        }

        @media (max-width: 768px) {
          nav {
            padding: 12px 16px !important;
          }

          .nav-links {
            display: none !important;
          }

          .hero-section {
            grid-template-columns: 1fr !important;
            border-bottom: 1px solid rgba(138,39,72,.24) !important;
          }

          .hero-left {
            padding: 32px 16px !important;
            border-left: none !important;
          }

          .hero-right {
            padding: 24px 16px !important;
            border-left: none !important;
            border-top: 1px solid rgba(138,39,72,.24) !important;
          }

          .hero-h1 {
            font-size: 36px !important;
            line-height: 1.1 !important;
          }

          .hero-p {
            font-size: 14px !important;
          }

          .hero-buttons {
            flex-wrap: wrap !important;
          }

          .hero-buttons button {
            font-size: 14px !important;
            height: 44px !important;
          }

          .proof-points {
            flex-wrap: wrap !important;
            gap: 16px !important;
          }

          .how-it-works-section {
            margin-top: 32px !important;
            margin-left: 16px !important;
            margin-right: 16px !important;
          }

          .how-it-works-grid {
            grid-template-columns: 1fr !important;
          }

          .step-item {
            border-right: none !important;
            border-bottom: 1px solid rgba(138,39,72,.24) !important;
            padding: 16px !important;
          }

          .step-item:last-child {
            border-bottom: none !important;
          }

          .step-number {
            font-size: 28px !important;
          }

          .step-title {
            font-size: 18px !important;
          }

          .features-section {
            margin-top: 32px !important;
            margin-left: 16px !important;
            margin-right: 16px !important;
          }

          .features-h2 {
            font-size: 28px !important;
          }

          .features-p {
            font-size: 14px !important;
          }

          .features-grid {
            grid-template-columns: 1fr !important;
          }

          .feature-item {
            border-right: none !important;
            border-bottom: 1px solid rgba(138,39,72,.24) !important;
            padding: 16px !important;
          }

          .feature-item:last-child {
            border-bottom: none !important;
          }

          .feature-title {
            font-size: 16px !important;
          }

          .feature-desc {
            font-size: 12px !important;
          }

          .cta-section {
            margin-top: 32px !important;
            padding: 28px 16px !important;
            flex-direction: column !important;
            gap: 16px !important;
            text-align: center !important;
          }

          .cta-h2 {
            font-size: 28px !important;
            margin-bottom: 8px !important;
          }

          .cta-buttons {
            flex-direction: column !important;
            width: 100% !important;
          }

          .cta-buttons button {
            width: 100% !important;
            height: 44px !important;
            font-size: 14px !important;
          }

          footer {
            flex-direction: column !important;
            gap: 12px !important;
            padding: 16px !important;
            text-align: center !important;
          }

          .footer-left {
            flex-direction: column !important;
            gap: 8px !important;
          }

          .footer-links {
            flex-direction: column !important;
            gap: 8px !important;
          }
        }
      `,
				}}
			/>

			<div style={{ background: "#ffffff" }}>
				{/* ── Nav ── */}
				<nav
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						padding: "14px 48px",
						borderBottom: "1px solid rgba(138,39,72,.24)",
					}}
				>
					<AppLogo size="sm" />

					<div className="nav-links" style={{ display: "flex", alignItems: "center", gap: "26px" }}>
						
						<div
							style={{
								width: "1px",
								height: "22px",
								background: "rgba(138,39,72,.24)",
							}}
						/>

						<Link href="/login" style={{ textDecoration: "none" }}>
							<span className="nav-link nav-link-login">Log in</span>
						</Link>

						<Link href="/register" style={{ textDecoration: "none" }}>
							<Button
								style={{
									height: "38px",
									padding: "0 18px",
									fontSize: "14px",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									textTransform: "uppercase",
									letterSpacing: ".05em",
									background: "#f43f75",
									borderColor: "#f43f75",
									color: "#fff",
									border: "none",
								}}
							>
								Start free
							</Button>
						</Link>
					</div>
				</nav>

				{/* ── Hero ── */}
				<section
					className="hero-section"
					style={{
						display: "grid",
						gridTemplateColumns: "1.3fr 0.7fr",
						borderBottom: "1px solid rgba(138,39,72,.24)",
					}}
				>
					{/* Left */}
					<div
						className="hero-left"
						style={{
							padding: "64px 48px",
							display: "flex",
							flexDirection: "column",
							gap: "22px",
						}}
					>
						{/* Badge */}
						<div
							style={{
								display: "inline-block",
								width: "fit-content",
								border: "1px solid #bd2153",
								background: "#fff1f5",
								padding: "5px 11px",
								fontSize: "10px",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: ".2em",
								color: "#bd2153",
							}}
						>
							Built for pickleball open play
						</div>

						{/* H1 */}
						<h1
							className="hero-h1"
							style={{
								fontSize: "76px",
								lineHeight: "0.92",
								margin: 0,
								color: "#1d1f20",
								textWrap: "balance",
							}}
						>
							Run your session.
							<br />
							<span style={{ color: "#f43f75" }}>Not your clipboard.</span>
						</h1>

						{/* Sub */}
						<p
							className="hero-p"
							style={{
								fontSize: "17px",
								lineHeight: "1.5",
								color: "rgba(29,31,32,.65)",
								maxWidth: "44ch",
								margin: 0,
								textWrap: "pretty",
							}}
						>
							NextQ draws fair matchups, keeps the court queue moving and posts
							standings as games finish. You put the paddle down and play.
						</p>

						{/* Buttons */}
						<div
							className="hero-buttons"
							style={{
								display: "flex",
								gap: "12px",
								marginTop: "6px",
							}}
						>
							<Link href="/register" style={{ textDecoration: "none" }}>
								<Button
									style={{
										height: "50px",
										padding: "0 28px",
										fontSize: "16px",
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
									Start free
								</Button>
							</Link>
							<Button
								style={{
									height: "50px",
									padding: "0 22px",
									fontSize: "15px",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									textTransform: "uppercase",
									background: "#fff",
									borderColor: "rgba(138,39,72,.24)",
									color: "#1d1f20",
									border: "1px solid rgba(138,39,72,.24)",
								}}
							>
								See a live session
							</Button>
						</div>

						{/* Proof points */}
						<div
							className="proof-points"
							style={{
								marginTop: "10px",
								paddingTop: "20px",
								borderTop: "1px solid rgba(138,39,72,.24)",
								display: "flex",
								gap: "26px",
							}}
						>
							<div>
								<div
									style={{
										fontSize: "22px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										color: "#1d1f20",
										margin: "0 0 4px",
										lineHeight: "1",
									}}
								>
									2 min
								</div>
								<div
									style={{
										fontSize: "12px",
										color: "rgba(29,31,32,.6)",
										fontWeight: 500,
									}}
								>
									to set up a session
								</div>
							</div>
							<div>
								<div
									style={{
										fontSize: "22px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										color: "#1d1f20",
										margin: "0 0 4px",
										lineHeight: "1",
									}}
								>
									No app
								</div>
								<div
									style={{
										fontSize: "12px",
										color: "rgba(29,31,32,.6)",
										fontWeight: 500,
									}}
								>
									players scan a QR
								</div>
							</div>
							<div>
								<div
									style={{
										fontSize: "22px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										color: "#1d1f20",
										margin: "0 0 4px",
										lineHeight: "1",
									}}
								>
									Free
								</div>
								<div
									style={{
										fontSize: "12px",
										color: "rgba(29,31,32,.6)",
										fontWeight: 500,
									}}
								>
									no card required
								</div>
							</div>
						</div>
					</div>

					{/* Right - Product */}
					<div
						className="hero-right"
						style={{
							padding: "48px 40px",
							background: "#5c1029",
							display: "flex",
							flexDirection: "column",
							gap: "18px",
							borderLeft: "1px solid rgba(138,39,72,.24)",
						}}
					>
						{/* Section kicker */}
						<div
							style={{
								fontSize: "10px",
								fontFamily: "'Barlow Condensed', sans-serif",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: ".2em",
								color: "#ffb9cd",
							}}
						>
							Live · Wednesday open play
						</div>

						{/* Court Card */}
						<div
							style={{
								background: "#fff",
								border: "1px solid rgba(138,39,72,.24)",
							}}
						>
							{/* Header */}
							<div
								style={{
									padding: "14px 20px",
									background: "#fff1f5",
									borderBottom: "1px solid rgba(138,39,72,.24)",
									display: "flex",
									alignItems: "center",
									justifyContent: "space-between",
								}}
							>
								<div
									style={{
										display: "flex",
										alignItems: "center",
										gap: "10px",
									}}
								>
									<span
										style={{
											fontSize: "13px",
											fontFamily: "'Barlow Condensed', sans-serif",
											fontWeight: 600,
											textTransform: "uppercase",
											color: "#1d1f20",
										}}
									>
										Court 1
									</span>
									<div
										className="pulse-dot"
										style={{
											width: "8px",
											height: "8px",
											background: "#f43f75",
										}}
									/>
									<span
										style={{
											fontSize: "11px",
											fontFamily: "'Barlow Condensed', sans-serif",
											fontWeight: 600,
											textTransform: "uppercase",
											letterSpacing: ".1em",
											color: "#8d1a3f",
										}}
									>
										Live
									</span>
								</div>
								<div
									style={{
										fontSize: "16px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										color: "#8d1a3f",
									}}
								>
									8:14
								</div>
							</div>

							{/* Matchup */}
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "1fr auto 1fr",
									gap: "20px",
									padding: "20px 20px",
								}}
							>
								<div
									style={{
										fontSize: "15px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										color: "#1d1f20",
										display: "flex",
										flexDirection: "column",
										gap: "3px",
									}}
								>
									M. Santos
									<br />
									J. Lim
								</div>
								<div
									style={{
										fontSize: "12px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										letterSpacing: ".1em",
										color: "rgba(29,31,32,.35)",
										display: "flex",
										alignItems: "center",
									}}
								>
									VS
								</div>
								<div
									style={{
										textAlign: "right",
										fontSize: "15px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										color: "#1d1f20",
										display: "flex",
										flexDirection: "column",
										gap: "3px",
									}}
								>
									A. Dizon
									<br />
									R. Ocampo
								</div>
							</div>

							{/* Buttons */}
							<div
								style={{
									padding: "0 20px 18px",
									display: "flex",
									gap: "10px",
								}}
							>
								<Button
									style={{
										flex: 1,
										height: "40px",
										fontSize: "12px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										letterSpacing: ".05em",
										background: "#f43f75",
										borderColor: "#f43f75",
										color: "#fff",
										border: "none",
									}}
								>
									Team A won
								</Button>
								<Button
									style={{
										flex: 1,
										height: "40px",
										fontSize: "12px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										background: "#fff",
										borderColor: "#e5e7eb",
										color: "#1d1f20",
										border: "1px solid #e5e7eb",
									}}
								>
									Team B won
								</Button>
							</div>
						</div>

						{/* Up next */}
						<div
							style={{
								background: "rgba(255,255,255,.08)",
								border: "1px solid rgba(138,39,72,.24)",
								padding: "16px 20px",
								display: "flex",
								flexDirection: "column",
								gap: "10px",
							}}
						>
							<div
								style={{
									fontSize: "10px",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									textTransform: "uppercase",
									letterSpacing: ".1em",
									color: "#ffb9cd",
								}}
							>
								Up next · Random draw
							</div>
							<div
								style={{
									fontSize: "14px",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									textTransform: "uppercase",
									color: "#fff",
									lineHeight: "1.4",
								}}
							>
								K. UT · T. BAUTISTA · L. YAP · C. MENDOZA
							</div>
							<div
								style={{
									fontSize: "12px",
									color: "rgba(255,255,255,.65)",
								}}
							>
								10 waiting · longest wait 11 min
							</div>
						</div>
					</div>
				</section>

				{/* ── How it works ── */}
				<section
					className="how-it-works-section"
					style={{
						marginTop: "56px",
						marginLeft: "48px",
						marginRight: "48px",
						paddingBottom: "0",
					}}
				>
					<div style={{ marginBottom: "8px" }}>
						<span
							style={{
								fontSize: "10px",
								fontFamily: "'Barlow Condensed', sans-serif",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: ".2em",
								color: "#bd2153",
							}}
						>
							How it works
						</span>
					</div>
					<h2
						style={{
							fontSize: "44px",
							lineHeight: "1",
							margin: "0 0 26px",
							color: "#1d1f20",
						}}
					>
						Three steps to a running session
					</h2>

					<div
						className="how-it-works-grid"
						style={{
							border: "1px solid rgba(138,39,72,.24)",
							display: "grid",
							gridTemplateColumns: "repeat(3, 1fr)",
						}}
					>
						{[
							{
								num: "01",
								title: "Set the session",
								desc: "Name it, pick courts and a queue mode. Takes under two minutes.",
							},
							{
								num: "02",
								title: "Players scan in",
								desc: "One QR at the gate drops everyone into the pool. No app to install.",
							},
							{
								num: "03",
								title: "Tap the winner",
								desc: "NextQ draws the next four and updates standings. That's the whole job.",
							},
						].map((step, idx) => (
							<div
								key={step.num}
								className="step-item"
								style={{
									padding: "26px 28px",
									display: "flex",
									flexDirection: "column",
									gap: "8px",
									borderRight:
										idx < 2 ? "1px solid rgba(138,39,72,.24)" : "none",
								}}
							>
								<div
									className="step-number"
									style={{
										fontSize: "34px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										color: "#ffb9cd",
										lineHeight: "1",
									}}
								>
									{step.num}
								</div>
								<div
									className="step-title"
									style={{
										fontSize: "21px",
										fontFamily: "'Barlow Condensed', sans-serif",
										fontWeight: 600,
										textTransform: "uppercase",
										color: "#1d1f20",
										lineHeight: "1.1",
									}}
								>
									{step.title}
								</div>
								<p
									style={{
										fontSize: "13.5px",
										lineHeight: "1.5",
										color: "rgba(29,31,32,.65)",
										margin: 0,
										textWrap: "pretty",
									}}
								>
									{step.desc}
								</p>
							</div>
						))}
					</div>
				</section>

				{/* ── Features ── */}
				<section
					className="features-section"
					style={{
						marginTop: "56px",
						marginLeft: "48px",
						marginRight: "48px",
					}}
				>
					<div style={{ marginBottom: "8px" }}>
						<span
							style={{
								fontSize: "10px",
								fontFamily: "'Barlow Condensed', sans-serif",
								fontWeight: 600,
								textTransform: "uppercase",
								letterSpacing: ".2em",
								color: "#bd2153",
							}}
						>
							Features
						</span>
					</div>
					<h2
						className="features-h2"
						style={{
							fontSize: "44px",
							lineHeight: "1",
							margin: "0 0 12px",
							color: "#1d1f20",
						}}
					>
						Everything you need courtside
					</h2>
					<p
						className="features-p"
						style={{
							fontSize: "15px",
							lineHeight: "1.5",
							color: "rgba(29,31,32,.6)",
							margin: "0 0 26px",
							textWrap: "pretty",
						}}
					>
						No spreadsheets. No arguments. Just fair games.
					</p>

					<div
						className="features-grid"
						style={{
							border: "1px solid rgba(138,39,72,.24)",
							display: "grid",
							gridTemplateColumns: "repeat(4, 1fr)",
						}}
					>
						{FEATURES.map((f, idx) => {
							const Icon = f.icon;
							return (
								<div
									key={f.title}
									className="feature-item"
									style={{
										padding: "24px 22px",
										display: "flex",
										flexDirection: "column",
										gap: "11px",
										borderRight:
											idx < 3 ? "1px solid rgba(138,39,72,.24)" : "none",
									}}
								>
									<Icon
										size={22}
										strokeWidth={1.5}
										style={{ color: "#f43f75" }}
									/>
									<div
										className="feature-title"
										style={{
											fontSize: "19px",
											fontFamily: "'Barlow Condensed', sans-serif",
											fontWeight: 600,
											textTransform: "uppercase",
											color: "#1d1f20",
											lineHeight: "1.1",
										}}
									>
										{f.title}
									</div>
									<p
										className="feature-desc"
										style={{
											fontSize: "13px",
											lineHeight: "1.5",
											color: "rgba(29,31,32,.65)",
											margin: 0,
											textWrap: "pretty",
										}}
									>
										{f.desc}
									</p>
								</div>
							);
						})}
					</div>
				</section>

				{/* ── CTA ── */}
				<section
					className="cta-section"
					style={{
						marginTop: "56px",
						background: "#5c1029",
						padding: "52px 48px",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div>
						<h2
							className="cta-h2"
							style={{
								fontSize: "44px",
								lineHeight: "1",
								margin: "0 0 8px",
								color: "#fff",
							}}
						>
							Ready to run your next open play?
						</h2>
						<p
							style={{
								fontSize: "16px",
								color: "rgba(255,255,255,.7)",
								margin: 0,
								textWrap: "pretty",
							}}
						>
							Free to use. No credit card required.
						</p>
					</div>

					<div className="cta-buttons" style={{ display: "flex", gap: "12px" }}>
						<Link href="/register" style={{ textDecoration: "none" }}>
							<Button
								style={{
									height: "52px",
									padding: "0 30px",
									fontSize: "16px",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									textTransform: "uppercase",
									letterSpacing: ".06em",
									background: "#fff",
									borderColor: "#fff",
									color: "#5c1029",
									border: "1px solid #fff",
								}}
							>
								Create your organizer account
							</Button>
						</Link>
						<Link href="/login" style={{ textDecoration: "none" }}>
							<Button
								style={{
									height: "52px",
									padding: "0 22px",
									fontSize: "15px",
									fontFamily: "'Barlow Condensed', sans-serif",
									fontWeight: 600,
									textTransform: "uppercase",
									background: "transparent",
									borderColor: "rgba(255,255,255,.4)",
									color: "#fff",
									border: "1px solid rgba(255,255,255,.4)",
								}}
							>
								Log in
							</Button>
						</Link>
					</div>
				</section>

				{/* ── Footer ── */}
				<footer
					style={{
						padding: "22px 48px",
						borderTop: "1px solid rgba(138,39,72,.24)",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
					}}
				>
					<div className="footer-left" style={{ display: "flex", alignItems: "center", gap: "20px" }}>
						<div style={{ opacity: 0.6, height: 24 }}>
							<AppLogo size="sm" />
						</div>
						<span
							style={{
								fontSize: "12px",
								color: "rgba(29,31,32,.5)",
							}}
						>
							© <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
							NextQ · Built for pickleball open play
						</span>
					</div>

					<div className="footer-links" style={{ display: "flex", gap: "20px" }}>
						<a
							style={{
								fontSize: "12px",
								fontWeight: 600,
								color: "rgba(29,31,32,.6)",
								textDecoration: "none",
								cursor: "pointer",
							}}
						>
							Privacy
						</a>
						<a
							style={{
								fontSize: "12px",
								fontWeight: 600,
								color: "rgba(29,31,32,.6)",
								textDecoration: "none",
								cursor: "pointer",
							}}
						>
							Terms
						</a>
						<a
							style={{
								fontSize: "12px",
								fontWeight: 600,
								color: "rgba(29,31,32,.6)",
								textDecoration: "none",
								cursor: "pointer",
							}}
						>
							Contact
						</a>
					</div>
				</footer>
			</div>
		</>
	);
}
