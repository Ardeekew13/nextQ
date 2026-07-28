import type { Metadata } from "next";
import { Suspense } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntApp } from "antd";
import { ApolloWrapper } from "@/apollo/ApolloWrapper";
import { themeConfig } from "@/theme/themeConfig";
import { RouteProgress } from "@/components/RouteProgress";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "NextQ — Pickleball Open Play",
  description: "Pickleball session and queue management for organisers.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23ec4899'/><text x='50%' y='54%' dominant-baseline='middle' text-anchor='middle' font-family='system-ui,sans-serif' font-weight='900' font-size='18' fill='white'>N</text></svg>",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={themeConfig}>
            <AntApp>
              <Suspense fallback={null}>
                <RouteProgress />
              </Suspense>
              <ApolloWrapper>{children}</ApolloWrapper>
            </AntApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
