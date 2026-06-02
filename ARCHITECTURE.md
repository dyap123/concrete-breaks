# Orbital — Architecture & CS Principles

A plain-English tour of the computer-science ideas behind **Orbital** (the LACC
concrete-break logger). It's a single-page web app with no build step, a real-time
cloud database, and an LLM assistant. Below: what each layer is, and the principle
that makes it work.

---

## 1. The big picture

```
        BROWSER (the client)                         CLOUD
 ┌─────────────────────────────────┐        ┌──────────────────────────┐
 │  index.html                     │        │  Firebase Realtime DB    │
 │   ├─ React (UI components)      │ <────> │  (one shared JSON tree)  │
 │   ├─ window.fb  (DB bridge)─────┼───────►│  concrete-breaks/…       │
 │   ├─ window.claude (LLM bridge)─┼──┐     └──────────────────────────┘
 │   ├─ Chart.js / SheetJS / jsPDF │  │     ┌──────────────────────────┐
 │   └─ celebration / starfield    │  └────►│  MiniMax LLM API         │
 └─────────────────────────────────┘        └──────────────────────────┘
```

Everything the user sees runs **in their browser**. The browser talks to two remote
services: a **database** (to store/share data) and an **LLM** (to answer questions).
There is no server of our own — this is a **"serverless" / JAMstack** architecture:
static files on a CDN (GitHub Pages) + third-party APIs.

**Principle — separation of concerns.** Each layer has one job: React draws, `window.fb`
persists, `window.claude` reasons, Chart.js/SheetJS/jsPDF format outputs. They talk
through small, well-defined interfaces, so any one can change without breaking the rest.

---

## 2. Frontend principles

### 2a. Declarative UI (React)
Instead of writing "when X changes, find this DOM node and update it" (imperative), we
write a **function of state → UI**: `view`, `entries`, `users` go in, the screen comes
out. React figures out the minimal DOM changes via its **virtual DOM diff**. We never
touch the DOM by hand for app data.

> `the UI is a pure function of state` — change the state, the screen re-renders itself.

### 2b. Single source of truth + unidirectional data flow
All app state lives in `App.jsx` (`useState`). Data flows **down** via props; events flow
**up** via callbacks (`onSave`, `onPatch`, `onCommand`). A child never reaches "sideways"
into another child. This makes the app predictable: to understand any screen, you only
read the state that feeds it.

### 2c. Composition
The app is a tree of small components (`MixSelect`, `EntryForm`, `Leaderboard`,
`ChartCanvas`, `DateField`, `NodeOrb`). Each is reusable and testable in isolation.
`ChartCanvas` wraps Chart.js once; the Dashboard, Reports and Leaderboard all reuse it.

