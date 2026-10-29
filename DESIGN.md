---
name: RR Vintage Instrument (v1)
colors:
  background: '#0a122a'
  surface: '#0a122a'
  surface-container-lowest: '#050d25'
  surface-container-low: '#131a33'
  surface-container: '#171e37'
  surface-container-high: '#212942'
  on-surface: '#dbe1ff'
  on-surface-variant: '#c4c5d9'
  outline: '#8e90a2'
  outline-variant: '#434656'
  primary: '#b8c4ff'
  on-primary: '#002486'
  primary-container: '#0e4bef'
  on-primary-container: '#d1d7ff'
  secondary: '#eec14b'
  on-secondary: '#3e2e00'
  secondary-container: '#b38b14'
  on-secondary-container: '#362800'
  status-ahead: '#F97316'
  on-status-ahead: '#0a122a'
  status-behind: '#EF4444'
  on-status-behind: '#FFFFFF'
  status-ontime: '#10B981'
  on-status-ontime: '#0a122a'
typography:
  display:
    fontFamily: Space Mono
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.03em
  headline-xl:
    fontFamily: Space Mono
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.03em
  headline-lg:
    fontFamily: Space Mono
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Chivo
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 26px
  body-lg:
    fontFamily: Chivo
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Chivo
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Space Mono
    fontSize: 13px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.08em
  label-md:
    fontFamily: Space Mono
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.1em
rounded:
  DEFAULT: 0.25rem
  lg: 0.5rem
  full: 9999px
spacing:
  margin: 1rem
  gutter: 0.75rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 0.75rem
  space-lg: 1.25rem
  space-xl: 1.75rem
---

## Brand & Style

RR is an offline assistant for the co-driver of an amateur regularity rally. The co-driver glances at the screen between other tasks, in a moving car, under changing light. Simplicity and legibility come before anything else.

The visual style is **Flat Vintage Instrument**. The vintage identity comes only from three things: the color palette (racing blue, brass, ivory on deep navy), the monospaced numerals, and one circular odometer dial. Everything else is flat and quiet.

The reference mockup `docs/rr-pantallas-v1.html` is the visual reference for every screen (layout, copy, spacing). If the mockup and this file contradict each other, this file wins.

Rules that apply everywhere:
- No textures, gradients, bezels, rivets, knurling, glows, or decorative shadows. **Exception**: the Carrera odometer dial has two allowed ornaments: a faint 1px `outline-variant` ring just outside the dial face, and a thin dotted `outline-variant` guide ring just inside the ticks. These are the only ornaments permitted.
- Depth is expressed only with tonal surface layers and 1px borders.
- Every screen has one clear primary element; nothing decorative competes with the numbers.
- Never use color as the only signal. Always pair it with a text label.
- All user-facing text is in Spanish (Argentina). Use short, plain words. Fixed labels: CARRERA and CALCULADORA (tabs), INICIAR, PARAR, REINICIAR, APLICAR, SIGUIENTE, ADELANTADO, ATRASADO, EN TIEMPO, SIN DATOS, ASIGNADO, HORA OFICIAL, PROMEDIO, DISTANCIA, CRONÓMETRO 2, KM/H, KM, SEG. GPS status line messages: BUSCANDO GPS…, GPS SIN PERMISO: activalo en Ajustes de iOS, GPS NO DISPONIBLE. Screen titles: PREPARAR ETAPA, CALIBRAR ODÓMETRO, AYUDA.

## Colors

Dark-first. The structural backdrop is deep midnight navy (`background`). The color tokens in the frontmatter are the single source of truth.

- **Primary**: `primary` (`#b8c4ff`) is for text, icons, and strokes on dark surfaces. `primary-container` (`#0e4bef`, French racing blue) is for filled elements such as buttons and the active tab. Blue text on navy has poor contrast, so never use `primary-container` as a text color on dark surfaces.
- **Secondary**: `secondary` (`#eec14b`, brass) is for secondary numeric readouts, dial tick marks, and calibration values.
- **Text**: `on-surface` for primary text, `on-surface-variant` for supporting text and labels.
- **Status colors (only for the ahead/behind indicator)**:
  In a regularity rally, both ahead and behind schedule are errors that penalize; only being on time is good.
  - `status-ahead` (orange, `#F97316`): ahead of schedule (alert). Text on it uses `on-status-ahead` (`#0a122a`).
  - `status-behind` (red, `#EF4444`): behind schedule. Text on it uses `on-status-behind` (`#FFFFFF`).
  - `status-ontime` (emerald, `#10B981`): on time (within the tolerance band). Text on it uses `on-status-ontime` (`#0a122a`).
  - No-data state uses `surface-container-high` with `on-surface` text. Color is never the only signal: text labels are mandatory.
