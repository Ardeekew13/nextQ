"use client";

import type { ReactNode, CSSProperties } from "react";

type BadgeVariant = "green" | "pink" | "blue" | "orange" | "gray";

const VARIANTS: Record<BadgeVariant, { color: string; background: string }> = {
  green:  { color: "#059669", background: "#d1fae5" },
  pink:   { color: "#db2777", background: "#fce7f3" },
  blue:   { color: "#0369a1", background: "#e0f2fe" },
  orange: { color: "#c2410c", background: "#fff7ed" },
  gray:   { color: "#6b7280", background: "#f3f4f6" },
};

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  /** Override color/background directly */
  color?: string;
  background?: string;
  style?: CSSProperties;
}

export function Badge({
  children,
  variant = "gray",
  color,
  background,
  style,
}: BadgeProps) {
  const base = VARIANTS[variant];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: 0.2,
        color: color ?? base.color,
        background: background ?? base.background,
        borderRadius: 99,
        padding: "3px 10px",
        whiteSpace: "nowrap",
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </span>
  );
}
