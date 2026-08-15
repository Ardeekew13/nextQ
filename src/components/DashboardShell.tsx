"use client";

import { type ReactNode, useState } from "react";
import { usePathname } from "next/navigation";
import { Layout } from "antd";
import { Sidebar } from "./Layout/Sidebar";
import { Navbar } from "./Navbar";
import {
	NavbarActionsProvider,
	useNavbarActions,
} from "./NavbarActionsContext";

const { Content } = Layout;

function initials(name: string) {
	return name
		.split(" ")
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase())
		.join("");
}

export function DashboardShell({
	organiserName,
	children,
}: {
	organiserName: string;
	children: ReactNode;
}) {
	return (
		<NavbarActionsProvider>
			<DashboardShellInner organiserName={organiserName}>
				{children}
			</DashboardShellInner>
		</NavbarActionsProvider>
	);
}

function DashboardShellInner({
	organiserName,
	children,
}: {
	organiserName: string;
	children: ReactNode;
}) {
	const [sidebarOpen, setSidebarOpen] = useState(true);
	const pathname = usePathname();
	const { actions, title } = useNavbarActions();

	const isSessionPage = /\/dashboard\/sessions\/[^/]+/.test(pathname ?? "");
	const isNewSessionPage = /\/(dashboard\/)?clubs\/[^/]+\/sessions\/new/.test(pathname ?? "");
	const isClubPage = /\/dashboard\/clubs\/[^/]+(?!\/sessions\/new)/.test(pathname ?? "");
	const isFullHeight = isSessionPage || isNewSessionPage;
	const hideSidebar = isSessionPage || isClubPage;

	const selectedKey = pathname?.startsWith("/clubs")
		? "clubs"
		: "dashboard";

	return (
		<>
			<style>{`
				.dashboard-layout {
					transition: margin-left 0.3s ease;
				}
				.dashboard-layout.is-session-page {
					margin-left: 0 !important;
				}
				/* Mobile sidebar - default hidden */
				.sidebar {
					transform: translateX(-100%) !important;
				}
				/* Desktop sidebar - hidden by default on mobile */
				.desktop-sidebar {
					width: 0 !important;
					height: 0 !important;
					overflow: hidden !important;
					position: fixed !important;
					visibility: hidden !important;
				}
				.sidebar-toggle-btn {
					display: none !important;
				}
				@media (min-width: 1024px) {
					/* Desktop: show sidebar and button */
					.desktop-sidebar {
						width: 236px !important;
						height: 100vh !important;
						overflow: visible !important;
						visibility: visible !important;
					}
					.sidebar-toggle-btn {
						display: inline-flex !important;
					}
					.dashboard-layout {
						margin-left: 236px !important;
					}
					/* Hide mobile sidebar on desktop */
					.sidebar {
						display: none !important;
					}
				}
				@media (max-width: 1023px) {
					.dashboard-layout {
						margin-left: 0 !important;
					}
					/* Show mobile sidebar overlay on mobile */
					.sidebar {
						display: block !important;
					}
				}
			`}</style>
			<Layout style={{ minHeight: "100vh", display: "flex", position: "relative" }}>
			{!hideSidebar && (
				<>
					{/* Mobile sidebar overlay */}
					{sidebarOpen && (
						<div
							style={{
								position: "fixed",
								inset: 0,
								background: "rgba(0,0,0,0.5)",
								zIndex: 998,
								display: "none",
							}}
							className="hidden-tablet"
							onClick={() => setSidebarOpen(false)}
						/>
					)}
					{/* Sidebar - responsive positioning */}
					<div
						style={{
							position: "fixed",
							left: 0,
							top: 0,
							bottom: 0,
							width: 236,
							zIndex: 999,
							height: "100vh",
							transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
							transition: "transform 0.3s ease",
							display: isSessionPage ? "none" : undefined,
						}}
						className="sidebar"
					>
						<Sidebar
							selectedKey={selectedKey}
							onSelect={(key) => {
								setSidebarOpen(false);
								if (key === "dashboard") {
									window.location.href = "/dashboard";
								} else if (key === "clubs") {
									window.location.href = "/clubs";
								}
							}}
							userInitials={initials(organiserName)}
							userName={organiserName}
							clubCode="BPC"
						/>
					</div>
					{/* Desktop sidebar - toggleable */}
					<div
						className="desktop-sidebar"
						style={{
							position: "fixed",
							left: 0,
							top: 0,
							bottom: 0,
							width: 236,
							zIndex: 10,
							height: "100vh",
							opacity: sidebarOpen ? 1 : 0,
							pointerEvents: sidebarOpen ? "auto" : "none",
							transition: "opacity 0.3s ease",
						}}
					>
						<Sidebar
							selectedKey={selectedKey}
							onSelect={(key) => {
								if (key === "dashboard") {
									window.location.href = "/dashboard";
								} else if (key === "clubs") {
									window.location.href = "/clubs";
								}
							}}
							userInitials={initials(organiserName)}
							userName={organiserName}
							clubCode="BPC"
						/>
					</div>
				</>
			)}
			<Layout
				className={`dashboard-layout${hideSidebar ? " is-session-page" : ""}`}
				style={{
					marginLeft: isSessionPage ? 0 : (sidebarOpen ? 236 : 0),
					flex: 1,
					display: "flex",
					flexDirection: "column",
				} as React.CSSProperties & { '--sidebar-margin'?: string }}
			>
				{!hideSidebar && (
					<Navbar
						actions={actions}
						title={title}
						hasSidebar={!hideSidebar}
					/>
				)}
				<Content
					style={{
						padding: isFullHeight ? 0 : "16px",
						maxWidth: "100%",
						width: "100%",
						flex: 1,
						overflow: isFullHeight ? "hidden" : "auto",
						background: isSessionPage || isClubPage ? "#fff" : "#f7eef1",
						display: isFullHeight ? "flex" : undefined,
						flexDirection: isFullHeight ? "column" : undefined,
					}}
					className="md:p-6 lg:p-8"
				>
					{children}
				</Content>
			</Layout>
			</Layout>
		</>
	);
}