- Ivory (`#FBF7EE`) is reserved for numerals and tick marks on the odometer dial. Do not use large ivory surfaces, to avoid glare.

## Typography

- **Space Mono**: every number that updates (stopwatches, time of day, speeds, distance, delta). Monospaced digits prevent layout jitter.
- **Chivo**: labels, buttons, form fields, help text.
- Unit and section labels (`KM/H`, `KM`, `SEG`) use uppercase with expanded tracking.
- Numbers use the Argentine format: decimal comma (49,8 km/h, 14,82 km, 07:50:46,25).
- Both fonts must be bundled with the app and served locally. The app works offline, so no font may load from a remote service. Provide a system monospace and sans-serif fallback.

## Layout & Spacing

Portrait only, designed for a 390x844 phone viewport; a tablet in portrait uses the same single-column layout, centered. Respect iOS safe areas at the top and bottom. Margins are 16px, the base rhythm is 4px, and gaps between touch targets are at least 12px. The app shell uses dynamic viewport height (dvh) so collapsing browser toolbars do not obscure elements, and scrollable content always reserves bottom space equal to the tab bar height plus the bottom safe area so the lowest content scrolls fully into view above the fixed tab bar. Scrolled content must never appear under the iOS status bar (top safe area is covered with the background color).

Header on the two main tabs: the text "RR" (Space Mono, `primary`) on the left; two buttons on the right: a secondary text button with visible label "PREPARAR ETAPA" (transparent, 1px `outline` border, `on-surface` text, Chivo bold uppercase, minimum height 48px) and a 48px secondary icon button for help ("?"). No avatar and no logo image. Secondary screens (stage setup, calibration, help) have no tab bar: a 48px back button (‹), the screen title in `headline-md` uppercase, and an optional step counter on the right.

Main screen ("Carrera" tab), top to bottom:
1. **Time block**: time of day (label: HORA OFICIAL), and the main stopwatch with INICIAR/PARAR and REINICIAR buttons.
2. **Odometer dial**: one circular dial with instantaneous speed as the dominant number; the GPS status line directly below the dial; average speed and distance as digital readouts; manual distance adjustment with -1 (left of dial) and +1 (right of dial) buttons flanking the dial.
3. **Ahead/behind panel**: the largest element on the screen after the dial; see Components.
4. **Second stopwatch**: free use (splits or countdown), visually smaller than the main one.
5. **Bottom tab bar**: two tabs, "Carrera" and "Calculadora".

Secondary screens, all using the same system: stage setup, odometer calibration, calculator, short help.

## Elevation & Depth

Flat. Three tonal levels only: `background`, `surface-container` (cards and blocks), and `surface-container-high` (pressed states, neutral delta panel). Blocks have a 1px `outline-variant` border. No shadows or glows.

**Exception — Carrera odometer dial block**: uses `surface-container-lowest` background with no border (the dial face itself keeps its 1px `outline-variant` ring so it remains distinguishable). This file supersedes `docs/rr-pantallas-v1.html` for all styling of the Carrera odometer dial block.

## Shapes

- Blocks, cards, inputs: `rounded.DEFAULT` (4px).
- Dial: `rounded.full`.
- **-1/+1 side buttons** (exception): `rounded.lg` (8px), 56x56px, not `rounded.full`.

## Components

### Buttons
- **Primary action buttons** (INICIAR/PARAR, REINICIAR, APLICAR): filled with `primary-container`, text and icon in `on-primary-container`. Minimum touch target 64x64px.
- **-1/+1 distance adjustment buttons** (exception): placed on both sides of the odometer dial (left: -1, right: +1), vertically centered on the dial. Fill: `surface-container-high`; text: `on-surface`; shape: `rounded.lg`; font: monospaced bold (minimum 20px); size 56x56px (explicit exception to the 64px touch target rule for primary buttons). No border.
- **Secondary buttons**: transparent with a 1px `outline` border and `on-surface` text. Minimum height 48px.
- **Pressed state**: darker fill and a 2px downward shift. No haptic or vibration feedback (it is not available on iOS).

