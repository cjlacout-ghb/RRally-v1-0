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
- All user-facing text is in Spanish (Argentina). Use short, plain words. Fixed labels: CARRERA and CALCULADORA (tabs), HOJA DE RUTA (tab), INICIAR, PARAR, REINICIAR, CONFIRMAR, APLICAR, SIGUIENTE, ADELANTADO, ATRASADO, EN TIEMPO, SIN DATOS, ASIGNADO, HORA OFICIAL, PROMEDIO, DISTANCIA, CRONÓMETRO 2, KM/H, KM, SEG, MARCAR, SALTAR, DESHACER, LISTO, ESTIPULADO, ANTERIOR, ACTUAL, MARCA, TIEMPO, SISTEMA DE CONTROL, CARGAR HOJA DE RUTA, SIN HOJA DE RUTA CARGADA, TEXTOS RÁPIDOS, MÁS RÁPIDO, MÁS LENTO, IGUAL. GPS status line messages: BUSCANDO GPS…, GPS SIN PERMISO: activalo en Ajustes de iOS, GPS NO DISPONIBLE. Screen titles: PREPARAR ETAPA, CALIBRAR ODÓMETRO, AYUDA, CARGAR HOJA.

## Colors

Dark-first. The structural backdrop is deep midnight navy (`background`). The color tokens in the frontmatter are the single source of truth.

- **Primary**: `primary` (`#b8c4ff`) is for text, icons, and strokes on dark surfaces. `primary-container` (`#0e4bef`, French racing blue) is for filled elements such as primary buttons (MARCAR, APLICAR, LISTO), the calculator equals key, and the selected control system button (no longer the active tab nor stopwatch buttons). Blue text on navy has poor contrast, so never use `primary-container` as a text color on dark surfaces.
- **Secondary**: `secondary` (`#eec14b`, brass) is for secondary numeric readouts, dial tick marks, and calibration values. It is also used as the fill of the next-stretch speed block on the Hoja de ruta screen, with `on-secondary` text.
- **Text**: `on-surface` for primary text, `on-surface-variant` for supporting text and labels.
- **Status colors (only for the ahead/behind indicator)**:
  In a regularity rally, both ahead and behind schedule are errors that penalize; only being on time is good.
  - `status-ahead` (orange, `#F97316`): ahead of schedule (alert). Text on it uses `on-status-ahead` (`#0a122a`).
  - `status-behind` (red, `#EF4444`): behind schedule. Text on it uses `on-status-behind` (`#FFFFFF`). **Exception**: `status-behind` is also used as the 2px border of the armed REINICIAR (CONFIRMAR) button on both Carrera and Hoja de ruta tabs, as a destructive-action cue. The CONFIRMAR text label remains the primary signal so color is never the only cue.
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

Header on the two main tabs: the text "RR" (Space Mono, `primary`) on the left; two buttons on the right: a secondary text button with visible label "PREPARAR ETAPA" (transparent, 1px `outline` border, `on-surface` text, Chivo bold uppercase, minimum height 48px; while setup is pending, the button uses a 2px border in `secondary` brass with compensated horizontal padding so box size and header layout do not shift, returning to the normal 1px outline border once setup is complete: in Carrera mode when an assigned speed is saved, in Hoja de ruta mode when at least one row has an assigned time; fits next to "RR" and the help button at 320px width) and a 48px secondary icon button for help ("?"). No avatar and no logo image. Secondary screens (stage setup, calibration, sheet loading, help) have no tab bar: a 48px back button (‹), the screen title in `headline-md` uppercase, and an optional step counter on the right.

