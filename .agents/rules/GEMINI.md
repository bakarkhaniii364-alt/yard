---
trigger: always_on
---

# WORKSPACE CODEBASE ENVIRONMENT & RETRO-OS RULES

## 🛑 STRICT COMPLIANCE DIRECTIVES (CRITICAL)
Before returning ANY code block or file modification, execute this logical sanity check. If your planned output violates any of these, rewrite it immediately:
1. **NO CORNER ROUNDING:** Every element must strictly use `border-radius: 0px !important;`.
2. **NO SOFT SHADOWS:** `box-shadow: none !important;` and `text-shadow: none !important;` across the entire codebase.
3. **NO GLOWS OR BLURS:** `backdrop-filter: none !important;`. For active modal backdrops, exclusively use a flat alpha tint: `background: rgba(var(--theme-overlay-rgb), 0.4);`.
4. **NO EMOJIS:** Absolutely zero raw or unicode emojis anywhere in markup, text layers, button labels, or placeholder strings (e.g., Change "👤 View Profile" to "View Profile"). Use text-based UI status blocks or system-font icon tags instead.
5. **LEGACY CLEANUP:** You are migrating an old couple's site ("Attic") into a social/group gaming hub called "Yard". Automatically modify and transform any legacy residual strings, options, or copy into community, friendgroup, discord-style, or facebook-style settings and language.
6. **NO BEVEL:** Buttons, windows will not have any bevels. They will have harsh solid shadows.
---

## 🗂️ MAIN CANVAS & LAYOUT CONSTRAINTS

### 1. Viewport & Scroll Containment
- The layout is divided into a **Sacred Left Navigation Rail** and a **Dynamic Canvas** to its right.
- **Outermost Page Container:** Must match the viewport exactly. Force `width: 100vw; height: 100vh; overflow: hidden; box-sizing: border-box;`. Main browser scrollbars are explicitly banned.
- **The Left Rail:** Is fixed and static. Handles global audio variables (`Mute`, `Deafen`) and profile overlays.
- **Top Headers:** Completely forbidden. Do not add a top header or website navigation bar. It ruins the desktop immersion.
- **The Dynamic Canvas (Right of Rail):** Must fill 100% of remaining viewport space.
  - Layout Definition: Use standard CSS Grid: `display: grid; grid-template-columns: 280px 1fr 300px; gap: var(--space-md); width: 100%; height: 100%; padding: var(--space-md);`.
  - Sidebars: Left sidebar width is exactly `280px`. Right sidebar width is exactly `300px`.
  - Center Feed Column: Must dynamically scale using `1fr`.
  - Window Scroll Containment: Overflowing windows (e.g., the center timeline feed) must contain scrolling internally via `overflow-y: scroll;` combined with a rectangular retro track style.

### 2. Layout Token Systems
All spacing, windows, and component applications must use these rigid token rules. Do not pass raw, intermediate, or inline pixel modifications.

```css
:root {
  /* Spacing Scale (Uniform 8px Grid Alignment) */
  --space-xs: 4px;       /* Only for micro gaps between icons and text string layers */
  --space-sm: 6px;       /* Padding within utility list items (e.g., active_friends.sys) */
  --space-md: 8px;       /* Mandatory default grid gap and window exterior spacing */
  --space-lg: 12px;      /* Main layout feed card internal text padding */
  --space-modal: 16px;   /* Allowed exclusively for internal modal body margins */
}

```

### 3. Window & Application Structure

* Treat every component UI asset like a native desktop operating system window. Use the `.sys` (system utilities) and `.exe` (executable applications) wrapper framework.
* **Redundancy Strip:** Remove any duplicate feature links or routing shortcuts inside dashboard components (e.g., do not place "Arcade" routing buttons inside `shortcuts.sys`).

---

## 🔤 TYPOGRAPHIC SYSTEM (space-mono Scale)

The site exclusively utilizes the `space-mono` monospace typeface. Do not introduce alternative font families. No intermediate typography size values are allowed.

### Scale Hierarchy

* **Tier 1 (System Headers):** `font-size: 20px; font-weight: 700; line-height: 1.2;`
* *Scenarios:* Application window header title bars (`shortcuts.sys`, `active_friends.sys`), Arcade game tiles, core configuration menus. Monospace wrapping safety: never exceed 20px.


* **Tier 2 (Interactive Elements):** `font-size: 15px; font-weight: 700; line-height: 1;` (Use `font-weight: 500` strictly for structural layer text like channel names).
* *Scenarios:* Timelines/Feed usernames, channel configurations (`#general`), primary navigation actions ("MESSENGER").


* **Tier 3 (Core Body Text):** `font-size: 14px; font-weight: 400; line-height: 1.5;`
* *Scenarios:* Post text layers on the main feed, chat application logs, raw user text inputs, modal description parameters.


* **Tier 4 (Meta & Interface Utility):** `font-size: 12px; line-height: 1;`
* *Scenarios:* Post timestamps ("1h ago"), user application states ("playing 2048"), system log outputs, input label wrappers.
* *Formatting Rules:* For state chips (`[ONLINE]`, `[ACTIVE]`) or mini action handles (`[ LIKE ]`), force `font-weight: 700; text-transform: uppercase;`. For timestamps, use `font-weight: 400;` with a muted theme value.


* **Tier 5 (Micro Overlays):** `font-size: 10px; font-weight: 400; line-height: 1; text-transform: uppercase; letter-spacing: 0.05em;`
* *Scenarios:* App version markers ("retro feed v1.0"), stream status details, real-time typing indicators, active game lobby counts.



