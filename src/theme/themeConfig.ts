import type { ThemeConfig } from "antd";

export const nextQTheme: ThemeConfig = {
  token: {
    colorPrimary: "#f43f75",
    colorInfo: "#f43f75",
    colorLink: "#bd2153",
    colorLinkHover: "#f43f75",
    colorText: "#1d1f20",
    colorTextSecondary: "rgba(29,31,32,0.62)",
    colorTextTertiary: "rgba(29,31,32,0.5)",
    colorBgLayout: "#f7eef1",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBorder: "rgba(138,39,72,0.24)",
    colorBorderSecondary: "rgba(138,39,72,0.14)",
    colorFillQuaternary: "#fff1f5",

    borderRadius: 0,
    borderRadiusLG: 0,
    borderRadiusSM: 0,
    borderRadiusXS: 0,

    fontFamily: "'Barlow', system-ui, sans-serif",
    fontSize: 14,
    lineWidth: 1,
    controlHeight: 40,
    controlHeightLG: 48,
    wireframe: false,

    boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
    boxShadowSecondary: "0 1px 3px rgba(0,0,0,0.07)",
  },
  components: {
    Button: {
      fontWeight: 600,
      primaryShadow: "none",
      defaultShadow: "none",
      contentFontSize: 15,
    },
    Card: {
      paddingLG: 20,
      headerFontSize: 18,
    },
    Layout: {
      bodyBg: "#ffffff",
      headerBg: "#ffffff",
      siderBg: "#fef4f7",
      headerHeight: 64,
    },
    Menu: {
      itemBg: "transparent",
      itemSelectedBg: "#f43f75",
      itemSelectedColor: "#ffffff",
      itemHoverBg: "#ffdde7",
      itemBorderRadius: 0,
      itemMarginInline: 0,
      itemHeight: 44,
      iconSize: 17,
    },
    Table: {
      headerBg: "#fff1f5",
      headerColor: "#8d1a3f",
      headerSplitColor: "transparent",
      rowHoverBg: "#fff1f5",
      borderColor: "rgba(138,39,72,0.14)",
      cellPaddingBlock: 12,
    },
    Input: {
      paddingBlock: 9,
      activeShadow: "none",
    },
    Select: {
      optionSelectedBg: "#fff1f5",
    },
    Radio: {
      buttonSolidCheckedBg: "#f43f75",
      buttonCheckedBg: "#ffdde7",
    },
    Tag: {
      defaultBg: "#fff1f5",
      defaultColor: "#8d1a3f",
    },
    Segmented: {
      itemSelectedBg: "#f43f75",
      itemSelectedColor: "#ffffff",
      itemHoverBg: "#ffdde7",
      trackBg: "#fff1f5",
      trackPadding: 2,
    },
    Progress: {
      defaultColor: "#f43f75",
    },
    Statistic: {
      contentFontSize: 34,
      titleFontSize: 11,
      fontFamily: "'Barlow Condensed', sans-serif",
    },
  },
};

export const themeConfig = nextQTheme;
