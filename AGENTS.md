# RR: project context for coding agents

## What RR is
RR is an offline PWA that assists the co-driver (navigator) of an amateur regularity rally. In regularity, the goal is not speed but holding the assigned average speed as exactly as possible. RR gives the co-driver two stopwatches, an odometer based on the phone GPS (with a manual correction factor), a clear ahead/behind indicator versus the assigned average speed, and a basic calculator.

Users are hobbyists who race once or twice a year. The co-driver glances at the screen between other tasks, in a moving car, under changing light. Simplicity and legibility come before anything else.

## Sources of truth (read these first)
- `DESIGN.md`: design tokens, typography, layout rules and component specs. Wins over everything else on visual matters.
- `docs/rr-pantallas-v1.html`: visual reference mockup of all 7 screens (open it in a browser). Reproduce layout and copy faithfully. Do not invent UI, labels, or features that are not in these two files.

## Hard requirements
- Works fully offline after the first load. Every asset, including fonts, is bundled and cached by the service worker. No runtime requests to remote services, no analytics, no accounts, no backend.
- Primary target is iOS: Safari and the installed home-screen PWA on iPhone, and iPad in portrait. Design and test for iOS first.
- Portrait only. Respect iOS safe areas.
- No haptics or vibration (not available on iOS). Pressed states are visual only.
- The app only works with the screen on and the app in the foreground. Request a screen wake lock where the browser supports it, and degrade silently where it does not.
- All user-facing text is Spanish (Argentina). Numbers use decimal comma (49,8 / 14,82 / 07:50:46,25; distance readout on Carrera tab uses 2 decimals).
- Never use color as the only signal; keep the text labels required by DESIGN.md.

## Scope
In v1: Carrera tab (time of day, main stopwatch, odometer dial, ahead/behind panel, second stopwatch), Calculadora tab (basic calculator), Preparar etapa, guided odometer calibration (3 steps), short Ayuda.
Out of v1: digital roadbook and tulip cards, sub-stages, race history, accounts, sounds or complex alerts, landscape, predefined formula solvers, any decorative texture.

## Domain logic
- Inputs: assigned average speed V (km/h) set in Preparar etapa; GPS positions; the main stopwatch.
- Corrected distance D = accumulated GPS distance x correction factor + manual adjustments.
- Manual adjustment: the -1 and +1 buttons change the corrected distance by one step. The step size is a single named constant, default 10 meters.
- Average speed = D / main stopwatch time.
- Ahead/behind delta in seconds = (D / V x 3600) - elapsed seconds. Positive means ahead, negative means behind. Show one decimal with sign. Neutral band is +/-0,10 s (a single named constant) and shows EN TIEMPO; otherwise ADELANTADO or ATRASADO. Refresh the delta about 10 times per second.
- Correction factor = official zone distance / distance measured by the app, rounded to 4 decimals, default 1,0000. It is persisted and applied to all subsequent GPS distance.
- Calibration step 2 measures GPS distance between INICIAR and PARAR over the control zone.
- GPS: use high accuracy watching. Ignore fixes with poor accuracy (named threshold constant) and avoid accumulating jitter when the car is nearly stopped. Instantaneous speed comes from the device speed value when available, otherwise derived from positions, with light smoothing. If GPS is unavailable or permission is denied, show a short Spanish message and "--,-" instead of fake numbers.
- Time: use a monotonic clock (performance.now) for stopwatches, never accumulate by counting timer ticks. Time of day comes from the system clock.
- Single owner of race state (`RaceSessionBridge` / `RaceProvider`): owns exactly one `RallyTracker` and one `GpsReader` instance, hosted above the screens in `App.tsx`. Navigating between Carrera, Preparar Etapa, Calculadora, and Ayuda never interrupts, stops, or resets a running race.
- Single start instant: when INICIAR is tapped, read the wall clock once (`Date.now()`) and use that single timestamp to start both the main stopwatch and the RallyTracker.
- GPS reader lifecycle: the reader starts inside the INICIAR tap handler (on user gesture), only when not active. It stays active during PARAR (so instantaneous speed on the dial continues updating while distance and delta stay frozen), and stops only on REINICIAR. Tapping INICIAR retries starting the reader if its state was denied, unavailable, or timeout.
- Dev-only simulator: query parameters `?sim=1` (or `?sim=true`), `&speed=<km/h>` (default 50), `&seed=<number>` (default 12345). Loaded via dev-guarded dynamic import, completely absent from production builds.
- Persist only: assigned average speed and correction factor (local storage on the device). Stopwatch state is not persisted in v1.

## Proposed tech stack
Vite + React + TypeScript (strict) + vite-plugin-pwa (service worker precaching). Plain CSS with custom properties generated from the DESIGN.md tokens in a single `tokens.css` (single source of truth, no duplicated values). Fonts self-hosted through npm packages (Space Mono 700, Chivo 400 and 700). No UI libraries. Vitest for the pure logic (distance, delta, correction factor, number and time formatting). Static hosting over HTTPS (required for GPS and service workers).

## Code conventions
- TypeScript strict, modern ES6+, small components, clear names.
- Pure logic lives in `src/logic/` with unit tests; UI components contain no formulas.
- One definition per constant and per formula; no duplicated logic.
- Explicit error handling for geolocation (denied, unavailable, timeout) and for storage failures.
- Icon-only buttons have an aria-label in Spanish.
- Do not add dependencies without need; report any you add.

## Working agreement
- Execute directly, without narrating the plan first.
- Do not add features, screens, copy or decoration beyond DESIGN.md and the mockup.
- If something is ambiguous, pick the simplest option consistent with the two sources of truth and mention it in the final report.
- Report once at the end: what was done, which files changed, and the build result.

## Phases (status)
- Phase 0: project scaffolding, tokens, app shell, offline/PWA setup, deploy pipeline. Pending.
- Phase 1: Carrera UI with real stopwatches and time of day, delta panel states. Done.
- Phase 2: Preparar etapa screen and stored stage speed (stored through storage module, consumed via useStageSpeed hook). Done.
- Phase 2b: Header text button (PREPARAR ETAPA) and ASIGNADO line in Ahead/Behind panel. Done. Note: DESIGN.md was updated and must be re-uploaded to the Claude Project.
- Phase 2c: Status colors for Ahead/Behind panel (ahead = orange, behind = red, on-time = green). Done. Note: DESIGN.md was updated and must be re-uploaded to the Claude Project.
- Phase 2d: iPhone layout fixes (bottom cut-off scroll padding, dvh) and enhanced ASIGNADO line readability. Done. Note: DESIGN.md was updated and must be re-uploaded to the Claude Project.
- Phase 2e: Content overlapping iOS status bar when scrolling (fixed status bar cover). Done. Note: DESIGN.md was updated and must be re-uploaded to the Claude Project (together with 2d changes).
- Phase 2f: ASIGNADO line moved into a dark inset strip (surface-container-lowest background, outline-variant border) with brass value on dark, so the label is legible on all four panel background colors. Done. Note: DESIGN.md was updated and must be re-uploaded to the Claude Project.
- Phase 3B: Pure logic for GPS readings, distance, speeds, and delta with unit tests. Done.
- Phase 3C-1: GPS logic wired to Carrera screen, GPS permission on first INICIAR, single start instant, GPS status line under dial, race state bridge above screens, dev-only simulator wiring. Done. Note: DESIGN.md was updated and must be re-uploaded to the Claude Project.
- Phase 3C-2: Wake lock and background/foreground handling. Pending.
- Phase 4: guided calibration. Pending.
- Phase 5: Calculadora. Pending.
- Phase 6: Ayuda, polish, full iOS device test. Pending.
