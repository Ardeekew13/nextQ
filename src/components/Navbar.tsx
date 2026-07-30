"use client";

import { type ReactNode } from "react";
import { Layout } from "antd";
import { AppLogo } from "./AppLogo";

const { Header } = Layout;

export function Navbar({
  actions,
  title,
  hasSidebar = false,
}: {
  collapsed?: boolean;
  onCollapse?: (collapsed: boolean) => void;
  actions?: ReactNode;
  title?: ReactNode;
  hasSidebar?: boolean;
}) {
  return (
    <>
      <style>{`
        .pickleq-navbar {
          padding-left: 16px !important;
          padding-right: 16px !important;
        }
        @media (min-width: 640px) {
          .pickleq-navbar {
            padding-left: 28px !important;
            padding-right: 28px !important;
          }
        }

        /* Default / ghost buttons */
        .pickleq-navbar-actions .ant-btn-default {
          border-color: #e5e7eb !important;
          color: #374151 !important;
          background: #fff !important;
          font-weight: 600;
        }
        .pickleq-navbar-actions .ant-btn-default:hover {
          border-color: #ec4899 !important;
          color: #ec4899 !important;
          background: #fdf2f8 !important;
        }

        /* Danger outline — Finish session */
        .pickleq-navbar-actions .ant-btn-dangerous:not(.ant-btn-text) {
          border-color: #ec4899 !important;
          color: #ec4899 !important;
          background: #fff !important;
          font-weight: 600;
        }
        .pickleq-navbar-actions .ant-btn-dangerous:not(.ant-btn-text):hover {
          background: #fdf2f8 !important;
          border-color: #db2777 !important;
          color: #db2777 !important;
        }

        /* Cancel text button */
        .pickleq-navbar-actions .ant-btn-text.ant-btn-dangerous {
          color: #ec4899 !important;
          font-weight: 600;
        }
        .pickleq-navbar-actions .ant-btn-text.ant-btn-dangerous:hover {
          background: #fdf2f8 !important;
          color: #db2777 !important;
        }

        /* Primary — Start / Resume */
        .pickleq-navbar-actions .ant-btn-primary {
          background: linear-gradient(135deg, #ec4899 0%, #db2777 100%) !important;
          border-color: transparent !important;
          box-shadow: 0 2px 8px rgba(236,72,153,0.35) !important;
          font-weight: 600;
        }
        .pickleq-navbar-actions .ant-btn-primary:hover {
          background: linear-gradient(135deg, #f472b6 0%, #ec4899 100%) !important;
          box-shadow: 0 4px 14px rgba(236,72,153,0.45) !important;
        }

        /* Logo + optional page title */
        .pickleq-navbar-logo { display: inline-flex; }
        @media (max-width: 480px) {
          .pickleq-navbar-logo.has-title { display: none; }
        }
        .pickleq-navbar .ant-tag {
          border: none !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.2px;
          border-radius: 99px !important;
          padding: 2px 10px !important;
          line-height: 20px !important;
        }
      `}</style>

      {/* Pink gradient accent stripe */}
      <div style={{
        position: "sticky",
        top: 0,
        zIndex: 51,
        height: 3,
        background: "linear-gradient(90deg, #ec4899 0%, #f472b6 50%, #ec4899 100%)",
        backgroundSize: "200% 100%",
        animation: "pq-shimmer 4s linear infinite",
        width: "100%",
        flexShrink: 0,
      }} />
      <style>{`
        @keyframes pq-shimmer {
          0%   { background-position: 0% 0%; }
          100% { background-position: 200% 0%; }
        }
      `}</style>

      <Header
        className="pickleq-navbar"
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #f3e8f0",
          boxShadow: "0 2px 16px rgba(236,72,153,0.07), 0 1px 3px rgba(0,0,0,0.05)",
          paddingTop: 12,
          paddingBottom: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 20,
          minHeight: "auto",
          height: "auto",
          lineHeight: "normal",
          margin: 0,
          width: "100%",
          position: "sticky",
          top: 3,
          zIndex: 50,
        }}
      >
        {/* Logo (only when no sidebar) + optional page title */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
          {!hasSidebar && (
            <div className={`pickleq-navbar-logo${title ? " has-title" : ""}`}>
              <AppLogo size="sm" />
            </div>
          )}
          {title && !hasSidebar && (
            <div style={{ width: 1, height: 20, background: "#e5e7eb", flexShrink: 0 }} />
          )}
          {title && <div style={{ minWidth: 0 }}>{title}</div>}
        </div>

        {/* Actions */}
        {actions && (
          <div
            className="pickleq-navbar-actions"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              flexShrink: 0,
              maxWidth: "100%",
            }}
          >
            {actions}
          </div>
        )}
      </Header>
    </>
  );
}
