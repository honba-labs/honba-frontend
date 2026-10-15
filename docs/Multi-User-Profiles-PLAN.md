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

### Alert chunks (after the profile chunks, or in parallel on the frontend)
A1. Alert bus and store plus tests. A2. Delivery sinks (toast, log, notification, sound). A3. Workbench: per-pane `AlertController` wiring. A4. Engine, feed and risk publishers. A5. Algodesigner node and trigger. A6. Webhook and action sinks. A7. Profile persistence.
