"use client";

import { useEffect, useRef } from "react";
import { Modal, Button, Typography, App } from "antd";
import { ShareAltOutlined, TrophyFilled } from "@ant-design/icons";
import confetti from "canvas-confetti";
import { Podium, type PodiumEntryView } from "./Podium";

const { Title, Text } = Typography;

interface FinishCelebrationModalProps {
  open: boolean;
  sessionName: string;
  publicUrl: string;
  podium: PodiumEntryView[];
  onClose: () => void;
}

export function FinishCelebrationModal({
  open,
  sessionName,
  publicUrl,
  podium,
  onClose,
}: FinishCelebrationModalProps) {
  const { message } = App.useApp();
  const firedRef = useRef(false);

  useEffect(() => {
    if (!open || firedRef.current) return;
    firedRef.current = true;

    const end = Date.now() + 2800;
    const colors = ["#ec4899", "#f472b6", "#fbbf24", "#34d399", "#60a5fa"];

    (function frame() {
      confetti({
        particleCount: 6,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.65 },
        colors,
      });
      confetti({
        particleCount: 6,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.65 },
        colors,
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    })();
  }, [open]);

  // Reset so confetti fires again if modal reopens
  useEffect(() => {
    if (!open) firedRef.current = false;
  }, [open]);

  function handleShare() {
    navigator.clipboard.writeText(publicUrl);
    message.success("Session link copied to clipboard!");
  }

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={560}
      centered
      styles={{ body: { padding: "24px 20px 20px" } }}
    >
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 48, lineHeight: 1, marginBottom: 8 }}>🎉</div>
        <Title level={3} style={{ margin: "0 0 4px" }}>
          Session Complete!
        </Title>
        <Text type="secondary">{sessionName}</Text>
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
            <TrophyFilled style={{ color: "#d4af37", fontSize: 16 }} />
            <Text strong style={{ fontSize: 14 }}>Top Players</Text>
          </div>
          <Podium entries={podium} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        <Button
          icon={<ShareAltOutlined />}
          onClick={handleShare}
          style={{ borderColor: "#ec4899", color: "#ec4899" }}
        >
          Share session link
        </Button>
        <Button type="primary" onClick={onClose}
          style={{ background: "#ec4899", borderColor: "#ec4899" }}
        >
          View full standings
        </Button>
      </div>
    </Modal>
  );
}
