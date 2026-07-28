"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@apollo/client";
import { Layout, Menu, Button, Typography, Avatar, App, Tooltip } from "antd";
import {
	LogoutOutlined,
	TeamOutlined,
	DashboardOutlined,
	LeftOutlined,
	RightOutlined,
} from "@ant-design/icons";
import { LOGOUT_ORGANISER } from "@/graphql/documents/organiser";
import { BURGUNDY } from "@/theme/themeConfig";
import { Navbar } from "./Navbar";
import { AppLogo } from "./AppLogo";
import {
	NavbarActionsProvider,
	useNavbarActions,
} from "./NavbarActionsContext";

const { Sider, Content } = Layout;
const { Text, Title } = Typography;

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
	const router = useRouter();
	const { message } = App.useApp();
	const [logout] = useMutation(LOGOUT_ORGANISER);
	const [collapsed, setCollapsed] = useState(false);

	const isSessionPage = /\/dashboard\/sessions\/[^/]+/.test(pathname ?? "");

	const selectedKey = pathname?.startsWith("/dashboard/clubs")
		? "clubs"
		: "dashboard";

	async function handleLogout() {
		await logout();
		message.success("Logged out");
		router.push("/login");
		router.refresh();
	}

	const { actions, title } = useNavbarActions();

	return (
		<Layout style={{ minHeight: "100vh", display: "flex" }}>
			{!isSessionPage && (
			<Sider
				breakpoint="lg"
				collapsedWidth={72}
				width={260}
				collapsed={collapsed}
				onCollapse={setCollapsed}
				style={{
					borderRight: `1px solid ${BURGUNDY.border}`,
					position: "fixed",
					left: 0,
					top: 0,
					bottom: 0,
					overflow: "auto",
					zIndex: 100,
					height: "100vh",
				}}
			>
				<div
					style={{
						display: "flex",
						flexDirection: "column",
						height: "100%",
						padding: collapsed ? "12px 6px" : "14px 12px",
					}}
				>
					{/* Logo */}
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: collapsed ? "center" : "flex-start",
							padding: collapsed ? "4px 0 12px" : "2px 8px 14px",
							borderBottom: `1px solid ${BURGUNDY.border}`,
							marginBottom: 14,
						}}
					>
						{collapsed ? (
							<AppLogo variant="icon" size="sm" />
						) : (
							<AppLogo variant="full" size="md" />
						)}
					</div>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							gap: 8,
							justifyContent: collapsed ? "center" : "flex-start",
							padding: collapsed ? "6px 0" : "6px 8px",
							marginBottom: 14,
							background: BURGUNDY.soft,
							borderRadius: 12,
						}}
					>
						<Avatar
							style={{
								backgroundColor: BURGUNDY.primary,
								fontWeight: 700,
								flexShrink: 0,
								fontSize: 12,
								width: 32,
								height: 32,
							}}
						>
							{initials(organiserName)}
						</Avatar>
						{!collapsed && (
							<div style={{ overflow: "hidden" }}>
								<Text
									strong
									style={{
										display: "block",
										lineHeight: 1.2,
										whiteSpace: "nowrap",
										overflow: "hidden",
										textOverflow: "ellipsis",
										fontSize: 13,
									}}
								>
									{organiserName}
								</Text>
								<Text type="secondary" style={{ fontSize: 11 }}>
									Organiser
								</Text>
							</div>
						)}
					</div>

					<Menu
						mode="inline"
						selectedKeys={[selectedKey]}
						style={{ border: "none", background: "transparent", flex: 1 }}
						items={[
							{
								key: "dashboard",
								icon: <DashboardOutlined />,
								label: <Link href="/dashboard">Dashboard</Link>,
							},
							{
								key: "clubs",
								icon: <TeamOutlined />,
								label: <Link href="/dashboard/clubs">Clubs</Link>,
							},
						]}
					/>

					<Button
						icon={<LogoutOutlined />}
						onClick={handleLogout}
						block={!collapsed}
						style={{ marginTop: 12 }}
					>
						{!collapsed && "Log out"}
					</Button>

					{/* Collapse toggle at the bottom */}
					<Tooltip
						title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
						placement="right"
					>
						<Button
							type="text"
							icon={collapsed ? <RightOutlined /> : <LeftOutlined />}
							onClick={() => setCollapsed(!collapsed)}
							style={{
								marginTop: 8,
								width: "100%",
								color: "#999",
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
							}}
						/>
					</Tooltip>
				</div>
			</Sider>
			)}
			<Layout
				style={{
					marginLeft: isSessionPage ? 0 : collapsed ? 72 : 260,
					transition: "margin-left 0.2s",
					flex: 1,
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Navbar collapsed={collapsed} actions={actions} title={title} />
				<Content
					style={{
						padding: "24px 28px",
						maxWidth: "100%",
						width: "100%",
						flex: 1,
						overflow: "auto",
					}}
				>
					{children}
				</Content>
			</Layout>
		</Layout>
	);
}
