"use client";

import React from "react";
import { Layout, Menu, Button, Avatar, Typography, Card } from "antd";
import { LogOut } from "lucide-react";
import { useLogout } from "@/hooks/useLogout";

const { Sider } = Layout;
const { Text } = Typography;

interface SidebarProps {
  selectedKey: string;
  onSelect: (key: string) => void;
  userInitials?: string;
  userName?: string;
  clubCode?: string;
}

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard" },
];

export function Sidebar({
  selectedKey,
  onSelect,
  userInitials = "RD",
  userName = "Ron Davis",
  clubCode = "BPC-001",
}: SidebarProps) {
  const logout = useLogout();

  const menuItems = NAV_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
  }));

  return (
    <Sider width={236} theme="light" style={{ background: "#fef4f7", borderRight: "1px solid rgba(138,39,72,0.24)", height: "100%" }}>
      {/* Logo block */}
      <div style={{ padding: "20px", borderBottom: "1px solid rgba(138,39,72,0.24)", height: 82 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#f43f75" }}>NextQ</div>
      </div>

      {/* User block */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(138,39,72,0.24)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <Avatar
            size={34}
            style={{
              background: "#f43f75",
              color: "#ffffff",
              fontSize: 15,
              fontFamily: "'Barlow Condensed', sans-serif",
              fontWeight: 600,
              textTransform: "uppercase",
              borderRadius: 0,
              flexShrink: 0,
            }}
          >
            {userInitials}
          </Avatar>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                fontFamily: "'Barlow Condensed', sans-serif",
                fontSize: 14,
                fontWeight: 600,
                textTransform: "uppercase",
                color: "#1d1f20",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {userName}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "#bd2153",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
              }}
            >
              ORGANISER
            </div>
          </div>
        </div>
      </div>

      {/* Menu */}
      <Menu mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={(e) => onSelect(e.key)} />

      {/* Active club card */}
      <div style={{ margin: "20px 14px 0" }}>
        <Card
          size="small"
          style={{
            border: "1px solid rgba(138,39,72,0.24)",
            background: "#ffffff",
          }}
          styles={{
            body: {
              padding: "12px 16px",
            },
          }}
        >
          <Text
            style={{
              fontFamily: "'Barlow Condensed', sans-serif",
              fontSize: 17,
              fontWeight: 600,
              textTransform: "uppercase",
              color: "#1d1f20",
              display: "block",
              marginBottom: 4,
            }}
          >
            {clubCode}
          </Text>
          <Text type="secondary" style={{ fontSize: 11 }}>
            Active club
          </Text>
        </Card>
      </div>

      {/* Logout button */}
      <div style={{ marginTop: "auto", padding: "18px 20px", borderTop: "1px solid rgba(138,39,72,0.24)" }}>
        <Button
          type="text"
          block
          icon={<LogOut size={16} strokeWidth={1.5} />}
          onClick={logout}
          style={{
            justifyContent: "flex-start",
            gap: 9,
            fontWeight: 600,
            color: "#1d1f20",
          }}
        >
          Log out
        </Button>
      </div>
    </Sider>
  );
}
