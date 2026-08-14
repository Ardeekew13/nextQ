"use client";

import { useRouter } from "next/navigation";

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "#f7eef1",
      padding: "20px",
    }}>
      <div style={{
        textAlign: "center",
        maxWidth: "500px",
      }}>
        <h1 style={{
          fontSize: "64px",
          fontWeight: 700,
          color: "#1d1f20",
          margin: "0 0 20px 0",
          fontFamily: "'Barlow Condensed', sans-serif",
        }}>
          404
        </h1>
        <p style={{
          fontSize: "20px",
          color: "rgba(29,31,32,0.7)",
          margin: "0 0 30px 0",
        }}>
          Page not found
        </p>
        <button
          onClick={() => router.push("/dashboard")}
          style={{
            padding: "12px 32px",
            background: "linear-gradient(135deg, #ec4899 0%, #db2777 100%)",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            fontWeight: 600,
            fontSize: "14px",
            cursor: "pointer",
          }}
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
