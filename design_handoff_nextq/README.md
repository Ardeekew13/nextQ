# Handoff: NextQ — pickleball queueing system

## Overview

NextQ is a queueing system for a single pickleball club (Bataan Pickleball Club / "BPC") running open play on 2 courts. Organisers create sessions, players check in at the gate by QR, the system draws a random 4 for each free court, scores are logged, and standings rank players by win/loss.

This bundle covers eight screens: organiser dashboard, new-session setup, login, organiser-only player registration, two queueing views (control desk + player mobile), a courtside wall display, and standings.

## About the design files

**The files in `reference/` are design references written in HTML — prototypes of the intended look and behaviour, not production code to copy.** `reference/NextQ.dc.html` is a single HTML document holding every screen side by side on one canvas; it is not componentised, routed, or wired to data.

Your job is to **recreate these screens in the target codebase** using its existing framework and libraries. The target stack here is **React + Ant Design v5**, and `reference/antd-theme-prompt.md` is the ready-made theme brief: it contains the exact `ConfigProvider` token object, the font setup, the pink ramp, and the layout conventions. Start there, then build screens against the descriptions below.

## Fidelity

**High fidelity.** Colours, type, spacing and copy are final. Recreate the layouts closely, but express them through Ant Design components (`Layout`, `Menu`, `Table`, `Segmented`, `Radio.Group`, `Tag`, `Button`, `Input`) styled by the theme tokens rather than hand-written CSS. The design system underneath is "Industry" (`reference/_ds/.../styles.css`) recoloured to pink; you do not need to port that stylesheet — the AntD token map replaces it.

## Design tokens

**Pink ramp** (the only chromatic family; do not introduce a second hue):

| Step | Hex | Use |
| --- | --- | --- |
| 100 | `#fff1f5` | tinted fills, table header, hover |
| 200 | `#ffdde7` | selection, menu hover, progress track |
| 300 | `#ffb9cd` | kickers/labels on the dark field |
| 400 | `#ff8dad` | scores and accents on the dark field |
| base | `#f43f75` | primary buttons, selected state, live dot, avatar |
| 700 | `#bd2153` | links, small accent text on white |
| 800 | `#8d1a3f` | accent text on pink-100 fills |
| 900 | `#5c1029` | full reversed field (hero band, wall display, login header) |

**Neutrals:** text `#1d1f20`; secondary text `rgba(29,31,32,0.62)`; tertiary `rgba(29,31,32,0.5)`; container `#ffffff`; tinted surface `#fef4f7`; app background `#f7eef1`; border `rgba(138,39,72,0.24)`; inner row rule `rgba(29,31,32,0.08)`.

**Type:** `Barlow` (400/500/600) for body. `Barlow Condensed` (600) for every heading, button, table header, stat number and player name — always `text-transform: uppercase`, `letter-spacing: 0.03em`. Sizes in use: h1 40–44px / line-height 0.95; section heading 19–22px; body 12–13px; kicker 10–11px with `letter-spacing: 0.18–0.22em` uppercase; stat numbers 27–42px; wall-display scores 76px.

**Spacing:** 32px page gutter, 26px between major bands, 14–16px between sibling cards, 20–26px card padding, 9–13px table cell padding.

**Radius: 0 everywhere.** No rounded corners on any element, including inputs, tags, avatars, modals.

**Elevation:** flat. `0 1px 3px rgba(0,0,0,0.07)` at most; prefer 1px hairline borders over shadows.

**Icons:** Lucide, `strokeWidth={1.5}`, 16–17px in nav and buttons. No filled icon sets.

## Screens

### 1. Organiser dashboard (`3a` in the reference)

**Purpose:** the organiser lands here and either opens tonight's queue or reviews past sessions.

Layout: `Layout` with a 236px light `Sider` and a flex-column content area.