### Control system selector
The co-driver chooses ONE control system in PREPARAR ETAPA before the race: CARRERA or HOJA DE RUTA. The choice persists on the device.
- The first tab of the tab bar is labeled CARRERA or HOJA DE RUTA according to the choice; the second tab stays CALCULADORA. No third tab.
- The selector is two large buttons side by side (min height 64px). The selected one is filled with `primary-container` and shows a check mark before its label; the other is a secondary (outlined) button. State is never color-only.
- The selector is disabled while the race stopwatch is running (same disabled styling and reserved-height message pattern as CALIBRAR ODÓMETRO, with the message "DETENÉ LA CARRERA PARA CAMBIAR EL SISTEMA").
- In HOJA DE RUTA mode: GPS is not used at all, the odometer dial and calibration are not shown, and PREPARAR ETAPA shows a card with the count of loaded rows ("38 DE 50 FILAS") and a secondary button CARGAR HOJA DE RUTA, plus APLICAR. In CARRERA mode PREPARAR ETAPA behaves exactly as today.

Main screen ("Carrera" tab), top to bottom:
1. **Time block**: time of day (label: HORA OFICIAL), and the main stopwatch with INICIAR/PARAR and REINICIAR buttons.
2. **Odometer dial**: one circular dial with instantaneous speed as the dominant number; the GPS status line directly below the dial; average speed and distance as digital readouts; manual distance adjustment with -1 (left of dial) and +1 (right of dial) buttons flanking the dial.
3. **Ahead/behind panel**: the largest element on the screen after the dial; see Components.
4. **Second stopwatch**: free use (splits or countdown), visually smaller than the main one.
5. **Bottom tab bar**: two tabs, "Carrera" and "Calculadora".

Main screen ("Hoja de ruta" tab), top to bottom:
1. **Header**: identical to the Carrera tab (RR, PREPARAR ETAPA with pending brass border when zero rows have an assigned time, help).
2. **Time block**: identical to Carrera (HORA OFICIAL, main stopwatch with hours format, INICIAR/PARAR and REINICIAR) with ONE exception for this screen only: PARAR/REINICIAR and INICIAR buttons have a minimum height of 48px instead of 64px (explicit exception to the 64px rule, limited to the roadbook screen), so that MARCAR is fully visible without scrolling on a 390x844 viewport. The main stopwatch starts at the car's start and is never stopped during the whole event; the roadbook compares against it. The second stopwatch sits below, reachable by scrolling, as in Carrera.
3. **Empty state shortcut** (only when zero rows have an assigned time): the deviation panel, next-stretch block, marks list, MARCAR, and SALTAR/DESHACER buttons are replaced by an empty-state card (`surface-container`, 1px `outline-variant` border, 4px radius) with text "SIN HOJA DE RUTA CARGADA" (Chivo bold, `on-surface`) and a primary button "CARGAR HOJA DE RUTA" (min height 64px) that directly opens the CARGAR HOJA screen. Tapping back from CARGAR HOJA when opened via this shortcut returns directly to the Hoja de ruta tab (not to PREPARAR ETAPA). As soon as at least one row has an assigned time, the normal Hoja de ruta layout returns.
4. **Accumulated deviation panel** (when at least one row has an assigned time): reuse the Ahead/Behind panel spec (same colors, labels ADELANTADO / ATRASADO / EN TIEMPO / SIN DATOS, same sizing and tolerance band, same dark inset strip). The value is the accumulated deviation of the last marked row: deviation = assigned time minus real time, computed from the real time as displayed (rounded to tenths of a second), shown in seconds with one decimal; positive means ahead (ADELANTADO), negative means behind (ATRASADO), same convention as Carrera. The strip shows ASIGNADO with the organization's speed for the stretch just run.
5. **Next-stretch speed block**: a full-width block filled with `secondary`, all text inside the block in `on-secondary` (including the label "PRÓXIMO TRAMO · HASTA MARCA N", the large "IR A xx,x KM/H" speed, the arrow label "▲ MÁS RÁPIDO" / "▼ MÁS LENTO" / "IGUAL", the small "ORG. xx,x" text, the "IR A --,- KM/H" no-data state, and the "EXIGENTE: +10% SOBRE LA ORGANIZACIÓN" warning line). Left: label "PRÓXIMO TRAMO · HASTA MARCA N" and the speed to drive in large Space Mono, with the form "IR A 65,9 KM/H" (the absolute speed, never a difference). Right: a text label with an arrow ("▲ MÁS RÁPIDO", "▼ MÁS LENTO" or "IGUAL") and the organization's speed in small text "ORG. 61,0". The arrow plus label ensures color is never the only signal. When there is no data, show "IR A --,- KM/H". Demanding speed warning: when the speed to drive exceeds the organization's speed by more than 10%, show one extra text line inside the block: "EXIGENTE: +10% SOBRE LA ORGANIZACIÓN" (Chivo bold, reserved height so nothing shifts).
6. **Marks list**: only three cards, ANTERIOR (dimmed `surface-container-low`, shows real time and its deviation on the right), ACTUAL (`surface-container-high` with a 2px `primary` border; shows the assigned time ESTIPULADO in brass Space Mono, 22px) and SIGUIENTE (dimmed, shows assigned time). Each card shows the mark number and text.
7. **MARCAR + SALTAR/DESHACER**: MARCAR is a full-width primary button, min height 72px, label font size 26px. One tap captures the main stopwatch time for the ACTUAL row and advances to the next row. Below MARCAR, two secondary buttons side by side, min height 48px: SALTAR (leaves the ACTUAL row without a real time and advances) and DESHACER (removes the last mark or skip and goes back one row).
8. **Tab bar**: HOJA DE RUTA active.

