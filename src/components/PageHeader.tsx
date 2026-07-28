"use client";

import { type ReactNode } from "react";
import { Typography, Space } from "antd";

const { Title } = Typography;

export interface PageHeaderProps {
  title: string;
  children?: ReactNode;
}

export function PageHeader({ title, children }: PageHeaderProps) {
  return (
    <div
      style={{
        padding: "0 0 16px 0",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 12,
      }}
    >
      <Title level={3} style={{ margin: 0 }}>
        {title}
      </Title>
      {children && <Space wrap>{children}</Space>}
    </div>
  );
}