### Monospace Structural Safeguard

To prevent text clipping or broken layouts across sidebars, apply this CSS pattern immediately to all user strings rendered under Tiers 1, 2, and 4 inside static menus (like `active_friends.sys`):

```css
.sidebar-text-string {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

```

---

## 🪟 RIGID WINDOW MODAL ARCHITECTURE

### 1. Sizing Parameters

* **Standard Resolution Scale:** Fixed geometry of `width: 640px; height: 480px;`.
* **Responsive Handling:** If screen widths fall below 640px, downscale using fluid bounds: `width: 95vw; height: 85vh;`.
* **Layout Centering:** Apply exact layer alignment: `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 1000;`.

### 2. Component Layout Tree

Every application modal block must strictly structure its nested DOM using these exact three segments:

* **Header (`.window-header`):** Fixed height. Contains a left-aligned window title (Tier 1 typography) and a right-aligned rectangular close toggle icon. Clicking the icon must unmount the structural state.
* **Body (`.window-body`):** Set to `overflow-y: auto; padding: var(--space-modal);`. Must execute a hard-edged retro scrolling track.
* **Footer (`.window-footer`):** Fixed `45px` height. Built using flexbox right-aligned button actions (`CANCEL`, `SAVE CHANGES`).

### 3. Borders & Theme Values

* Modals must pop outward from the canvas via mechanical outset styling: `border: 3px solid; border-color: var(--theme-border-outset);`.
* All design choices (colors, fills, text colors) must be derived from custom theme variables specified in the user control dashboard (`control panel/aesthetics/theme`).

---

## 🧱 INTERACTIVE COMPONENTS (BUTTONS, INPUTS, FORMS)

### 1. Form Input Architecture

* **Two-Line Stacked Pattern:** Form inputs are strict block fragments utilizing a distinct inset boundary line.
* *Line 1 (Indicator):* Top-aligned input field label. Uses Tier 4 typography (12px), capitalized uppercase, colored via secondary muted theme definitions.
* *Line 2 (Data Value):* Inner input text or active typed payload. Uses Tier 3 typography (14px) rendered in primary text theme configurations.


* **Input Styling Constraints:**

```css
  .system-input {
    border-radius: 0px !important;
    background: var(--theme-bg-input-solid);
    border: 2px solid;
    border-style: inset;
    border-color: var(--theme-border-inset);
  }

```

* **Placeholders:** Styled using Tier 4 typography (12px), forced uppercase, colored with `var(--theme-text-disabled)`. Do not use icons inside input placeholder elements.

### 2. Interactive Button Framework

* **Standard Action Toggles:** Rigid `height: 32px; padding: 6px 12px;`. Typographic scale defaults to Tier 2 (15px Bold).
* **Small/Utility Buttons (`[ SHARE ]`, `[ LIKE ]`):** Rigid `height: 24px; padding: 4px 8px;`. Typographic scale defaults to Tier 4 (12px Uppercase Bold).
* **Icon-Only Buttons:** Rigid `width: 32px; height: 32px; padding: 0;` containing a centered icon layout.
* **Button State Framework:**
* **Normal State:** Solid flat background, crisp outset pixel styling, no rounding hooks, zero drop shadows. `border: 2px solid var(--theme-border-outset);`.
* **Hover State:** Background colors flip instantly to your active highlight variables. Force pointer definition: `cursor: pointer;`.
* **Active Clicked State:** Background shifts darker. To simulate a vintage mechanical layout depression, translate inner content strings down and right on the canvas using: `transform: translate(1px, 1px);`.



---

## 🗜️ DATABASE & AUTOMATED TESTING RULES

### 1. Supabase Execution

* If you author, edit, or adjust schemas, database rules, or storage functions, push those changes directly using the native Supabase local environment workspace. The machine running this instance contains a fully authenticated `supabase-cli` engine installation.

### 2. End-to-End Testing (Playwright)

* **Framework:** Playwright using TypeScript constructs.
* **Selector Locators:** You must exclusively query matching targets through standard functional roles or specific explicit data tags. Prefer `page.getByRole()` or `page.getByTestId()`.
* **CSS Selectors Banned:** Never utilize arbitrary styling tags or raw class names (`page.locator('.window-body-container')`) within testing specs.
* **Core Coverage Targets:** Maintain 100% test integrity focusing on user auth states, live sync states (Chat channels, Pictionary canvas pipelines), and local game engine persistence.

### 3. Authentication Bypass via Test Mode (Staging/Testing)
- **Do Not Write Manual Login Flows:** When authoring or running Playwright tests, do not use the UI to manually fill out usernames, passwords, or OTP steps.
- **Enforce Test Mode Environment:** Instruct tests to leverage a `TEST_MODE=true` environment flag or inject a bypass cookie/header. 
- **Application Logic Bypass:** When `process.env.TEST_MODE === 'true'` is detected, the application must completely bypass the Supabase OAuth/MagicLink challenge and automatically instantiate a mock session using a dedicated testing profile identifier (`test_user_id`).
- **Playwright Configuration Pattern:** Force your test hooks to initialize like this:
```typescript
  test.beforeEach(async ({ page, context }) => {
    // Inject test mode cookie or set storage state to bypass authentication UI
    await context.addCookies([{
      name: 'sys_test_mode',
      value: 'true',
      domain: 'localhost',
      path: '/'
    }]);
    // Alternatively, ensure process.env.TEST_MODE = 'true' is set in playwright.config.ts
  });

```