### 2d. Derived state, not duplicated state
We **store only raw inputs** (the cylinder break numbers, the mix's design strength) and
**compute everything else on the fly** — averages, %f'c, COV, pass/fail, rank. This is the
single most important data principle in the app:

> Never store what you can compute. Derived values can't drift out of sync.

`computeResults(entry, mix)` is a **pure function** (same inputs → same outputs, no side
effects) that turns a raw record into all its statistics. The old Excel sheet stored 70,000
formulas to do this; we do it in one function.

### 2e. Memoization (caching a computation)
`useMemo`/`useCallback` cache results so we don't recompute on every keystroke unless the
inputs actually changed. `ChartCanvas` keys its redraw on a hash of `{type,data,options}`
so the chart only rebuilds when the data really changes. This is **caching**: trade a little
memory to avoid repeating work.

### 2f. Performance: the render-loop trap (the dino game)
The Orbit Runner taught a classic lesson. The first version called React `setState` 60×/sec
(every animation frame) — forcing 60 full re-renders/sec and stutter. The fix used three
ideas:
- **Throttle state updates**: only `setState` when the *integer* score changes, not every frame.
- **Decouple animation from React**: run the game loop on `requestAnimationFrame` drawing to a
  raw `<canvas>`, not through React at all.
- **Delta-time stepping**: multiply motion by elapsed time per frame so speed is identical at
  30fps or 144fps (frame-rate independence).
- Drop per-frame `shadowBlur` (expensive). The celebration uses **transform-only CSS
  animations** (GPU-composited) and auto-cleans its DOM nodes — cheap by design.

### 2g. Progressive enhancement & graceful degradation
`prefers-reduced-motion` disables the starfield/particles. If the LLM key is missing, the
chat still renders and tells you why. Charts fall back to flat colors if `chartArea` isn't
ready. The app never hard-crashes from a missing optional piece.

---

## 3. Backend principles (the data layer)

### 3a. There is no backend of ours — and that's the design
We use **Firebase Realtime Database**: a single, cloud-hosted **JSON tree** every client
reads and writes directly. The "backend" is a managed service; our code is the client.

```
concrete-breaks/
  entries/{id}      → one pour record (all break ages in one document)
  users/{id}        → crew + points
  mixDesigns/{code} → editable mix library
  admixtures        → shared, editable list
  config/minimax_key
```

### 3b. The data model: one document per pour (denormalization)
A relational database would split this into `pours`, `cylinders`, `mixes` tables joined by
keys (**normalization** — no duplicated data). We deliberately **denormalize**: each entry
is one self-contained document holding all its cylinders and ages. Why? The access pattern is
"load all records, show them" — a document store makes that a single read with no joins.
NoSQL trades join-flexibility for read-simplicity, which fits this app.

> Normalize for write-integrity; denormalize for read-speed. Pick by how you'll *use* the data.

The mix library is the one place we **do** normalize: each entry stores a mix *code*, and the
mix's strength/slump live once in `mixDesigns`. That's a **foreign key** + **lookup** (exactly
the spreadsheet's `VLOOKUP`). Edit the mix once, every record reflects it.

### 3c. Real-time sync = the observer pattern
`fb.listen(path, cb)` **subscribes** to a path. When anyone changes it, Firebase **pushes**
the new value to every subscribed client, which calls `setState`, which re-renders. This is
the **observer/pub-sub pattern**: the UI doesn't poll ("any changes yet?"); it's *notified*.
That's why two phones see the same leaderboard live.

### 3d. Concurrency: atomic transactions
Two interns logging at the same moment both do "read points → add 1 → write." Done naively,
one overwrites the other (a **lost update / race condition**). `fb.inc` uses a Firebase
**transaction**: read-modify-write as one indivisible (**atomic**) operation the server
retries until consistent. Same idea as a database `UPDATE … SET x = x + 1`.

### 3e. Idempotent seeding
On first run the mix library/roster are empty, so the app seeds them — but only **if empty**
(`if (!v) fb.set(...)`). Running it again does nothing. An **idempotent** operation is safe to
repeat; every client can run the seed check on boot without creating duplicates.

### 3f. Eventual consistency & optimistic UI
The grid editor writes on blur and trusts the local edit immediately (**optimistic update**),
while the write propagates. All clients **converge** to the same state shortly after (**eventual
consistency**) — the trade-off real-time distributed systems make for responsiveness.

### 3g. Security model (and its honest limits)
The Firebase config and the manager PIN (`050103`) live in client code. So they are a
**friction gate, not cryptographic security** — anyone who reads the page source can see them.
That's an acceptable, deliberate choice for an internal tool. *True* security (auth, secret
keys, server-enforced rules) requires a trusted server or Firebase Security Rules — the line
between "client can be trusted" and "must be enforced server-side" is a core security principle.

---

## 4. The LLM layer (Alfred)

### 4a. The adapter pattern
The design prototype called a `window.claude.complete(prompt)` function. We didn't have that —
so we **wrote a shim** with the same signature that calls the MiniMax API instead. The rest of
the chat code never knew the difference. An **adapter** makes an incompatible service fit an
expected interface.

### 4b. Context injection (grounding / RAG-lite)
An LLM only knows its training data. To answer "where's pour PC-1?", we **inject the live data**
into the prompt: `buildContext(entries)` serializes recent records (mix, location, breaks) into
text the model reads. This is **retrieval-augmented generation** in miniature — the model
reasons over facts we hand it, not its memory. Rule in the prompt: *use only the data below*.

### 4c. Streaming & tool-use (navigation)
Alfred can **drive the app**: the prompt tells it to emit silent tokens like `<<go:reports>>`
or `<<log:O74C735K1>>`. After the reply we **parse** those out, strip them from the visible
text, and dispatch them to `onCommand`, which calls `setView`/`startEntry`. This is a tiny
**function-calling / tool-use** protocol — a structured command channel layered on top of free
text, so the model can *act*, not just talk.

---

## 5. Output generation (Reports)

Three formats, three principles:
- **CSV / "copy for sheet"** — the simplest possible interchange format (plain text, comma-
  separated). Universally importable. A reminder that the lowest-tech format is often the most
  portable.
- **Excel (SheetJS)** — we build an **abstract representation** (arrays of rows) and a library
  **serializes** it to the `.xlsx` binary format, matching the LACC workbook's exact columns and
  tabs. Same data → different *encoding*.
- **PDF (jsPDF)** — we render Chart.js charts to **off-screen canvases**, grab them as PNG data
  URLs, and lay them out on the page. The chart code is reused untouched; only the **output
  device** changed (screen → image → PDF). One computation, many renderings.

---

## 6. Why "no build step" matters

The app ships raw `.jsx` files and compiles them **in the browser** with Babel. No webpack, no
`npm run build`, no server. Trade-off: slightly slower first load (Babel runs client-side) for
near-zero deployment friction — `git push` and it's live on a CDN. For a small internal tool
shipped constantly, that **optimizes for iteration speed**, which is the right thing to optimize
when the team is one or two people moving fast.

---

## 7. The through-line

If you remember one idea from each layer:

| Layer | Principle |
|---|---|
| UI | The screen is a pure function of state. |
| Data in app | Store raw inputs; compute the rest. |
| Database | Subscribe and be notified; don't poll. |
| Concurrency | Make the read-modify-write atomic. |
| LLM | Ground it in injected context; let it act via parsed commands. |
| Output | One model of the data, many encodings (CSV/Excel/PDF). |
| Deployment | Optimize for iteration speed. |

Every feature in Orbital is one of these principles applied to concrete (pun intended).