- **Sider** (background `#fef4f7`, 1px right border): logo block (42px tall logo, 1px bottom border, 20px padding) → user block (34px **square** pink avatar with initials in Barlow Condensed 15px white; name uppercase condensed 14px truncating with ellipsis; role "ORGANISER" 11px, `0.14em` tracking, pink-700) → `Menu mode="inline"` with Dashboard / Sessions / Queue / Standings / Members, 44px items, zero radius, **selected item is a solid pink fill with white label**, hover pink-200 → pushed to the bottom: an "Active club" card (1px border, white, club code in condensed 17px uppercase, sub-line 11px tertiary) and a text `Button` "Log out" with a Lucide `LogOut` icon, left-aligned.
- **Header row** (22px 32px, 1px bottom border): left, a pink-700 kicker with the live date/time then `h1` "GOOD EVENING, RON" at 40px; right, three buttons — ghost "Join club" (use pink-800 for the label, base pink fails contrast at this size), default "Create club", primary "New session", all 42px tall.
- **Up-next hero band** (pink-900 field, white type, 22px/26px padding, 26px gaps): left, kicker "UP NEXT · STARTS IN 48 MIN" in pink-300 → session name in condensed 32px uppercase → meta line 12.5px at 72% white. Middle, three stats (RSVP'd 18 / Checked in 0 / Status DRAFT) separated by `1px solid rgba(255,255,255,0.22)` vertical rules, 28px gaps, labels in pink-300 10px tracked uppercase, numbers condensed 30px. Right, a white-on-dark primary "Open the queue" (44px) and a transparent outlined "Edit setup" (36px).
- **Stat strip:** one bordered box divided into 4 equal cells by 1px vertical rules — Sessions run 14 / Games logged 312 / Avg turnout 17 / **Needs attention 1 draft unpublished** (this last cell gets a pink-100 fill and pink-800 numerals). Never render these as four separate shadowed cards.
- **Bottom grid** (`minmax(0,1fr) 300px`, 26px gap): left, "BPC SESSIONS" heading with a hairline rule filling the remaining width and a `Segmented` All / Drafts / Done at the right; then a `Table` with columns Session (condensed 16px) · Date (`29 Jul · 19:00`) · Courts · Players · Games · Status (`Tag`: pink for Draft, neutral for Completed — **no blue**); then a "View all 14 sessions" link. Right column: "CLUB LEADERS" — a bordered list of the top 5 with rank in pink-700, name in condensed 14px, W–L record 11.5px tertiary; below it "RECENT ACTIVITY" — timestamped lines, time in pink-700 600-weight, event text 12px at 70%.

Design intent to preserve: the first thing on the page is the session the organiser is about to run, not a row of counters. Counters are secondary and compressed into one strip.

### 2. New session setup (`2a`)

**Purpose:** organiser configures and publishes a session.

Same `Sider`. Content: header band (kicker "BPC · STEP 1 OF 2", `h1` "NEW SESSION" 44px; right, a "Draft saved HH:MM:SS" tag and a ghost "Use last week's setup") → single-column form area (26px between bands, 26px/34px padding) → sticky bottom action bar.

- **Section headers** are the pattern to reuse everywhere: `01 — BASICS` in condensed 11px, `0.2em` tracking, uppercase, `rgba(29,31,32,0.5)`, followed by a 1px hairline that flexes to fill the row, optionally a small link at the right end.
- **01 — Basics:** one row, four fields side by side — Session name (1.6fr), Date (1fr, date input), Start (88px), Courts (88px). Labels above inputs, 40px control height.
- **02 — Queue mode:** three equal selectable tiles in a row (`Radio.Group` of cards, 14px gap, 16px padding, 1px border). Each tile: radio + mode name in condensed 19px uppercase, then a 12px description, `text-wrap: pretty`. Hybrid carries a neutral "Recommended" tag; **Strict is selected and takes a solid pink fill with white type and a translucent-white "Selected" tag** — not a tint. Copy: Hybrid "Wait time first, then gentle catch-up for late arrivals." · Balanced "Everyone ends on the same game count. Late arrivals get priority until they catch up." · Strict "Pure queue order by wait time. Late arrivals join the back — no catch-up."
- **Inline advisory** pinned to the bottom of the form (pink-100 fill, 1px border, Lucide info icon in pink-700, text in pink-800, 12px): "Strict mode with 2 courts and 18 players means a ~13 minute wait between games. Balanced would shorten late-arrival waits by about 6 minutes." Compute this live from courts × expected turnout × average game length.
- **Action bar** (sticky bottom, white, 1px top border, 16px/34px): a 12px hint at the left, then ghost "Discard" · default "Save as draft" · primary "Create session", all 44px.

### 3. Login (`1a`) — mobile, 390px

Pink-900 header block with the logo knocked out to white (`filter: brightness(0) invert(1)`) and the club name in pink-300 tracked uppercase. Body: `h2` "GET IN THE QUEUE" 34px + 13px sub-line "Sign in, check in, get drawn. Courts wait for nobody." → Mobile number field → 4-digit PIN field (`type="password"`) → a row with a "Keep me checked in" checkbox and a "Forgot PIN?" link → full-width 48px primary "SIGN IN" → an `OR` divider (hairline / 11px tracked label / hairline) → a QR block on pink-100: 62px square QR, "SCAN THE COURT QR" in condensed 15px uppercase, 12px sub-line "Check in at the gate and skip the sign-in." → footer note, 11px centred, 45% opacity: "New here? Accounts are created by the club organizer at the desk."

There is **no public registration** — do not add a sign-up link.

### 4. Player registration (`1b`) — organiser only, desktop 1040px

Top `nav` bar (logo left, Dashboard / Queue / Standings / Roster, current item marked, organiser tag at the right). Body splits `1fr / 380px`.

Left: kicker "ROSTER · NEW ENTRY", `h1` "REGISTER A PLAYER" 44px, 13px explainer capped at 52ch ("Only organizers create accounts. The player gets an SMS with their PIN and can check in at the gate immediately.") → 2×2 field grid: First name, Last name, Mobile number, Member ID (`RVR-0184` format) → Skill bracket as a `Segmented` 2.5 / 3.0 / **3.5** / 4.0 / 4.5+ → Membership as three radios: Full member / Drop-in / Guest of member → Organizer note textarea (min-height 74px) → actions pinned to the bottom: primary "CREATE & SEND PIN" (44px), default "Save without SMS", ghost "Cancel".

Right rail on `#fef4f7`: "ADDED TODAY" with a count ("6 of 42 members"), then white cards each with a kicker (`RVR-0183 · 3.0`), a name, and a meta line ("PIN sent · 14:02" / "Awaiting PIN confirm"); pinned at the bottom, a "BULK IMPORT" block — 12px explainer "CSV of name, mobile, bracket." and a full-width default button "Upload roster file".

### 5. Queueing — control desk (`1d`), desktop 1360px

Split `440px / 1fr`.

Left rail on `#fef4f7`: kicker "CHECKED IN · WAITING", `h2` "THE POOL" 34px → the pool as a wrap of pink `Tag`s (13px, condensed 600, 6px/12px padding), one per waiting player → a white "DRAW RULES" card: "Random 4 from the pool · players who sat out the last round are weighted 2× · nobody plays twice before everyone plays once." → pinned at the bottom a 56px full-width primary "DRAW RANDOM 4" and a 11px centred line "Draw #12 · HH:MM:SS".

Right: "DRAWN FOR COURT 1" heading with a pink tag "Court frees in M:SS" → four equal cards on pink-100, each with a side label ("TEAM A · LEFT" … "TEAM B · RIGHT") in pink-700 10px tracked, the player name in condensed 25px uppercase, and a row with a bracket tag + W–L record → action row: primary "SEND TO COURT 1", default "Redraw", ghost "Swap a player" (44px) → "WAITING ORDER & ESTIMATES" `Table`: Pos · Player · Bracket · Sat out (`1 round` / `2 rounds` — respect the singular) · W–L · Est. wait, with the wait column in pink-700 500-weight. Note at the header right: "Estimate = avg game 13 min ÷ 2 courts".

Behaviour: **Draw random 4** shuffles the pool and repopulates the four cards; **Redraw** does the same. Court timers count up; "Court frees in" counts down.

### 6. Queueing — player mobile (`1e`), 390px

Slim top bar (logo, "Checked in" with a pulsing pink dot — 1.6s opacity 1→0.35 loop) → **base-pink hero, white type**: kicker "YOUR POSITION", a 92px condensed numeral with "IN THE POOL OF 10" beside it, then "~M:SS estimated wait · Court 1 frees first", then a 8px progress bar (white fill on 28% white track) → an alert card on pink-100 with a toggle: "ALERT ME WHEN I'M DRAWN / SMS + buzz, 90 seconds ahead." → "ON COURT NOW": one bordered row per court with `Court 1`, the matchup as 12px text, and the live score in condensed 18px pink-800 → "POOL AHEAD OF YOU" as neutral tags → bottom actions: default "Sit out a round" and primary "I'M READY" (44px each, side by side).

All touch targets ≥ 44px.

### 7. Courtside wall display (`1f`), 1280×720 landscape

Full pink-900 field, white type, designed to be read across a court. Header: knocked-out logo, "RIVERSIDE CLUB · OPEN PLAY" in pink-300 13px `0.24em` tracking, clock in condensed 30px at the right. Body `1fr / 1fr / 360px`: two court panels each with a pink-300 label "COURT 1 · M:SS", the serving pair in condensed 34px uppercase, the score in **76px pink-400**, the receiving pair at 72% white; then a right rail on 6% white with "UP NEXT — RANDOM DRAW" and the four drawn names in condensed 25px, rank in pink-400, each row underlined with a 14% white rule, and at the bottom a bordered QR block "SCAN TO JOIN / 10 waiting · ~11 min".

### 8. Standings (`1g`), desktop 1200px

Nav bar → header band: kicker "JULY OPEN PLAY · 41 GAMES", `h1` "STANDINGS" 46px, and a `Segmented` This month / Tonight / All time at the right → a three-cell hairline-divided strip: Leader (M. SANTOS, "14–3 · .824") / Hottest streak (L. YAP · W6, "Six straight since Tuesday") / Most games (J. LIM · 19, "Never sits out a draw") → `Table`: Rank (pink-700 condensed 17px) · Player (condensed 18px) · Bracket · W–L · Win % · **Form** · Streak (pink tag). The Form cell is ten 9×14px bars, 3px apart, filled base-pink in proportion to win rate and `rgba(29,31,32,0.12)` otherwise — build it as a small component, not an image.

## Interactions & behaviour

- **Draw:** shuffles the checked-in pool, takes N (default 4, configurable 2–8), assigns them to the two team slots per side. Weight players who sat out the previous round 2×; nobody plays twice until everyone has played once. Wire it to both the control-desk button and the dashboard "Draw now".
- **Live clocks:** court timers tick up per second; "court frees in" and "starts in" tick down; the header clock and "Draft saved" timestamp update live.
- **Scoring:** `+1 Left` / `+1 Right` increment the shown game; `End game` closes it, writes the result to standings, frees the court and triggers the next draw. Games to 11, win by 2, 18-minute hard cap.
- **Check-in:** the gate QR marks a player checked in and drops them into the pool; walk-ins can be added manually from the dashboard.
- **Notifications:** SMS + device buzz 90 seconds before a player is drawn, opt-in per player.
- **Pulsing "live" dot:** 1.6s infinite opacity 1 → 0.35 → 1.
- **Focus:** `:focus-visible { outline: 2px solid #f43f75; outline-offset: 2px; }` — never leave the browser default.
- **Logout:** available from the sidebar footer and a header avatar dropdown, sharing one `useLogout()` hook. Confirm with a `Modal.confirm` (title "Log out of NextQ?", body "Any unsaved session draft is kept.", `okText: "Log out"`, `danger`), then clear the auth token, reset query cache, `navigate("/login", { replace: true })`, and `message.success("Signed out")`.

## State

- `session`: name, date, startTime, courts, queueMode (`hybrid | balanced | strict`), drawSize, scoring, status (`draft | live | completed`).
- `players[]`: id, name, mobile, memberId, bracket, membership, note, checkedIn, sitOutRounds, wins, losses, streak.
- `pool[]`: ids of checked-in, not-currently-playing players, ordered by wait time.
- `courts[]`: id, status, teamA[2], teamB[2], scoreA, scoreB, startedAt.
- `drawn[]`: the pending four plus their slot assignment.
- Derived: estimated wait = `avgGameMinutes × ceil(poolPosition / (courts × 4))`; standings sorted by win %, tie-broken on games played.

## Assets

- `reference/uploads/logov2.png` — the NextQ logo (1536×1024, transparent). Used dark on white and inverted to white on the pink-900 field. Ask the client for an SVG before shipping.
- QR codes in the reference are drawn as a 5×5 CSS grid placeholder — generate real ones server-side per session.
- No photography is used anywhere in these screens.

## Files

- `reference/NextQ.dc.html` — all eight screens on one canvas. Screens are labelled with visible ids: `3a` dashboard, `2a` new session, `1a` login, `1b` registration, `1c` control-desk dashboard (earlier variant), `1d` queue control desk, `1e` player mobile queue, `1f` wall display, `1g` standings.
- `reference/antd-theme-prompt.md` — **start here**: the complete Ant Design v5 `ConfigProvider` token map, font loading, ramp, layout conventions, sidebar/logout code, and acceptance checks.
- `reference/_ds/industry-…/styles.css` + `readme.md` — the underlying design system for reference only (component classes and the written rationale). The AntD token map supersedes it; do not link this stylesheet into the app.
- `reference/support.js` — runtime for the HTML prototype only. **Do not port.**

## How to open the reference

Open `reference/NextQ.dc.html` in a browser (double-click, or VS Code's Live Preview / Live Server extension — the plain `file://` open works too). Everything is one page; pan/zoom to move between screens.