Secondary screens, all using the same system: stage setup, odometer calibration, sheet loading ("Cargar hoja"), calculator, short help.

### Persistence
- In Carrera mode: assigned average speed and correction factor are saved in localStorage.
- In Hoja de ruta mode:
  - The sheet is saved on the device and is NOT cleared by REINICIAR.
  - The race state is saved in localStorage: stopwatch start instant, real marks and skips, current row, and whether the stopwatch is running. It is written only when something happens (start, stop, mark, skip, undo, reset), never every tick. On reopening the app, the stopwatch is rebuilt from the start instant. REINICIAR clears the race state but keeps the loaded sheet.

## Elevation & Depth

Flat. Three tonal levels only: `background`, `surface-container` (cards and blocks), and `surface-container-high` (pressed states, neutral delta panel). Blocks have a 1px `outline-variant` border. No shadows or glows.

**Exception — Carrera odometer dial block**: uses `surface-container-lowest` background with no border (the dial face itself keeps its 1px `outline-variant` ring so it remains distinguishable). This file supersedes `docs/rr-pantallas-v1.html` for all styling of the Carrera odometer dial block.

## Shapes

- Blocks, cards, inputs: `rounded.DEFAULT` (4px).
- Dial: `rounded.full`.
- **-1/+1 side buttons** (exception): `rounded.lg` (8px), 56x56px, not `rounded.full`.

## Components

### Buttons
- **Primary action buttons** (MARCAR, APLICAR, LISTO): filled with `primary-container`, text and icon in `on-primary-container`. Minimum touch target 64x64px (MARCAR has min height 72px; calculator equals key keeps its own spec).
- **Stopwatch buttons** (INICIAR/PARAR and REINICIAR of the main stopwatch and CRONÓMETRO 2 on both Carrera and Hoja de ruta tabs): fill `surface-container-high`, text `on-surface`, 1px `outline` border. Same radius (`rounded.DEFAULT`, 4px), font (Chivo bold uppercase), and minimum heights (64px, with the 48px exception on the Hoja de ruta main stopwatch). Pressed state: darker fill and 2px downward shift.
- **-1/+1 distance adjustment buttons** (exception): placed on both sides of the odometer dial (left: -1, right: +1), vertically centered on the dial. Fill: `surface-container-high`; text: `on-surface`; shape: `rounded.lg`; font: monospaced bold (minimum 20px); size 56x56px (explicit exception to the 64px touch target rule for primary buttons). No border.
- **Roadbook screen time block buttons** (exception): on the Hoja de ruta screen only, PARAR/REINICIAR and INICIAR buttons have a minimum height of 48px instead of 64px (explicit exception to the 64px rule, limited to the roadbook screen), so that MARCAR is fully visible without scrolling on a 390x844 viewport.
- **MARCAR button**: full-width primary button, min height 72px, label font size 26px. One tap captures the main stopwatch time for the ACTUAL row and advances to the next row.
- **Secondary buttons**: transparent with a 1px `outline` border and `on-surface` text. Minimum height 48px (exceptions: quick-text buttons have minimum height 44px; "+ 10 FILAS" and the control system selector buttons have minimum height 64px).
- **SALTAR and DESHACER buttons**: two secondary buttons side by side below MARCAR, minimum height 48px.
- **Pressed state**: darker fill and a 2px downward shift. No haptic or vibration feedback (it is not available on iOS).

