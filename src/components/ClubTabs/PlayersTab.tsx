"use client";

import { useState } from "react";
import { Button, Form, Input, Modal, Popconfirm, Select, Tag, Dropdown, Pagination } from "antd";
import { MoreVertical } from "lucide-react";

const SKILL_OPTIONS = [
	{ value: "NOVICE", label: "Novice" },
	{ value: "BEGINNER_LOW", label: "Beginner (low)" },
	{ value: "BEGINNER_HIGH", label: "Beginner (high)" },
	{ value: "INTERMEDIATE", label: "Intermediate" },
	{ value: "ADVANCED", label: "Advanced" },
];

const ROWS_PER_PAGE = 10;

interface PlayersTabProps {
	activeTab: string;
	members: any[];
	addMemberOpen: boolean;
	setAddMemberOpen: (open: boolean) => void;
	editingMember: any;
	setEditingMember: (member: any) => void;
	addForm: any;
	editForm: any;
	onAddMember: (values: any) => Promise<void>;
	onEditMember: (values: any) => Promise<void>;
	onRemoveMember: (id: string) => Promise<void>;
}

export function PlayersTab({
	activeTab,
	members,
	addMemberOpen,
	setAddMemberOpen,
	editingMember,
	setEditingMember,
	addForm,
	editForm,
	onAddMember,
	onEditMember,
	onRemoveMember,
}: PlayersTabProps) {
	if (activeTab !== "roster") return null;

	const [searchValue, setSearchValue] = useState("");
	const [filterValue, setFilterValue] = useState<"all" | "played" | "never" | "unrated">("all");
	const [currentPage, setCurrentPage] = useState(1);

	const sorted = [...members].sort((a, b) => (b.totalGames ?? 0) - (a.totalGames ?? 0));

	const filtered = sorted.filter((m) => {
		if (searchValue && !m.name.toLowerCase().includes(searchValue.toLowerCase())) return false;
		if (filterValue === "played" && (m.totalGames ?? 0) === 0) return false;
		if (filterValue === "never" && (m.totalGames ?? 0) > 0) return false;
		if (filterValue === "unrated" && m.skillLevel) return false;
		return true;
	});

	const totalNeverPlayed = filtered.filter((m) => (m.totalGames ?? 0) === 0).length;
	const totalPages = Math.ceil(filtered.length / ROWS_PER_PAGE);
	const startIdx = (currentPage - 1) * ROWS_PER_PAGE;
	const paginatedMembers = filtered.slice(startIdx, startIdx + ROWS_PER_PAGE);

	return (
		<>
			{/* Toolbar */}
			<div style={{ display: "flex", gap: 12, marginBottom: 24, alignItems: "center" }}>
				<Input
					placeholder={`Search ${members.length} players…`}
					value={searchValue}
					onChange={(e) => setSearchValue(e.target.value)}
					style={{ maxWidth: 260 }}
					prefix={<span style={{ color: "rgba(29,31,32,0.3)" }}>🔍</span>}
				/>
				<div style={{ display: "flex", gap: 0, border: "1px solid #d4d7db" }}>
					{(["all", "played", "never", "unrated"] as const).map((f) => (
						<button
							key={f}
							onClick={() => setFilterValue(f)}
							style={{
								padding: "6px 12px",
								border: "none",
								background: filterValue === f ? "#8d1a3f" : "#fff",
								borderRight: f !== "unrated" ? "1px solid #d4d7db" : "none",
								fontSize: 12,
								cursor: "pointer",
								color: filterValue === f ? "#fff" : "rgba(29,31,32,0.6)",
								fontWeight: 600,
							}}
						>
							{f === "all" ? "All" : f === "played" ? "Has played" : f === "never" ? "Never played" : "Unrated"}
						</button>
					))}
				</div>
				<div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
					<Button
						onClick={() => {
							addForm.resetFields();
							setAddMemberOpen(true);
						}}
					>
						+ Add player
					</Button>
					<Button>Import</Button>
				</div>
			</div>

			{/* Table */}
			<div style={{ background: "#fff" }}>
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr 80px 80px 80px 26px",
						padding: "12px 14px",
						background: "#fff1f5",
						fontSize: 10,
						fontWeight: 700,
						letterSpacing: "0.14em",
						textTransform: "uppercase",
						color: "#8d1a3f",
						borderBottom: "1px solid rgba(138,39,72,0.12)",
						gap: 16,
					}}
				>
					<div>Name</div>
					<div>Games</div>
					<div>W–L</div>
					<div>Win %</div>
					<div></div>
				</div>

				{paginatedMembers.map((member: any) => {
					const isNeverPlayed = (member.totalGames ?? 0) === 0;
					const textColor = isNeverPlayed ? "rgba(29,31,32,0.55)" : "#1d1f20";
					const numColor = isNeverPlayed ? "rgba(29,31,32,0.35)" : "rgba(29,31,32,0.6)";

					return (
						<div
							key={member.id}
							style={{
								display: "grid",
								gridTemplateColumns: "1fr 80px 80px 80px 26px",
								padding: "10px 14px",
								borderBottom: "1px solid rgba(29,31,32,0.08)",
								background: "#fff",
								gap: 16,
								alignItems: "center",
							}}
						>
							<div>
								<div style={{ fontWeight: 600, color: textColor, fontSize: 13, marginBottom: 4 }}>{member.name}</div>
								{member.skillLevel ? (
									<Tag
										style={{
											borderRadius: 0,
											background: "#ec4899",
											color: "#fff",
											border: "none",
											fontSize: 10,
										}}
									>
										{SKILL_OPTIONS.find((o) => o.value === member.skillLevel)?.label}
									</Tag>
								) : (
									<Tag
										style={{
											borderRadius: 0,
											background: "transparent",
											color: "rgba(29,31,32,0.5)",
											border: "1px solid rgba(138,39,72,0.24)",
											fontSize: 10,
										}}
									>
										Unrated
									</Tag>
								)}
							</div>
							<div style={{ fontSize: 13, color: numColor, textAlign: "right" }}>
								{member.totalGames ?? 0}
							</div>
							<div style={{ fontSize: 13, color: numColor, textAlign: "right" }}>
								{`${member.wins ?? 0}–${member.losses ?? 0}`}
							</div>
							<div style={{ fontSize: 13, color: numColor, textAlign: "right" }}>
								{member.totalGames === 0 ? "–" : `${(((member.wins ?? 0) / (member.totalGames ?? 1)) * 100).toFixed(0)}%`}
							</div>
							<Dropdown
								menu={{
									items: [
										{
											key: "edit",
											label: "Edit player",
											onClick: () => {
												setEditingMember(member);
												editForm.setFieldsValue(member);
											},
										},
										{
											key: "skill",
											label: "Set skill",
											onClick: () => {
												setEditingMember(member);
												editForm.setFieldsValue({ skillLevel: member.skillLevel });
											},
										},
										{
											type: "divider",
										},
										{
											key: "remove",
											label: "Remove from club",
											danger: true,
											onClick: () => {
												Modal.confirm({
													title: "Remove from roster?",
													okText: "Remove",
													okButtonProps: { danger: true },
													onOk: () => onRemoveMember(member.id),
												});
											},
										},
									],
								}}
								trigger={["click"]}
							>
								<button
									style={{
										background: "none",
										border: "none",
										cursor: "pointer",
										padding: 0,
										display: "flex",
										alignItems: "center",
										justifyContent: "center",
									}}
								>
									<MoreVertical size={16} color="rgba(29,31,32,0.45)" />
								</button>
							</Dropdown>
						</div>
					);
				})}

				{totalNeverPlayed > 0 && (
					<div
						style={{
							padding: "12px 14px",
							background: "#fff1f5",
							borderTop: "1px solid rgba(138,39,72,0.12)",
							fontSize: 12,
							color: "#8d1a3f",
							fontWeight: 600,
						}}
					>
						NEVER PLAYED {totalNeverPlayed}
					</div>
				)}
				{totalPages > 1 && (
					<div
						style={{
							padding: "16px 14px",
							background: "#fff",
							borderTop: "1px solid rgba(138,39,72,0.12)",
							display: "flex",
							justifyContent: "center",
						}}
					>
						<Pagination
							current={currentPage}
							total={filtered.length}
							pageSize={ROWS_PER_PAGE}
							onChange={(page) => setCurrentPage(page)}
							simple
							style={{ fontSize: 12 }}
						/>
					</div>
				)}
			</div>

			{/* Modals */}
			<Modal
				title="Add player"
				open={addMemberOpen}
				onCancel={() => setAddMemberOpen(false)}
				onOk={() => addForm.submit()}
				okText="Add player"
			>
				<Form form={addForm} layout="vertical" onFinish={onAddMember} requiredMark={false} style={{ marginTop: 12 }}>
					<Form.Item label="Name" name="name" rules={[{ required: true }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Skill level" name="skillLevel">
						<Select allowClear options={SKILL_OPTIONS} size="large" />
					</Form.Item>
				</Form>
			</Modal>

			<Modal
				title="Edit player"
				open={!!editingMember}
				onCancel={() => setEditingMember(null)}
				onOk={() => editForm.submit()}
				okText="Save"
			>
				<Form form={editForm} layout="vertical" onFinish={onEditMember} requiredMark={false} style={{ marginTop: 12 }}>
					<Form.Item label="Name" name="name" rules={[{ required: true }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Skill level" name="skillLevel">
						<Select allowClear options={SKILL_OPTIONS} size="large" />
					</Form.Item>
				</Form>
			</Modal>
		</>
	);
}
