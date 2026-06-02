# Orbital — Concrete Break Logger

Deep-space-themed app for concrete QA interns to log cylinder break-test results against a
chosen **mix design**, with live derived metrics and a shared **crew leaderboard**. Replaces
the 21-tab "HDH Concrete Break Result Matrix" spreadsheet. LA Convention Center.

**Live:** https://dyap123.github.io/concrete-breaks/

## Stack
- **React 18 + Babel standalone** (in-browser, no build step) — design from the Claude-design
  "Orbital" handoff, recreated on a real backend. Static GitHub Pages deploy.
- **Firebase Realtime DB** (shared project `gen-lang-client-0119642855`), namespaced under
  `concrete-breaks/`. The bridge `window.fb` (in `index.html`) exposes
  `listen/set/update/remove/get/inc` (+ root variants). This makes the leaderboard, records,
  and roster **shared across the team** — the handoff's "production" note.
- **Mission Control chat** uses MiniMax via a `window.claude.complete` shim in `index.html`
  (Anthropic-compatible endpoint, key shared at ROOT `config/minimax_key` — same as CUP).

## Data model (`concrete-breaks/…`)
```
entries/{id}      — one full pour record (all break ages 7/28/56/90 in one doc),
                    plus pour id/fresh-properties/admixtures/flags, loggedBy + created
users/{id}        — crew roster + points: { name, role:'manager'|'intern', points, goat, joined }
customMixes/{code}— manager-added mixes (built-ins live in assets/data.js)
config/minimax_key (ROOT, shared) — Mission Control key
```
Points are incremented atomically via `fb.inc` (transaction) so concurrent logging is safe.

## Mix designs (color-coded by strength)
Built-ins in `assets/data.js` are the project Drive-folder mixes: **O80D739K1**, **O74C735K1**
(8000 psi pile caps), **V71C746T1** (5000 psi deck), **S80S662L2**, **S30S4AHL2** (slurries).
Each mix's accent hue is derived from its design strength via `accentForStrength(fc)`
(8000=magenta · 6000=violet · 5000=blue · 4000=cyan · 3000=green · slurry=amber), so colour
reads as strength tier across cards, chips, and glows.

## Calculations (`assets/data.js`)
avg / range / sample-stdev / COV, **ASTM C39 within-test verdict** (≤9.4% Acceptable, ≤14%
Marginal, else Review), elapsed batch→sample hours, 7→28 / 7→56 strength gains, %f'c
(≥100 green · ≥85 amber · else red), met/below design strength.

## Files
- `index.html` — shell: theme tokens, starfield/nebulae, **Firebase + MiniMax bridge**, React/Babel load order.
- `assets/data.js` — source of truth: mixes, option lists, calc helpers, blankEntry, CSV, ranks. **Backend-agnostic.**
- `assets/App.jsx` — shell, routing, **Firebase-backed state**, points, export, ⌘K palette.
- `assets/{Auth,MixSelect,EntryForm,Leaderboard,Chat,Alfred,Dino}.jsx` — views (pure UI, prop-driven).

## Crew / Danzel
Danzel is seeded once as the fixed **mission manager + GOAT** if the roster is empty. Interns
add themselves at the sign-in gate; each new record = **+1 point**, ranks Cadet → Admiral.

## Local dev
```sh
cd ~/concrete-breaks && python3 -m http.server 8477   # → http://localhost:8477
```

## Roadmap (from the handoff)
- PDF/mix-design **auto-extraction** → pre-fill `blankEntry` (Drive MCP already reads these PDFs).
- Real auth (the gate is a roster picker).
- Knowledge-base-indexed Mission Control (currently session records + concrete domain knowledge).
- Point bonuses (e.g. completing a 56-day set) — centralize in `saveEntry`.

> Note: the previous vanilla single-file build (Chart.js dashboard, xlsx/PDF export) was
> replaced by this Orbital design. Those export/chart features can be re-added on top of the
> same Firebase model if wanted.