### Odometer dial
- Circular, flat dark face (`surface-container-lowest`) with a 1px `outline-variant` ring. Diameter is fluid and fills the available width between the two side buttons; it is deliberately larger than the rest of the UI cards. No fixed pixel size. No bezel, no glass reflection.
- Scale: a 270-degree clockwise sweep from 0 (lower left) to 120 (lower right). Brass (`secondary`) tick marks every 10 km/h, longer ones at 0, 40, 80 and 120. Ivory numerals only at 0, 40, 80 and 120, placed inside the ticks so they never touch the speed digits in the center.
- A single short marker in `primary` on the outer ring shows the current speed. No needle.
- Allowed ornaments (exception to the no-ornament rule): one faint 1px `outline-variant` ring just outside the dial face, and one thin dotted 1px `outline-variant` guide ring just inside the ticks. No gradients, glows, bezels, or shadows.
- Center: the instantaneous speed digits and **KM/H** (brass) below them. Both are rendered as SVG `<text>` elements in viewbox units so they scale proportionally with the dial diameter at every viewport size — no per-breakpoint duplication. The speed digits are vertically centered in the dial, occupying roughly half the dial's diameter in width for maximum legibility while maintaining at least 6px clearance from every numeral, tick, and ring at 320px width. KM/H sits directly below and clears the 0 and 120 numerals. While stopped (idle or after PARAR), instantaneous speed shows the no-data state ("--,-"). While running, if at least one valid reading has been received since start, a gap without readings (e.g. car stationary at a red light) shows "0,0" after the stale timeout (`STALE_SPEED_TIMEOUT_MS`, 5s) instead of "--,-". Below the dial: average speed (PROMEDIO) and distance (DISTANCIA) in `headline-lg`, each with its unit label. On the Carrera tab, the DISTANCIA readout shows 2 decimal places (e.g. 14,82 KM; placeholder "--,--") rounded to the nearest 10 meters, while calculations retain full precision.
- The -1 and +1 distance-adjustment buttons flank the dial on the left and right respectively, vertically centered on it.

### GPS status line
- Position: directly below the odometer dial, above the PROMEDIO and DISTANCIA readouts on the Carrera screen, and directly below the measured distance readout on calibration step 2/3. Centered, Chivo, `body-md` (14px, line-height 20px). No icon, no background, no animation.
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
- Each has its own INICIAR/PARAR and REINICIAR buttons, using the stopwatch button spec.
- **Two-step REINICIAR (main stopwatch only — Carrera and Hoja de ruta tabs)**: "Has something to lose" means the main stopwatch elapsed time is greater than zero, or (Hoja de ruta only) at least one real mark or skip exists in the race state. If there is nothing to lose, the first tap resets immediately as today. If there is something to lose, the first tap *arms* the button: the label changes from REINICIAR to CONFIRMAR and the button gains a 2px `status-behind` (red) border as a destructive-action cue — the CONFIRMAR text label is the primary signal, so color is never the only cue. The button keeps exactly the same size and position; no layout shift. While armed, a second tap executes the reset. The armed state expires automatically after 4 seconds and returns the button to REINICIAR without resetting. It also disarms immediately if the user taps any other control (INICIAR/PARAR, MARCAR, SALTAR, DESHACER) or if the tab becomes hidden; the timer is cleaned up on unmount. Accessibility: the button's accessible name changes with its label, and the state change is announced via an `aria-live="polite"` region that adds no visible text or height. The armed state is local UI state only: never persisted in localStorage and never written to the race state.
- **CRONÓMETRO 2 (both tabs)**: resets immediately on the first tap — no two-step confirmation.

