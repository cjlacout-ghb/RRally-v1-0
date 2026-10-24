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
  status-ahead: '#10B981'
  on-status-ahead: '#0a122a'
  status-behind: '#EF4444'
  on-status-behind: '#FFFFFF'
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
- No textures, gradients, bezels, rivets, knurling, glows, or decorative shadows.
- Depth is expressed only with tonal surface layers and 1px borders.
- Every screen has one clear primary element; nothing decorative competes with the numbers.
- Never use color as the only signal. Always pair it with a text label.
- All user-facing text is in Spanish (Argentina). Use short, plain words. Fixed labels: CARRERA and CALCULADORA (tabs), INICIAR, PARAR, REINICIAR, APLICAR, SIGUIENTE, ADELANTADO, ATRASADO, EN TIEMPO, HORA, PROMEDIO, DISTANCIA, CRONÓMETRO 2, KM/H, KM, SEG. Screen titles: PREPARAR ETAPA, CALIBRAR ODÓMETRO, AYUDA.

## Colors

Dark-first. The structural backdrop is deep midnight navy (`background`). The color tokens in the frontmatter are the single source of truth.

- **Primary**: `primary` (`#b8c4ff`) is for text, icons, and strokes on dark surfaces. `primary-container` (`#0e4bef`, French racing blue) is for filled elements such as buttons and the active tab. Blue text on navy has poor contrast, so never use `primary-container` as a text color on dark surfaces.
- **Secondary**: `secondary` (`#eec14b`, brass) is for secondary numeric readouts, dial tick marks, and calibration values.
- **Text**: `on-surface` for primary text, `on-surface-variant` for supporting text and labels.
- **Status colors (only for the ahead/behind indicator)**:
  - `status-ahead` (emerald): ahead of schedule. Text on it uses `on-status-ahead`.
  - `status-behind` (red): behind schedule. Text on it uses `on-status-behind`.
  - Neutral state (within the tolerance band) uses `surface-container-high` with `on-surface` text.
- Ivory (`#FBF7EE`) is reserved for numerals and tick marks on the odometer dial. Do not use large ivory surfaces, to avoid glare.

## Typography

- **Space Mono**: every number that updates (stopwatches, time of day, speeds, distance, delta). Monospaced digits prevent layout jitter.
- **Chivo**: labels, buttons, form fields, help text.
- Unit and section labels (`KM/H`, `KM`, `SEG`) use uppercase with expanded tracking.
- Numbers use the Argentine format: decimal comma (49,8 km/h, 14,820 km, 07:50:46,7).
- Both fonts must be bundled with the app and served locally. The app works offline, so no font may load from a remote service. Provide a system monospace and sans-serif fallback.

## Layout & Spacing

Portrait only, designed for a 390x844 phone viewport; a tablet in portrait uses the same single-column layout, centered. Respect iOS safe areas at the top and bottom. Margins are 16px, the base rhythm is 4px, and gaps between touch targets are at least 12px.

Header on the two main tabs: the text "RR" (Space Mono, `primary`) on the left; two 48px secondary icon buttons on the right: stage setup (sliders icon) and help ("?"). No avatar and no logo image. Secondary screens (stage setup, calibration, help) have no tab bar: a 48px back button (‹), the screen title in `headline-md` uppercase, and an optional step counter on the right.

Main screen ("Carrera" tab), top to bottom:
1. **Time block**: time of day, and the main stopwatch with INICIAR/PARAR and REINICIAR buttons.
2. **Odometer dial**: one circular dial with instantaneous speed as the dominant number; average speed and distance as digital readouts; manual distance adjustment with -1 and +1 buttons.
3. **Ahead/behind panel**: the largest element on the screen after the dial; see Components.
4. **Second stopwatch**: free use (splits or countdown), visually smaller than the main one.
5. **Bottom tab bar**: two tabs, "Carrera" and "Calculadora".

Secondary screens, all using the same system: stage setup, odometer calibration, calculator, short help.

## Elevation & Depth

Flat. Three tonal levels only: `background`, `surface-container` (cards and blocks), and `surface-container-high` (pressed states, neutral delta panel). Blocks have a 1px `outline-variant` border. No shadows or glows.

## Shapes

- Blocks, cards, inputs: `rounded.DEFAULT` (4px).
- Dial and round buttons: `rounded.full`.

## Components

### Buttons
- **Primary action buttons** (INICIAR/PARAR, REINICIAR, -1, +1, APLICAR): filled with `primary-container`, text and icon in `on-primary-container`. Minimum touch target 64x64px.
- **Secondary buttons**: transparent with a 1px `outline` border and `on-surface` text. Minimum height 48px.
- **Pressed state**: darker fill and a 2px downward shift. No haptic or vibration feedback (it is not available on iOS).

### Odometer dial
- Circular, flat dark face (`surface-container-lowest`) with a 1px `outline` ring, about 168px in diameter. No bezel, no glass reflection.
- Scale: a 270-degree clockwise sweep from 0 (lower left) to 120 (lower right). Brass (`secondary`) tick marks every 10 km/h, longer ones at 0, 40, 80 and 120. Ivory numerals only at 0, 40, 80 and 120, placed inside the ticks so they never touch the speed digits in the center.
- A single short marker in `primary` on the outer ring shows the current speed. No needle.
- Center: instantaneous speed in `display` size. Below the dial: average speed and distance in `headline-lg`, each with its unit label.
- -1 and +1 buttons sit directly under the distance readout.

### Ahead / Behind panel
- Full-width block with the signed difference in seconds (positive = ahead, negative = behind) in `display` size, plus a text label ("ADELANTADO", "ATRASADO" or "EN TIEMPO"). The label is mandatory so the state is readable without color.
- Background: `status-ahead` when ahead, `status-behind` when behind, neutral within a small tolerance band around zero (default +/-0.10s).
- Solid fill only, no glow.

### Stopwatches
- Main stopwatch: `headline-xl` digits, format MM:SS,cc (hours when needed). Second stopwatch: `headline-lg`.
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
