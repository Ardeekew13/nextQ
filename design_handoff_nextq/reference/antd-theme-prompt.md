# Prompt — NextQ theme in Ant Design v5

Paste everything below the line to Claude in your frontend repo. Before it starts, tell it: **read `src/App.tsx`, the existing `ConfigProvider` (if any), your layout/sider component, and one representative form page — then report the files it plans to touch before writing code.** Have it land the work in this order, in separate commits, so you can eyeball each step: (1) `src/theme/nextq.ts` with the token object + fonts, (2) the sider/logout, (3) one form page converted to the section-band layout as the pattern for the rest.

---

Implement the **NextQ** visual theme in our existing React + Ant Design v5 app. Do not restyle by hand-writing CSS on top of AntD components — drive it through `ConfigProvider` theme tokens first, and only add CSS for the two things tokens can't express (condensed uppercase headings, sidebar/logout chrome).

## Fonts

Load Barlow + Barlow Condensed (weights 400/500/600):

```html
<link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&display=swap" rel="stylesheet">
```

Body copy = `Barlow`. All headings, numbers, stat readouts, buttons and table headers = `Barlow Condensed`, `font-weight: 600`, `text-transform: uppercase`, `letter-spacing: 0.03em`.

## ConfigProvider theme

```tsx
import { ConfigProvider, theme } from "antd";

const nextQTheme = {
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

    // square everything — this theme has no rounded corners
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

    // flat, wireframe elevation
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
    Card: { paddingLG: 20, headerFontSize: 18 },
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
    Input: { paddingBlock: 9, activeShadow: "none" },
    Select: { optionSelectedBg: "#fff1f5" },
    Radio: { buttonSolidCheckedBg: "#f43f75", buttonCheckedBg: "#ffdde7" },
    Tag: { defaultBg: "#fff1f5", defaultColor: "#8d1a3f" },
    Segmented: {
      itemSelectedBg: "#f43f75",
      itemSelectedColor: "#ffffff",
      itemHoverBg: "#ffdde7",
      trackBg: "#fff1f5",
      trackPadding: 2,
    },
    Progress: { defaultColor: "#f43f75" },
    Statistic: {
      contentFontSize: 34,
      titleFontSize: 11,
      fontFamily: "'Barlow Condensed', sans-serif",
    },
  },
};

export const AppTheme = ({ children }) => (
  <ConfigProvider theme={nextQTheme}>{children}</ConfigProvider>
);
```

## Pink ramp (use these, don't invent shades)

`100 #fff1f5` · `200 #ffdde7` · `300 #ffb9cd` · `400 #ff8dad` · `500 #f9598c` · `600 #e42f68` · **`base #f43f75`** · `700 #bd2153` · `800 #8d1a3f` · `900 #5c1029`

Rules: 100–200 for tinted fills and hovers, base for primary actions and the selected state, 700–800 for text on pink tints (base pink fails contrast at body size), 900 as a full reversed field (courtside display, session summary card) with white type on it.

## Layout rules the tokens don't cover

Add one small global stylesheet:

```css
h1, h2, h3, h4, h5, .ant-typography h1, .ant-typography h2, .ant-typography h3,
.ant-btn, .ant-table-thead > tr > th, .ant-statistic-content {
  font-family: "Barlow Condensed", sans-serif;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
h1 { font-size: 44px; line-height: 0.95; }
:focus-visible { outline: 2px solid #f43f75; outline-offset: 2px; }
::selection { background: #ffdde7; }
```

Structural conventions:
- **No rounded corners anywhere.** No card fills beyond white or a pink-100 tint; borders are 1px hairlines.
- **Section bands over floating cards.** Label each form section with a small numbered kicker (`01 — BASICS`, 11px, 0.2em tracking, uppercase, muted) followed by a hairline rule that fills the remaining width. No `Card` wrapper around form sections.
- **Never let a form float in an empty viewport.** Full-width content grid, fields laid out side-by-side in a `Row`/`Col` grid (name 1.6fr, date 1fr, time 88px, courts 88px), not one field per row.
- Choice sets (queue modes, scoring) are **side-by-side selectable tiles** in a `Radio.Group` with `Row gutter={14}`, not a vertical stack. The selected tile takes a **solid pink fill with white type** — not a faint tint.
- Primary/secondary/tertiary actions live in a **sticky bottom bar** (`position: sticky; bottom: 0`, white, 1px top border), right-aligned: ghost Discard · default Save as draft · primary Create.
- Stat readouts go in a bordered grid of equal cells divided by hairlines, not shadowed cards.
- Icons: **Lucide** at `strokeWidth={1.5}`, 17px in nav. Do not use `@ant-design/icons` filled glyphs.

## Sidebar and logout

```tsx
<Layout.Sider width={236} theme="light">
  {/* logo block, 1px bottom border */}
  {/* user block: 34px square pink avatar (borderRadius 0), name in Barlow Condensed
      uppercase, role "ORGANISER" in pink-700, 11px, 0.14em tracking */}
  <Menu mode="inline" selectedKeys={[active]} items={navItems} />
  <div style={{ marginTop: "auto", padding: "18px 20px", borderTop: "1px solid rgba(138,39,72,0.24)" }}>
    <Button
      type="text"
      block
      icon={<LogOut size={16} strokeWidth={1.5} />}
      onClick={handleLogout}
      style={{ justifyContent: "flex-start", gap: 9, fontWeight: 600 }}
    >
      Log out
    </Button>
  </div>
</Layout.Sider>
```

Logout behaviour: `Modal.confirm` with `okText: "Log out"`, `okButtonProps: { danger: true }`, title "Log out of NextQ?" and body "Any unsaved session draft is kept." On confirm: clear the auth token, reset any React Query / store cache, `navigate("/login", { replace: true })`, then `message.success("Signed out")`. Make it work from both the sidebar and a header avatar dropdown, sharing one `useLogout()` hook.

## Acceptance checks

1. Zero rounded corners in the rendered app (`borderRadius: 0` resolves everywhere, including Inputs, Selects, Modals, Tags).
2. No body-size text uses `#f43f75` on white — deep steps only.
3. Every form screen fills its column width; no single-field-per-row stacks, no large empty regions.
4. Logout is reachable in one click from any screen and always lands on `/login` with cleared state.
5. Headings render in Barlow Condensed uppercase; body in Barlow.
