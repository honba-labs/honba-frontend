# Multi-user portfolio layouts and modules: plan

Status: agreed design, not yet implemented. Backend work happens in the sibling `honba` repo (approved).

## Decisions (confirmed)
- **Storage:** backend (`honba serve`), one profile per user.
- **Identity:** backend bearer tokens. A user is a token's `token_id` (`crates/honba-api-rest/src/auth.rs`). With no tokens file, everything runs as a single `default` user.
- **Authorization:** any valid token manages **its own** profile. No new scope is required, and a token can never read or write another token's profile.
- **Module:** a named **collection of sources** (data sources and feeds, for example a broker adapter, a symbol list, a bars directory). A module is not a UI panel. A layout can reference modules by id.
- **Profile contents:**
  - Workbench grid and the symbol and timeframe in each pane.
  - Module definitions and which modules are enabled.
  - Watchlists and shortlisted symbols.
  - Preferences and theme (market country, theme, indicators).

## Backend (honba, Rust, `honba-api-rest`)
1. Profile store: one JSON file per `token_id` in a profiles directory (new `--profiles-dir` flag, default next to the journals dir). The `default` user is used when auth is off. Writes are atomic (write to a temp file, then rename). User ids are sanitized to prevent path traversal.
2. Routes, each resolving the user from the validated token:
   - `GET /profile` and `PUT /profile` for the whole profile.
   - `GET /profile/layouts`, and `PUT` / `DELETE /profile/layouts/{name}` for named layouts.
   - `GET /profile/modules`, and `PUT` / `DELETE /profile/modules/{id}`.
3. Concurrency: each profile carries a `revision`. `PUT` requires the current revision and answers 409 on a mismatch.
4. Add the routes to the `auth.rs` route table as "any valid token". Add them to the OpenAPI and codegen endpoint lists.
5. Tests in the existing style: per-user isolation, 409 on a stale revision, default user with auth off, and rejection of a hostile `token_id`.

## Codegen
`npm run codegen` (runs `make -C ../honba schema client`) to regenerate `src/core/api/generated/client.ts`.

## Frontend (honba-frontend)
1. `profile-store`: loads `/profile` on start and debounce-saves changes, keeping the localStorage fallback when the backend is offline. This replaces the current `/api/user/preferences` calls in `src/core/user-preferences.ts`, which have no backend route.
2. Wire the workbench store (layout and panes), the watchlists and shortlists in `data-layer.ts`, and the preferences into it.
3. A Layouts menu in the workbench toolbar to save, load and delete named layouts.
4. A Modules view to create a module as a named collection of sources, enable or disable it, and attach it to a layout.
5. A token field in settings. The token is sent as `Authorization: Bearer`. The Vite proxy already forwards headers.

## Execution order (one small chunk at a time, one subagent at a time)
1. Rust profile store plus tests.
2. Rust routes plus auth table plus tests.
3. Codegen.
4. Frontend profile-store plus wiring.
5. Layouts menu.
6. Modules view and token settings.
7. Independent review pass after the Rust work and again at the end.

Each step is committed on its own, touching only the files for that step, with no Co-Authored-By trailer.

## Open questions
- Which concrete source kinds should a module support first (broker adapter, symbol list, Parquet directory)?
- Should layouts be shareable between users later? This design keeps them strictly private.

## Alerts (added; hookable from algodesigner and workbench)

Confirmed: all four trigger families, **frontend-only evaluation**, and delivery by in-app toast and log, browser notification and sound, webhook, and trigger-an-action. Borrow the design from `openalgo-charts` and from the algodesigner stores, as asked.

### What to reuse from `openalgo-charts` 2.6.4
- `AlertController` plus `AlertsDocument` (versioned, serializable, validated by `parseAlertsDocument`) for chart-attached alerts. It already provides:
  - Sources `price`, `indicator`, `barCondition` and `drawing`.
  - Conditions `crossing`, `crossingUp`, `crossingDown`, `greaterThan`, `lessThan`, `enteringRange`, `leavingRange` and `matches`.
  - Policy `onBarClose` / `onTouch`, repeat `once` / `everyTime`, and states `armed`, `triggered`, `expired` and `disabled`.
  - Chart events `alert:triggered`, `alert:created`, `alert:updated`, `alert:expired`, `alert:removed` and `alert:error`.
  - Indicator-authored alerts (`IndicatorAlertSpec`), whose `message` can be a function that builds a webhook JSON body.