### Odometer dial
- Circular, flat dark face (`surface-container-lowest`) with a 1px `outline-variant` ring. Diameter is fluid and fills the available width between the two side buttons; it is deliberately larger than the rest of the UI cards. No fixed pixel size. No bezel, no glass reflection.
- Scale: a 270-degree clockwise sweep from 0 (lower left) to 120 (lower right). Brass (`secondary`) tick marks every 10 km/h, longer ones at 0, 40, 80 and 120. Ivory numerals only at 0, 40, 80 and 120, placed inside the ticks so they never touch the speed digits in the center.
- A single short marker in `primary` on the outer ring shows the current speed. No needle.
- Allowed ornaments (exception to the no-ornament rule): one faint 1px `outline-variant` ring just outside the dial face, and one thin dotted 1px `outline-variant` guide ring just inside the ticks. No gradients, glows, bezels, or shadows.
- Center: the instantaneous speed digits and **KM/H** (brass) below them. Both are rendered as SVG `<text>` elements in viewbox units so they scale proportionally with the dial diameter at every viewport size — no per-breakpoint duplication. The speed digits are vertically centered in the dial, occupying roughly half the dial's diameter in width for maximum legibility while maintaining at least 6px clearance from every numeral, tick, and ring at 320px width. KM/H sits directly below and clears the 0 and 120 numerals. While stopped (idle or after PARAR), instantaneous speed shows the no-data state ("--,-"). While running, if at least one valid reading has been received since start, a gap without readings (e.g. car stationary at a red light) shows "0,0" after the stale timeout (`STALE_SPEED_TIMEOUT_MS`, 5s) instead of "--,-". Below the dial: average speed (PROMEDIO) and distance (DISTANCIA) in `headline-lg`, each with its unit label. On the Carrera tab, the DISTANCIA readout shows 2 decimal places (e.g. 14,82 KM; placeholder "--,--") rounded to the nearest 10 meters, while calculations retain full precision.
- The -1 and +1 distance-adjustment buttons flank the dial on the left and right respectively, vertically centered on it.

### GPS status line
- Position: directly below the odometer dial, above the PROMEDIO and DISTANCIA readouts. Centered, Chivo, `body-md` (14px, line-height 20px). No icon, no background, no animation.
- Reserved height: always reserves one line of height (20px) so elements below never shift when text appears or disappears. At 320px width the permission-denied message may wrap to two lines; the block may grow only in this state.
- Styles by message kind:
  - "BUSCANDO GPS…": color `on-surface-variant`, normal weight (searching).
  - "GPS SIN PERMISO: activalo en Ajustes de iOS" and "GPS NO DISPONIBLE": color `on-surface` and Chivo bold (action needed). No accent colors.
- Visibility rules:
  - Idle (before first INICIAR, after PARAR, or after REINICIAR): empty.
  - Reader started and no valid reading received yet since start, or reader state is timeout: "BUSCANDO GPS…".
  - Once at least one valid reading has been received since the reader started, gaps without new readings (even longer than `STALE_SPEED_TIMEOUT_MS`) do NOT show "BUSCANDO GPS…"; the line stays empty. A reading suppressed as stationary jitter counts as valid for this purpose.
  - Reader state denied: "GPS SIN PERMISO: activalo en Ajustes de iOS".
  - Reader state unavailable: "GPS NO DISPONIBLE".
  - Receiving valid, fresh readings: empty.
- Color is never the only signal; this status line is text only.

