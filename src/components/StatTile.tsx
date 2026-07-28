"use client";

import { Card, Typography, type MenuProps, Dropdown, Button } from "antd";
import { MoreOutlined } from "@ant-design/icons";
import type { ReactNode } from "react";
import { BURGUNDY } from "@/theme/themeConfig";

const { Text, Title } = Typography;

export interface StatTileProps {
  icon?: ReactNode;
  iconColor?: string;
  iconBg?: string;
  label: string;
  value: ReactNode;
  suffix?: string;
  menu?: MenuProps["items"];
}

export function StatTile({ icon, iconColor = BURGUNDY.primary, iconBg = BURGUNDY.soft, label, value, suffix, menu }: StatTileProps) {
  return (
    <Card styles={{ body: { padding: "12px 14px" } }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
          {icon && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                background: iconBg,
                color: iconColor,
                fontSize: 14,
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          <Text type="secondary" style={{ fontSize: 12, wordBreak: "normal", overflowWrap: "normal" }}>
            {label}
          </Text>
        </div>
        {menu && (
          <Dropdown menu={{ items: menu }} trigger={["click"]}>
            <Button type="text" size="small" icon={<MoreOutlined />} />
          </Dropdown>
        )}
      </div>
      <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 4 }}>
        <Title level={4} style={{ margin: 0, fontSize: 18 }}>
          {value}
        </Title>
        {suffix && (
          <Text type="secondary" style={{ fontSize: 11 }}>
            {suffix}
          </Text>
        )}
      </div>
    </Card>
  );
}
