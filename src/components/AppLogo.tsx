"use client";

interface AppLogoProps {
  /** "full" = wordmark + icon, "icon" = icon only (collapsed sidebar) */
  variant?: "full" | "icon";
  size?: "sm" | "md" | "lg";
}

const SIZE = {
  sm: { pill: { height: 28, padding: "0 10px", borderRadius: 8, gap: 6 }, dot: 7, text: 15 },
  md: { pill: { height: 34, padding: "0 12px", borderRadius: 10, gap: 7 }, dot: 8, text: 18 },
  lg: { pill: { height: 44, padding: "0 16px", borderRadius: 14, gap: 9 }, dot: 10, text: 24 },
};

export function AppLogo({ variant = "full", size = "md" }: AppLogoProps) {
  const s = SIZE[size];

  if (variant === "icon") {
    return (
      <div
        style={{
          width: s.pill.height,
          height: s.pill.height,
          borderRadius: s.pill.borderRadius,
          background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
          boxShadow: "0 2px 8px rgba(236,72,153,0.4)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            color: "#fff",
            fontWeight: 900,
            fontSize: s.text * 0.8,
            letterSpacing: "-0.5px",
            lineHeight: 1,
          }}
        >
          N
        </span>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: s.pill.gap,
        background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
        boxShadow: "0 2px 10px rgba(236,72,153,0.35)",
        borderRadius: s.pill.borderRadius,
        padding: s.pill.padding,
        height: s.pill.height,
        flexShrink: 0,
      }}
    >
      {/* Glowing dot */}
      <span
        style={{
          width: s.dot,
          height: s.dot,
          borderRadius: "50%",
          background: "rgba(255,255,255,0.7)",
          boxShadow: "0 0 4px rgba(255,255,255,0.9)",
          flexShrink: 0,
          display: "inline-block",
        }}
      />
      <span
        style={{
          color: "#fff",
          fontWeight: 900,
          fontSize: s.text,
          letterSpacing: "-0.5px",
          lineHeight: 1,
        }}
      >
        Next<span style={{ opacity: 0.85 }}>Q</span>
      </span>
    </div>
  );
}