### Ahead / Behind panel
- Full-width block with the signed difference in seconds (positive = ahead, negative = behind), plus a text label ("ADELANTADO", "ATRASADO", "EN TIEMPO" or "SIN DATOS"). The label is mandatory so the state is readable without color.
- Sizing depends on string length: delta values up to 5 characters including sign (e.g., `+12,3`, `-99,9`, `0,0`, `--,-`) use the nominal `display` size (56px) with 20px SEG unit at all supported viewports (320px+). Longer strings (e.g., `-123,4`) scale fluidly (48px at 320px up to 56px at 390px, with SEG unit scaling from 17px to 20px) to keep the entire value on a single line with at least 16px clearance from each side border. The state label scales fluidly by ~20% on narrow widths (16px to 20px).
- Dynamic drift with stale readings: while the race is running and readings are fresh, delta is computed from the exact physical timestamp of each GPS fix. When readings become stale (> 5s gap, e.g. car stopped at a light or control), the delta keeps running with the clock using the current elapsed race time and the last known distance (including manual adjustments and correction factor), drifting toward behind (ATRASADO) on each second. On PARAR the delta freezes; on REINICIAR it resets to SIN DATOS.
- Background: `status-ahead` (orange) when ahead, `status-behind` (red) when behind, `status-ontime` (green) when on time within the tolerance band around zero (default +/-0.10s) with the label EN TIEMPO. When there is no data, it uses the neutral background (`surface-container-high`) with "--,-" SEG and the label SIN DATOS (green is not used for no data).
- Below the state label, the `ASIGNADO` line lives inside a full-width dark inset strip using the same styling as the PROMEDIO/DISTANCIA readout boxes: `surface-container-lowest` background, 1px `outline-variant` border, 4px radius, no shadow or glow. Brass (`secondary`) cannot be placed directly on the status-color backgrounds (orange, green) because contrast is insufficient; the fixed dark strip solves this for all four states. Inside the strip: the word "ASIGNADO" in `label-lg` (13px bold Space Mono, expanded tracking) using `on-surface-variant`; the speed value in 16px Space Mono bold using `secondary` (brass); the unit "KM/H" in `label-lg` using `on-surface-variant`. When no stage speed is saved, the placeholder ("--,-") uses the same 16px brass style. The strip content and colors are identical in all four panel states (ahead, behind, on-time, no-data). The strip must not wrap at 320px width.
- Solid fill only, no glow.

### Stopwatches
- Main stopwatch: `headline-xl` digits (40px) for MM:SS,cc. When hours are displayed (HH:MM:SS,cc), the digits scale fluidly (34px at 320px up to 40px at 390px) to maintain at least 16px free space on each side within the card. Time of day (HORA OFICIAL) is formatted as HH:MM:SS (seconds truncated, no decimals) in `headline-lg` (26px), updating strictly once per second. Second stopwatch: `headline-lg`.
- Each has its own INICIAR/PARAR and REINICIAR buttons, using the same button spec.

### Tab bar
- Fixed at the bottom, above the iOS safe area, height at least 56px. Two tabs. The active tab is filled with `primary-container`; the inactive tab uses `on-surface-variant` text.

### Inputs
- Large numeric fields, `headline-lg` digits in Space Mono, a Chivo label above, 1px `outline` border. Use the numeric keypad on focus. One purpose per screen.

### Stage setup
- Title PREPARAR ETAPA. One field only: the assigned average speed of the stage in KM/H, with one short help line below it. APLICAR (primary) saves it and returns to the Carrera tab. A secondary button CALIBRAR ODÓMETRO opens the calibration flow.

### Odometer calibration (guided)
- 3 steps shown one at a time: enter the official distance of the control zone, read the distance measured by the app, review the resulting correction factor and tap APLICAR. A progress indicator ("1/3") is enough; no animation.
- Step 1/3: numeric field with the official distance in KM, then SIGUIENTE. Step 2/3: the measured distance in `headline-xl` brass digits, with INICIAR and PARAR buttons to measure the zone, then SIGUIENTE. Step 3/3: official distance, measured distance and the correction factor (4 decimals, `display` size, brass), then APLICAR.

### Calculator
- Standard large-button keypad (minimum 64px keys) with a single display line in `headline-xl`. Same button styles; no special skin.

### Help
- A short card with 4 numbered steps (numbers in brass Space Mono), followed by a warnings block in `body-md` with four short lines. Plain text, no illustrations. Copy is the one in the reference mockup.

## Excluded from v1

Digital roadbook and tulip cards, sub-stages, race history, user accounts, sounds or complex alerts, landscape layouts, haptic feedback, and any decorative texture or ornament.