- It is headless-capable (`AlertChartHost`, `visuals: false`), so the same controller can run without a mounted chart.

### Design
1. **Alert bus** (`src/core/alerts/bus.ts`): one small event bus, `AlertEvent { id, source, title, message, severity, time, payload }`. Every trigger family publishes to it.
   - Price and indicator conditions: an `AlertController` per workbench pane, forwarding `alert:triggered` to the bus.
   - Strategy signals: algodesigner flows and jobs (`src/core/designer/jobs.ts`, `ops.ts`) publish signal and order events.
   - Engine and risk events: trading-state changes (the same state as `GET /trading-state`), rejected orders and drawdown limits.
   - Data and feed events: the `data-layer.ts` WebSocket and backend state (the live/offline pill), and a module (source collection) going offline.
2. **Alert store** (`src/core/alerts/store.ts`, zustand, like `src/core/workbench/store.ts`): rules and the history log. Chart alerts are persisted as the `AlertsDocument`; non-chart rules use a small own schema.
3. **Delivery sinks**, each a plugin that subscribes to the bus and is toggled per rule:
   - In-app toast and a log panel with history.
   - Browser `Notification` (permission requested on first use) and a short sound.
   - Webhook: a POST from the browser to a user URL. It needs CORS on the target, so a note in the UI will say that some targets only work through a relay. Never log the URL secrets.
   - **Action**: a rule can run an action: start an algodesigner flow or job, halt trading (`PUT /trading-state`), or change a workbench pane or layout. Actions on trading state are guarded by a confirmation setting, and `halted` is the only state an alert may set without confirmation.
4. **Hooks**:
   - Workbench: an alert button on each pane card, plus the chart's own price-line alert UI.
   - Algodesigner: an "Alert" node type that publishes to the bus, and a trigger input that starts a flow from an alert.
5. **Multi-user**: alert rules belong in the user's profile. Chunk 1's `Profile` (commit `ad29007` in `honba`) has no `alerts` field, so add `alerts: serde_json::Value` (default empty) when doing chunk 2. Webhook URLs are stored per user, and are visible only to that token.

### Limits to state in the UI
- Alerts fire only while a browser tab is open (frontend-only evaluation). An alert on a closed tab is not evaluated.
- Several open tabs would fire the same alert twice. Use a `BroadcastChannel` leader (the app already uses `honba_data_sync`) so only one tab evaluates.

### Alerts development plan

Frontend-only except A7. Each chunk is one small commit (touching only its own files, no Co-Authored-By trailer) with tests (`vitest`), `npm run typecheck` and `npm test` passing, run by one subagent at a time. A1 to A6 do not depend on the Rust profile chunks and can run in parallel with them. Put new code under `src/core/alerts/` and `src/components/features/alerts/`.

