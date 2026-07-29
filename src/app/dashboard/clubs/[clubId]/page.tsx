"use client";

import { useState } from "react";
import { CLUB_QUERY, DELETE_CLUB, CLUB_MEMBERS_QUERY, ADD_CLUB_MEMBER, UPDATE_CLUB_MEMBER, REMOVE_CLUB_MEMBER, GENERATE_CLUB_JOIN_CODE } from "@/graphql/documents/organiser";
import { humanizeStatus } from "@/lib/format";
import { buildPublicClubUrl } from "@/lib/urls";
import "@/styles/table.css";
import {
	CopyOutlined,
	DeleteOutlined,
	EditOutlined,
	LinkOutlined,
	PlusOutlined,
	TeamOutlined,
	UnorderedListOutlined,
} from "@ant-design/icons";
import { PageContainer } from "@ant-design/pro-components";
import { useMutation, useQuery } from "@apollo/client";
import {
	App,
	Button,
	Card,
	Form,
	Input,
	Modal,
	Popconfirm,
	Select,
	Skeleton,
	Space,
	Table,
	Tabs,
	Tag,
	Typography,
} from "antd";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

const { Title, Text } = Typography;

const SKILL_OPTIONS = [
	{ value: "NOVICE", label: "Novice" },
	{ value: "BEGINNER_LOW", label: "Beginner (low)" },
	{ value: "BEGINNER_HIGH", label: "Beginner (high)" },
	{ value: "INTERMEDIATE", label: "Intermediate" },
	{ value: "ADVANCED", label: "Advanced" },
];

const STATUS_COLORS: Record<string, string> = {
	DRAFT: "default",
	ACTIVE: "green",
	PAUSED: "orange",
	COMPLETED: "blue",
	CANCELLED: "red",
};

