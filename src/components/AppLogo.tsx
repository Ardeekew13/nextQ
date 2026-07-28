"use client";

import Image from "next/image";

interface AppLogoProps {
  size?: "sm" | "md" | "lg";
}

// logov2.png is 1536×1024 (3:2 ratio — landscape)
const SIZE = {
  sm: { w: 60, h: 40 },
  md: { w: 75, h: 50 },
  lg: { w: 120, h: 80 },
};

export function AppLogo({ size = "md" }: AppLogoProps) {
  const { w, h } = SIZE[size];
  // Render larger than the clip box to crop the whitespace padding in the PNG
  const scale = 1.4;
  const oversize = { w: Math.round(w * scale), h: Math.round(h * scale) };
  const offsetX = -Math.round((oversize.w - w) / 2);
  const offsetY = -Math.round((oversize.h - h) / 2);

  return (
    <div style={{ width: w, height: h, overflow: "hidden", flexShrink: 0 }}>
      <Image
        src="/logov2.png"
        alt="NextQ"
        width={oversize.w}
        height={oversize.h}
        style={{
          objectFit: "contain",
          display: "block",
          marginLeft: offsetX,
          marginTop: offsetY,
        }}
        priority
      />
    </div>
  );
}