| Chunk | Scope | Main files | Tests |
|---|---|---|---|
| A1 | Core types and the alert bus: `AlertEvent`, `AlertRule` (source family, condition, repeat, delivery list, enabled), `publish` / `subscribe`, dedupe and rate-limit per rule. Zustand store for rules and a capped history log. Pure logic, no UI. | `src/core/alerts/{types,bus,store}.ts` | publish/subscribe, rate limit, history cap, store CRUD, `AlertsDocument` round trip through `parseAlertsDocument` |
| A2 | Tab leader election with `BroadcastChannel` so only one tab evaluates and delivers; fallback to evaluating when `BroadcastChannel` is missing. | `src/core/alerts/leader.ts` | leader handover on tab close, single delivery with two simulated tabs |
| A3 | In-app sinks: toast host mounted in `AppNav` for all apps, an alerts log panel with history and a mute/ack control, plus browser `Notification` (permission requested on first enable) and a short sound (user setting, off by default until enabled). | `src/components/features/alerts/{toast-host,alert-log}.tsx`, `src/core/alerts/sinks/{notification,sound}.ts` | sinks receive bus events, permission-denied path, mute |
| A4 | Workbench wiring: one headless-capable `AlertController` per pane via `AlertChartHost`, forwarding `alert:triggered` / `alert:error` to the bus; an alert button on `chart-pane-card.tsx` that opens a small create dialog (price, indicator, bar condition, drawing); chart alerts stored as the `AlertsDocument` in the alert store. | `src/components/features/workbench/{chart-pane-card,openalgo-chart}.tsx`, `src/core/alerts/chart-bridge.ts` | bridge forwards a triggered alert, restore of a saved document |
| A5 | Publishers for the other families: trading-state and risk (poll or react to `GET /trading-state`, rejected orders), data/feed (`data-layer.ts` WebSocket and backend state, module offline), strategy signals (algodesigner `jobs.ts` / `ops.ts` completion and order events). Each publisher is a small adapter, not edits spread through the stores. | `src/core/alerts/publishers/*.ts` and minimal hook points in `data-layer.ts`, `designer/ops.ts`, `workbench/store.ts` | one test per publisher with a fake source |
| A6 | Algodesigner integration: an "Alert" node type that publishes to the bus, and an alert trigger input that starts a flow. Study `src/apps/algodesigner/` and `src/core/graph/` first and match the existing node registry. | `src/apps/algodesigner/*`, `src/core/graph/*` | node serialization, node publishes on run, trigger starts a flow |
| A7 | Action and webhook sinks: webhook POST (JSON body from the rule's message template; secrets never logged; timeout and bounded retry; CORS caveat note in the UI) and actions (start a flow or job, set trading state `halted` only without confirmation, set a pane or layout). Trading-state actions go through the existing workbench store and need a confirmation setting. | `src/core/alerts/sinks/{webhook,action}.ts`, settings UI | webhook retry and timeout, no secret in logs, halted-only guard |
| A8 | Profile persistence, after backend chunks 2 and 3: save and restore rules and the chart `AlertsDocument` through the profile store (`profile.alerts`), debounced, with the localStorage fallback and revision-conflict handling. | `src/core/alerts/persist.ts` | save/restore, conflict retry, offline fallback |

Order: A1, A2, A3 first (a usable toast and log), then A4 (the most visible payoff), A5, A6, A7, and A8 last. After A4 and again after A7, run an independent review subagent.

Risks to watch:
- Browser notification and sound permissions can be denied or blocked, so every sink must degrade silently.
- A webhook from the browser exposes the URL to anyone with devtools. State this in the UI.
- An action that halts trading must be reachable only through the `PUT /trading-state` path the app already uses, never a new side channel.
- Polling for trading state must reuse the existing client and respect the Vite proxy prefix rewrite.

## Progress log
- **Chunk 1 done** (`honba` commit `ad29007`, not pushed): `crates/honba-api-rest/src/profile_store.rs`.
  - `ProfileStore::new(dir)`, `get(user_id)` (missing user gives the default profile at revision 0), `put(user_id, expected_revision, profile)` (stale revision gives `ProfileError::RevisionConflict`; success stores `expected_revision + 1`).
  - User ids are limited to `[A-Za-z0-9_-]`, 1 to 64 bytes. The unauthenticated user is `DEFAULT_USER_ID = "default"`. Writes are atomic (temp file, sync, rename) behind a store-wide mutex.
  - `Profile` currently has `revision`, `layouts`, `modules`, `watchlists`, `shortlist`, `preferences` and `workbench`. It has **no `alerts` field yet**.
  - 6 new tests; `cargo fmt`, `clippy` and `cargo test -p honba-api-rest` pass.
- **Chunk 2 in progress**: `GET/PUT /profile` plus the named layout and module routes, the `--profiles-dir` flag, an "any valid token" auth entry, an `alerts` field on `Profile`, and codegen endpoint-list entries (the client itself is regenerated in chunk 3).