### Tab bar
- Fixed at the bottom, above the iOS safe area, height at least 56px. Two tabs. The first tab is labeled CARRERA or HOJA DE RUTA according to the chosen control system; the second tab stays CALCULADORA. Both tabs use a dark neutral look; no tab is filled with `primary-container` anymore. The active tab has fill `surface-container-high`, text `on-surface` in bold, plus a 2px `primary` line along its top edge (shape cue so state is never color-only). The inactive tab has no fill (same as the tab bar background), text `on-surface-variant`, and regular weight.

### Inputs
- Large numeric fields, `headline-lg` digits in Space Mono, a Chivo label above, 1px `outline` border. Use the numeric keypad on focus. One purpose per screen.

### Stage setup
- Title PREPARAR ETAPA.
- Control system selector (SISTEMA DE CONTROL): two large buttons side by side (min height 64px) to choose between CARRERA and HOJA DE RUTA. The selected button is filled with `primary-container` and shows a check mark before its label; the other is a secondary (outlined) button. State is never color-only. While the race stopwatch is running, the selector is disabled (same disabled styling and reserved-height message pattern as CALIBRAR ODÓMETRO, with the message "DETENÉ LA CARRERA PARA CAMBIAR EL SISTEMA" in Chivo bold, `on-surface`, `body-md` directly below it).
- In CARRERA mode: one field only: the assigned average speed of the stage in KM/H, with one short help line below it. APLICAR (primary) saves it and returns to the Carrera tab. A secondary button CALIBRAR ODÓMETRO opens the calibration flow. When the race stopwatch is running, CALIBRAR ODÓMETRO is shown in a visibly disabled style (transparent, 1px `outline-variant` border, `on-surface-variant` text, distinguishable without color alone) and the message "DETENÉ LA CARRERA PARA CALIBRAR" is shown directly below it in Chivo bold, `on-surface`, `body-md` (with reserved height so elements never shift).
- In HOJA DE RUTA mode: GPS is not used at all, the odometer dial and calibration are not shown, and PREPARAR ETAPA shows a card with the count of loaded rows ("38 DE 50 FILAS") and a secondary button CARGAR HOJA DE RUTA, plus APLICAR.

### Sheet loading ("Cargar hoja")
- Secondary screen with back button, title CARGAR HOJA and a counter of loaded rows on the right in brass Space Mono, defined as "N DE M FILAS" where N is the count of rows with an assigned time and M is the total rows in the sheet (e.g. "0 DE 50 FILAS", "38 DE 50 FILAS").
- One sheet only, starting with 50 empty rows. A button "+ 10 FILAS" (secondary, min height 64px) sits as the last item of the list and scrolls with the rows to add more rows up to the maximum.
- Column header: N°, MARCA, TIEMPO, KM/H. Each row is a card (`surface-container`, 1px `outline-variant` border, 4px radius, height 52px) with: row number, mark text, assigned cumulative time (H:MM:SS, numeric keypad, digits fill from the right like a timer), and speed in KM/H.
- Mark text: free short text (updates live as the user types, with no extra confirm step), or one of the quick-text buttons (AUTOLARGADA, AUTOCONTROL, NEUTRALIZACIÓN, CONTROL HORARIO, FIN) shown as secondary buttons (min height 44px).
- While the MARCA field of a row is being edited, the TEXTOS RÁPIDOS panel (the five quick-text buttons plus the free-text field) is pinned to the bottom of the screen, directly above the LISTO button. It is hidden when no MARCA is being edited (e.g. while editing time or speed, or when nothing is selected).
- The list scrolls independently above the pinned area. Tapping a row never scrolls the list to the end; it performs only the minimum scroll needed to keep the edited row visible above the pinned panel. Applying a quick text does not change the scroll position, keeps the row selected, and keeps the panel visible so the user can tap another row next.
- Speed: optional. A blank speed inherits the previous row's speed. An inherited value is shown dimmed (`on-surface-variant`); an explicitly typed one is shown in brass. A speed applies from that mark until the next mark.
- The row being edited has a 2px `primary` border. Empty times show "-:--:--" and empty speeds "--".
- Bottom actions: LISTO (primary, min height 64px) stays pinned at the very bottom. The pinned area respects the iOS bottom safe area and keeps at least 12px between touch targets.
- The sheet is saved on the device and is NOT cleared by REINICIAR.

