import type { ThemeConfig } from "antd";

export const BURGUNDY = {
  primary: "#ec4899",
  soft: "#f0f0f0",
  softer: "#f5f5f5",
  border: "#e0e0e0",
  text: "#ec4899",
};

/**
 * Higher-contrast, larger-control theme tuned for courtside use: bright
 * outdoor light, touch input on phones/tablets, and fast score entry.
 * Visual language: soft pink wash background, white rounded cards with a
 * gentle shadow, pill-shaped controls.
 */
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: BURGUNDY.primary,
    colorLink: BURGUNDY.primary,
    colorInfo: BURGUNDY.primary,
    colorBgLayout: BURGUNDY.soft,
    fontSize: 14,
    fontSizeHeading1: 28,
    fontSizeHeading2: 24,
    fontSizeHeading3: 20,
    fontSizeHeading4: 16,
    fontSizeHeading5: 14,
    borderRadius: 12,
    borderRadiusLG: 18,
    controlHeight: 44,
    margin: 8,
    marginXS: 4,
    padding: 12,
    paddingXS: 6,
    boxShadowTertiary:
      "0 2px 8px rgba(236, 72, 153, 0.06), 0 1px 2px rgba(236, 72, 153, 0.08)",
  },
  components: {
    Button: {
      controlHeight: 34,
      controlHeightLG: 40,
      controlHeightSM: 26,
      fontWeight: 600,
      borderRadius: 10,
      borderRadiusLG: 12,
      paddingInline: 24,
      paddingInlineLG: 32,
    },
    Card: {
      borderRadiusLG: 20,
      boxShadowTertiary:
        "0 2px 8px rgba(236, 72, 153, 0.06), 0 1px 2px rgba(236, 72, 153, 0.08)",
      colorBorderSecondary: "#f8e1ec",
    },
    Table: {
      cellFontSizeSM: 14,
      headerBg: "#ffffff",
      colorTextHeading: "#333333",
      borderRadiusLG: 16,
      colorBorder: "#e8e8e8",
      rowHoverBg: "#fafafa",
      headerBorderRadius: 8,
      cellPaddingBlock: 12,
      cellPaddingInline: 16,
    },
    Tag: {
      fontSizeSM: 13,
      borderRadiusSM: 999,
    },
    Modal: {
      borderRadiusLG: 20,
    },
    Layout: {
      headerBg: "#ffffff",
      siderBg: "#ffffff",
      bodyBg: BURGUNDY.soft,
    },
    Menu: {
      itemBorderRadius: 12,
      itemSelectedBg: BURGUNDY.soft,
      itemSelectedColor: BURGUNDY.primary,
      itemHoverBg: "#fef7fb",
      itemHeight: 44,
    },
  },
};