export default function ClubDetailPage() {
	const params = useParams<{ clubId: string }>();
	const router = useRouter();
	const { message } = App.useApp();
	const { data, loading, refetch } = useQuery(CLUB_QUERY, {
		variables: { id: params.clubId },
	});
	const { data: membersData, loading: membersLoading, refetch: refetchMembers } = useQuery(CLUB_MEMBERS_QUERY, {
		variables: { clubId: params.clubId },
	});
	const [deleteClub] = useMutation(DELETE_CLUB);
	const [generateJoinCode, { loading: generatingCode }] = useMutation(GENERATE_CLUB_JOIN_CODE);
	const [addClubMember] = useMutation(ADD_CLUB_MEMBER);
	const [updateClubMember] = useMutation(UPDATE_CLUB_MEMBER);
	const [removeClubMember] = useMutation(REMOVE_CLUB_MEMBER);

	const [addMemberOpen, setAddMemberOpen] = useState(false);
	const [editingMember, setEditingMember] = useState<any>(null);
	const [addForm] = Form.useForm();
	const [editForm] = Form.useForm();

	if (loading) return <Skeleton active />;
	const club = data?.club;
	if (!club) return <Text>Club not found.</Text>;

	const publicUrl = buildPublicClubUrl(club.slug);
	const members: any[] = membersData?.clubMembers ?? [];

	async function handleDelete() {
		try {
			await deleteClub({ variables: { id: club.id } });
			message.success("Club deleted");
			router.push("/dashboard/clubs");
		} catch (error) {
			message.error(
				error instanceof Error ? error.message : "Could not delete club",
			);
		}
	}

	async function handleAddMember(values: { name: string; nickname?: string; skillLevel?: string }) {
		try {
			await addClubMember({ variables: { clubId: club.id, input: values } });
			message.success("Player added to roster");
			addForm.resetFields();
			setAddMemberOpen(false);
			refetchMembers();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not add player");
		}
	}

	async function handleEditMember(values: any) {
		try {
			await updateClubMember({ variables: { id: editingMember.id, input: values } });
			message.success("Player updated");
			setEditingMember(null);
			refetchMembers();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not update player");
		}
	}

	async function handleRemoveMember(id: string) {
		try {
			await removeClubMember({ variables: { id } });
			message.success("Player removed from roster");
			refetchMembers();
		} catch (err) {
			message.error(err instanceof Error ? err.message : "Could not remove player");
		}
	}

	return (
		<PageContainer
			title={club.name}
			extra={[
				<Button
					key="copy"
					icon={<CopyOutlined />}
					onClick={() => {
						navigator.clipboard.writeText(publicUrl);
						message.success("Public club link copied");
					}}
				>
					Copy public link
				</Button>,
				<Link key="new" href={`/dashboard/clubs/${club.id}/sessions/new`}>
					<Button type="primary" icon={<PlusOutlined />}>
						New session
					</Button>
				</Link>,
				<Popconfirm
					key="delete"
					title="Delete this club?"
					description="This cannot be undone. Clubs with an active or paused session cannot be deleted."
					onConfirm={handleDelete}
				>
					<Button danger icon={<DeleteOutlined />}>
						Delete club
					</Button>
				</Popconfirm>,
			]}
		>
			<Tabs
				style={{ marginTop: 8 }}
				items={[
					{
						key: "sessions",
						label: <span><UnorderedListOutlined /> Sessions</span>,
						children: (
							<>
								<div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
									<Input
										placeholder="Search sessions..."
										style={{ flex: 1 }}
										allowClear
									/>
								</div>
								<Card style={{ border: "1px solid #e8e8e8" }}>
									<Table
										className="compact-table"
										rowKey="id"
										dataSource={club.sessions}
										size="small"
										pagination={false}
										columns={[
											{
												title: "Name",
												dataIndex: "name",
												render: (name: string, record: any) => (
													<Link href={`/dashboard/sessions/${record.id}`}>{name}</Link>
												),
											},
											{
												title: "Date",
												dataIndex: "sessionDate",
												render: (value: string) => new Date(value).toLocaleDateString(),
											},
											{
												title: "Status",
												dataIndex: "status",
												render: (status: string) => (
													<Tag color={STATUS_COLORS[status]}>
														{humanizeStatus(status)}
													</Tag>
												),
											},
											{
												title: "Public link",
												dataIndex: "publicUrl",
												render: (url: string) => (
													<Button
														size="small"
														icon={<LinkOutlined />}
														onClick={() => {
															navigator.clipboard.writeText(url);
															message.success("Link copied");
														}}
													>
														Copy
													</Button>
												),
											},
										]}
									/>
								</Card>
							</>
						),
					},
					{
						key: "roster",
						label: <span><TeamOutlined /> Players ({members.length})</span>,
						children: (
							<>
								<div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
									<Button type="primary" icon={<PlusOutlined />} onClick={() => setAddMemberOpen(true)}>
										Add player
									</Button>
								</div>
								<Card style={{ border: "1px solid #e8e8e8" }}>
									<Table
										className="compact-table"
										rowKey="id"
										dataSource={members}
										loading={membersLoading}
										size="small"
										pagination={false}
										locale={{ emptyText: "No players yet. Add players here or they'll be added automatically when you add them to a session." }}
										columns={[
											{
												title: "Name",
												dataIndex: "name",
												render: (name: string, row: any) => (
													<Space direction="vertical" size={0}>
														<Text strong>{name}</Text>
														{row.nickname && <Text type="secondary" style={{ fontSize: 12 }}>{row.nickname}</Text>}
													</Space>
												),
											},
											{
												title: "Skill",
												dataIndex: "skillLevel",
												render: (v: string) => (
													<Tag>{v ? (SKILL_OPTIONS.find((o) => o.value === v)?.label ?? v) : "Unrated"}</Tag>
												),
											},
											{ title: "Sessions", dataIndex: "sessionsPlayed", width: 80 },
											{ title: "Total games", dataIndex: "totalGames", width: 100 },
											{
												title: "Actions",
												width: 100,
												render: (_: unknown, row: any) => (
													<Space>
														<Button
															size="small"
															icon={<EditOutlined />}
															onClick={() => {
																setEditingMember(row);
																editForm.setFieldsValue(row);
															}}
														/>
														<Popconfirm title="Remove from roster?" onConfirm={() => handleRemoveMember(row.id)}>
															<Button size="small" danger icon={<DeleteOutlined />} />
														</Popconfirm>
													</Space>
												),
											},
										]}
									/>
								</Card>
							</>
						),
					},
					{
						key: "share",
						label: <span><LinkOutlined /> Share &amp; Invite</span>,
						children: (
							<Card style={{ maxWidth: 480 }}>
								<Title level={5} style={{ marginBottom: 4 }}>Public club link</Title>
								<Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
									Share this link so players can view your sessions.
								</Text>
								<Space>
									<Text code style={{ fontSize: 13 }}>{publicUrl}</Text>
									<Button
										icon={<CopyOutlined />}
										size="small"
										onClick={() => { navigator.clipboard.writeText(publicUrl); message.success("Link copied!"); }}
									>
										Copy
									</Button>
								</Space>

								<div style={{ borderTop: "1px solid #f0f0f0", margin: "24px 0" }} />

								<Title level={5} style={{ marginBottom: 4 }}>Co-organiser join code</Title>
								<Text type="secondary" style={{ fontSize: 13, display: "block", marginBottom: 12 }}>
									Generate a 6-character code so another organiser can join and manage this club.
								</Text>
								{club.joinCode ? (
									<Space direction="vertical" size={12} style={{ width: "100%" }}>
										<div style={{
											display: "inline-flex", alignItems: "center", gap: 12,
											background: "#f9fafb", border: "1px solid #e5e7eb",
											borderRadius: 10, padding: "10px 16px",
										}}>
											<Text style={{ fontSize: 24, fontWeight: 800, letterSpacing: "0.25em", color: "#111" }}>
												{club.joinCode}
											</Text>
											<Button
												icon={<CopyOutlined />}
												size="small"
												onClick={() => { navigator.clipboard.writeText(club.joinCode); message.success("Code copied!"); }}
											/>
										</div>
										<Text type="secondary" style={{ fontSize: 12 }}>
											Share this code with the other organiser. They can enter it via <strong>Join club</strong> on their dashboard.
										</Text>
										<Button
											size="small"
											loading={generatingCode}
											onClick={async () => {
												await generateJoinCode({ variables: { id: club.id } });
												refetch();
												message.success("New join code generated");
											}}
										>
											Regenerate code
										</Button>
									</Space>
								) : (
									<Button
										type="primary"
										loading={generatingCode}
										onClick={async () => {
											await generateJoinCode({ variables: { id: club.id } });
											refetch();
										}}
									>
										Generate join code
									</Button>
								)}
							</Card>
						),
					},
				]}
			/>

			{/* Add member modal */}
			<Modal title="Add player to roster" open={addMemberOpen} onCancel={() => setAddMemberOpen(false)} footer={null}>
				<Form form={addForm} layout="vertical" onFinish={handleAddMember}>
					<Form.Item label="Name" name="name" rules={[{ required: true }]}>
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Nickname" name="nickname">
						<Input size="large" />
					</Form.Item>
					<Form.Item label="Skill level (optional)" name="skillLevel">
						<Select allowClear options={SKILL_OPTIONS} size="large" />
					</Form.Item>
					<Button type="primary" htmlType="submit" block size="large">Add to roster</Button>
				</Form>
			</Modal>

			{/* Edit member modal */}
			<Modal title="Edit player" open={!!editingMember} onCancel={() => setEditingMember(null)} onOk={() => editForm.submit()}>
				<Form form={editForm} layout="vertical" onFinish={handleEditMember}>
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
		</PageContainer>
	);
}
