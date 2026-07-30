"use client";

import { type ReactNode } from "react";
import Link from "next/link";
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
	const pathname = usePathname();
	const { actions, title } = useNavbarActions();

	const isSessionPage = /\/dashboard\/sessions\/[^/]+/.test(pathname ?? "");

	const selectedKey = pathname?.startsWith("/dashboard/clubs")
		? "clubs"
		: "dashboard";

	return (
		<Layout style={{ minHeight: "100vh", display: "flex" }}>
			{!isSessionPage && (
				<Sidebar
					selectedKey={selectedKey}
					onSelect={(key) => {
						if (key === "dashboard") {
							window.location.href = "/dashboard";
						} else if (key === "sessions") {
							window.location.href = "/dashboard/clubs";
						}
					}}
					userInitials={initials(organiserName)}
					userName={organiserName}
					clubCode="BPC"
				/>
			)}
			<Layout
				style={{
					marginLeft: isSessionPage ? 0 : 236,
					flex: 1,
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Navbar actions={actions} title={title} hasSidebar={!isSessionPage} />
				<Content
					style={{
						padding: "24px 32px",
						maxWidth: "100%",
						width: "100%",
						flex: 1,
						overflow: "auto",
						background: "#f7eef1",
					}}
				>
					{children}
				</Content>
			</Layout>
		</Layout>
	);
}
