# Break Lab — Concrete Cylinder Break Tracker

Single-file GitHub Pages app for interns to log concrete cylinder break-test results,
replacing the 21-tab "HDH Concrete Break Result Matrix" spreadsheet. LA Convention Center.

**Live:** https://dyap123.github.io/concrete-breaks/

## What it does
- **Log flow**: pick intern → pick mix design → pick/create pour → enter up to 3
  cylinder breaks per test age (7/28/56/90). Design strength + target slump
  **auto-populate** from the Mix Designs table (the VLOOKUP replacement). Live
  avg + %-of-f'c with pass/fail coloring.
- **Dashboard**: Chart.js — strength-over-time, design-vs-actual (28d), slump
  target-vs-actual, 28-day pass/fail donut. Each chart has an **Export PNG** button.
- **Leaderboard**: ranks interns by data logged (points). All-time + this-week. Every
  submit fires a CPU-cheap particle celebration.
- **Export**: on-demand **.xlsx** (all data or per-mix; opens in Google Sheets) and a
  formatted **.pdf** break report (stats + charts) per-mix or overall.
- **Mix Designs / Roster**: manager admin tabs.
- **Dino game** (left sidebar) and **Alfred AI chat** (right sidebar, MiniMax).

## Architecture
- One `index.html`, zero build. CDN: Firebase 10.12, Chart.js 4, SheetJS, jsPDF + autotable.
- **Firebase Realtime DB** (shared project `gen-lang-client-0119642855`), namespaced
  under `concrete-breaks/`. Data tree: `interns/ mixes/ pours/ breaks/ scores/ config/`.
- Mix designs are **seeded** from the project Drive folder mixes (O80D739K1, O74C735K1,
  V71C746T1, S80S662L2, S30S4AHL2) on first run; managers edit them in the Mixes tab.

## Alfred (MiniMax)
- Client-side. Key resolution order: `config/minimax_key` in Firebase → `localStorage`
  → `prompt()`. To set it for everyone, write the key to `concrete-breaks/config/minimax_key`
  in the Firebase console. Endpoint: `https://api.minimax.io/anthropic/v1/messages`
  (Anthropic-compatible, streaming). Model in `ALF_MODEL`.
- Note: the key is visible to anyone who views source — acceptable for an internal tool only.

## Local dev
```sh
cd ~/concrete-breaks && python3 -m http.server 8477   # → http://localhost:8477
```

## Deploy
Root-branch GitHub Pages. Push to `main`; Pages serves `/index.html`.

## Roadmap
- PDF auto-extract: interns upload the break report / mix PDF and the app pre-fills the
  form. The data model (mixes/pours/breaks) is ready for it.
- Optional Apps Script for live two-way Google Sheet sync (xlsx export covers v1).
