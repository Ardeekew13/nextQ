"use client";

import { useState } from "react";
import { Button, Popover, Typography } from "antd";
import { QrcodeOutlined } from "@ant-design/icons";
import { QRCodeSVG } from "qrcode.react";

const { Text } = Typography;

export function QrPopover({ url }: { url: string }) {
  const [open, setOpen] = useState(false);

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      styles={{ body: { padding: 20, borderRadius: 16 } }}
      content={
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              display: "inline-flex",
              padding: 12,
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #f3e8f0",
              boxShadow: "0 4px 20px rgba(236,72,153,0.1)",
            }}
          >
            <QRCodeSVG
              value={url}
              size={180}
              fgColor="#111827"
              bgColor="#ffffff"
              level="M"
            />
          </div>
          <div style={{ marginTop: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Scan to join this session
            </Text>
          </div>
          <div style={{ marginTop: 6 }}>
            <Text
              copyable={{ text: url, tooltips: ["Copy link", "Copied!"] }}
              style={{ fontSize: 11, color: "#ec4899" }}
            >
              {url.length > 40 ? `${url.slice(0, 40)}…` : url}
            </Text>
          </div>
        </div>
      }
    >
      <Button type="text" icon={<QrcodeOutlined />} style={{ color: "#e11d74", fontWeight: 600 }}>
        Gate QR
      </Button>
    </Popover>
  );
}