### Odometer calibration (guided)
- 3 steps shown one at a time: enter the official distance of the control zone, read the distance measured by the app, review the resulting correction factor and tap APLICAR. A progress indicator ("1/3", "2/3", "3/3") on the right of the header; no animation.
- Step 1/3: numeric field with the official distance in KM (accepts decimal comma or dot), then SIGUIENTE (disabled until a valid distance greater than zero is entered). The typed value stays in memory when going back from step 2.
- Step 2/3: the measured distance in `headline-xl` brass digits with 3 decimals and unit KM (placeholder "--,---" before first measurement), with INICIAR and PARAR buttons to measure the zone. The GPS status line appears directly below the measured distance readout and follows the exact same visibility rules and styles as on the Carrera screen. SIGUIENTE is disabled until the meter has been stopped with a measured distance of at least 0.100 km (100 m); if stopped below this minimum, "La distancia medida es insuficiente (mínimo 100 m)." is shown in Chivo bold, `on-surface`, `body-md`.
- Step 3/3: official distance, measured distance (both with 3 decimals in KM), and the correction factor (4 decimals, `display` size, brass), then APLICAR. If the factor is outside the sane range (0.8000 to 1.2000) or invalid, the Spanish error message is displayed in Chivo bold, `on-surface`, `body-md` and APLICAR is disabled so an invalid factor can never be applied.

### Calculator
- **Display**: single display line in `headline-xl` (Space Mono, 40px), right-aligned inside a card (`surface-container`, 1px `outline-variant` border, `rounded.DEFAULT`). Never wraps or overflows at 320px width, reserving at least 16px clearance on each side inside the card.
- **Message line**: directly below the display card, in Chivo bold, `on-surface`, `body-md` (14px, line-height 20px). Always reserves one line of height (20px) so nothing shifts when it appears or disappears. Error messages: "No se puede dividir por cero" and "Resultado demasiado grande".
- **Keypad layout**: 4 columns, 5 rows, every key at least 64px tall and wide, gaps of at least 12px (`gutter`). Row 1: C, backspace (⌫), +/-, divide (÷). Row 2: 7, 8, 9, multiply (×). Row 3: 4, 5, 6, subtract (-). Row 4: 1, 2, 3, add (+). Row 5: 0 (spanning two columns), decimal comma (,), equals (=).
- **Key styles**: equals key is filled with `primary-container` with `on-primary-container` text; all other keys use `surface-container-high` fill with `on-surface` text, `rounded.DEFAULT` (4px), Space Mono bold for digits and symbols (24px for digits and other keys; operator glyphs +, -, ×, ÷ are roughly 30% larger at 32px, visually centered). Pressed state: darker fill and 2px downward shift, no haptics.
- **Pending operator cue**: pending operator key shows a 2px `primary` border while pending (shape cue, not color alone).
- **Accessibility**: every key has a Spanish aria-label ("Borrar todo", "Borrar último dígito", "Cambiar signo", "Dividir", "Multiplicar", "Restar", "Sumar", "Igual", "Coma decimal", and digit names).

### Help
- A short card with 4 numbered steps (numbers in brass Space Mono), followed by a warnings block in `body-md` with four short lines. Plain text, no illustrations. Copy is the one in the reference mockup.

## Excluded from v1

The roadbook sheet is no longer excluded from v1 (supported via the "Hoja de ruta" control system and "Cargar hoja" screen). Still excluded from v1: tulip cards, sub-stages, any map/route rendering, race history, user accounts, sounds or complex alerts, landscape layouts, haptic feedback, and any decorative texture or ornament.
