import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { ConfigProvider, App as AntApp } from "antd";
import { ApolloWrapper } from "@/apollo/ApolloWrapper";
import { themeConfig } from "@/theme/themeConfig";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "NextQ - Pickleball Open Play Queueing",
  description: "Random-stacking pickleball session and queue management.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <ConfigProvider theme={themeConfig}>
            <AntApp>
              <ApolloWrapper>{children}</ApolloWrapper>
            </AntApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
