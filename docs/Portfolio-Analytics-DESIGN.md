# Portfolio and analytics design for honba (simulator + paper trading)

Status: proposal, 2026-10-16. Not implemented. It builds on ADR 0032 (E13) in `honba`, which another session is implementing, so every backend item below must be reconciled with that work before any code is written. Inputs: `OpenAlgo-Portfolio-Analytics-Survey.md` (ideas only, the code is AGPL) and a read-only survey of honba's current state (summarised in section 1).

## 0. Principle
One pipeline for every mode: **fill events -> per-account ledger -> valued snapshot -> equity series -> analytics report**. Backtest runs, the simulator, paper (Sandbox) accounts and, later, live accounts all produce the same fill events (`SCHEMA_VERSION` 4 vocabulary, ADR 0019), so they are valued, charted and compared by the same code. The Rust crates own the numbers; the frontend only renders them and never re-derives them.

## 1. Where honba is today (from the survey)
Done and committed (E13-S0, S1): the `PortfolioSnapshot` contract (`honba-entities/src/portfolio_report.rs`), a pure valuation engine (`honba-portfolio::value`), the `Position::apply_fill` weighted-average / realise-on-flip logic, `Trade.costs`, `honba-analytics` (`EquityStats`, `TradeStats`, DSR, PBO, walk-forward, Monte Carlo), the sim fill/slippage/cost/margin models, `SandboxAdapter` (paper on a live feed with virtual funds), and per-user stores with revisions.
In progress by another session (uncommitted, E13-S2): `GET /portfolio`, `/portfolio/accounts|positions|holdings|trades`, `PortfolioStore`, `--portfolios-dir`.
Missing, and the reason this design exists:
1. No fill-to-portfolio ingest: `OrderLedger` is volatile, global, user-unscoped and quantity-only; `PortfolioStore` has no write route.
2. No equity or value history anywhere in the server. REST backtest metrics ignore open positions and costs, use a fixed 252 periods per year, and differ from the Python per-bar curve (percent vs fraction, round-trip vs bar-based).
3. Fees do not reach the journal: `order_filled` carries no costs, `trades_from_journal` sets costs to zero, and `PortfolioPosition.realized_pnl` excludes fees.
4. No `account_id` or strategy tag on `Order`, fill events or `Trade`; a run manifest has one `strategy_id`.
5. No day baseline for intraday/day P&L; one missing quote makes the whole portfolio 503.
6. Frontend: `simulator-app` and `researcher-app` are empty placeholders; the portfolio store shows a hard-coded mock snapshot (cached in localStorage) and re-implements valuation in TypeScript with float math and a hard-coded 20% margin; the generated client has no portfolio methods; the workbench keeps its own mock positions.

## 2. Account model across modes
| Kind | Where fills come from | Lives in | Mixed with live money? |
|---|---|---|---|
| **Live** | broker (contract only today) | user portfolio document, `mode: Live`, `source: Broker` | never |
| **Paper (Sandbox)** | `SandboxAdapter` / REST `/orders` against the simulated venue on the live feed, virtual funds from `AccountConfig.starting_cash` | user portfolio document, `mode: Sandbox`, `source: Ledger` | never; Sandbox is the default (ADR 0032 section 4) |
| **Simulator / backtest run** | journal of a run (`events.ndjson`) | **the run directory**, not the user portfolio document | no; run-scoped and read-only, referenced by `run_id` |

Keeping runs out of the user's portfolio document avoids polluting it with throwaway accounts and keeps the 100-account cap meaningful. A run is valued on demand by replaying its journal through the same ledger and valuation code.
Paper accounts support **reset** (new revision, starting cash restored, history archived under a new epoch) and **clone from run** (seed a paper account with a run's strategy and cash).

## 3. Components

### 3.1 Fill ingest and ledger (Rust)
- A `FillSink` in the REST/engine layer receives every fill (paper venue today, live later), keyed by the caller's user id from `Caller`. It appends to the user's portfolio document through `PortfolioStore::update` (single revision bump per batch).
- Idempotency: reuse `honba-risk`'s `FillFingerprint` (SHA-256) so replayed or duplicated fills are ignored; buffer fills that arrive before their order metadata (idea 1 from the OpenAlgo survey, reimplemented from the idea, not the code).
- Position math stays `Position::apply_fill`; costs are added per fill via the existing `ScheduleFillCost` and stored on `Trade.costs`; realised P&L is reported both gross and net of costs.
- **Additive schema change** (ADR 0012, bump `SCHEMA_VERSION`): optional `account_id` and `strategy_id` on `Order` and on fill events, and `costs` on `order_filled` / `order_partially_filled`. All optional so existing journals and conformance vectors stay valid.
- Journal rule stays: append-only NDJSON in kernel order; handlers read no clock (timestamps come from fill events and quotes).

### 3.2 Equity series
- New `EquityPoint { ts, equity, cash, market_value, realized, unrealized, costs_cum }` and `EquitySeries` in `honba-entities`, produced by a pure function in `honba-portfolio` (`series(fills, marks) -> EquitySeries`), golden-tested like the snapshot.
- Sources: (a) backtest/sim run: replay the journal at each bar close (marks from the run's bars); (b) paper/live: append a point on every fill and on a mark-driven interval, stored as NDJSON beside the portfolio document (resolves the ADR 0032 open item "ledger in the document or beside it": **beside it**, so the document stays small and capped).
- Day baseline: the first point of a session (or the previous close mark) is the day-open equity; day P&L = now minus baseline. Sessions come from the instrument calendar, not a clock read.
- Missing marks degrade per position (flagged `stale`/`missing_mark` with last known mark) instead of 503 for the whole portfolio, with a `valuation_quality` field in the snapshot.

### 3.3 Analytics (Rust `honba-analytics`, one definition for all callers)
- Single request, single payload so tabs cannot disagree: `POST /portfolio/analytics` with `{accounts | run_id, range, benchmark?, risk_free, periods_per_year?}`. Scope `read:account` (runs need `research`). The response is the same type for a paper account and for a run.
- Sections: `summary` (total/annualised return, volatility, Sharpe, Sortino, Calmar, max drawdown, current drawdown), `drawdown` (series plus underwater episodes with duration), `returns` (daily, monthly and year tables), `trades` (round trips from `RoundTrip::from_fills`, win rate, profit factor, expectancy, holding time, gross vs net), `costs` (by charge name, share of gross P&L), `exposure` (gross/net, leverage, concentration: HHI, effective holdings, top-N weight), `attribution` (by strategy once tags exist; by instrument always; selection/allocation/costs split that reconciles exactly to net P&L), `benchmark` (alpha, beta, information ratio, capture ratios; only when benchmark bars are supplied).
- **Show-your-working**: every figure is `{value, inputs, formula, n_obs, status}`; undefined results are `status: "undefined"` with a reason (too few observations, zero variance, no benchmark), never NaN or a made-up number. Periods per year and the return convention (fractions, not percent) are explicit fields, which also retires the current Python/Rust divergence.
- Fix the existing REST `BacktestMetrics` to read from the same code path (mark-to-market, costs included) so run metrics and portfolio analytics agree.

### 3.4 Simulator vs paper comparison (honba-specific, nothing in OpenAlgo)
Because both modes share the fill vocabulary, the same strategy can be compared across them:
- **Implementation shortfall** per fill (paper fill price vs the sim's modelled fill and vs next-bar open), slippage and cost drift, fill-rate and latency, and an equity-curve divergence chart (run vs paper account, same strategy and window).
- Output is a `ModelDriftReport` section on the analytics payload, and an alert source ("paper is underperforming its backtest by more than X").
- This is the feedback loop that tells whether the simulator's `FillModel`, `SlippageModel` and cost schedules are realistic.

### 3.5 Costs as data
Cost schedules already exist (`DatedCostScheduleSource`); expose them read-only (`GET /costs/schedules`) and allow per-user overrides in the user **profile** (not the portfolio document), so a paper account and a backtest can use the same override. Presets per market stay in `honba-market`.

## 4. REST/SSE surface (additions)
- `GET /portfolio/equity?account=&range=` -> `EquitySeries` (paginated by time).
- `POST /portfolio/analytics` as above; `GET /backtests/{id}/analytics` as an alias with `run_id` implied.
- `POST /portfolio/accounts/{id}/reset` (paper only; 409 for live) and `POST /portfolio/accounts` (create paper account).
- `GET /positions` alias for `GET /portfolio/positions` (E13-S3).
- `GET /portfolio/events` SSE (like ADR 0021) emitting `snapshot_changed` and `equity_point` for live widgets, with `from_seq` resume. No polling needed in the UI.
- Everything per user through `Caller`; no user id in any path; scopes explicit (`read:account`; `write:orders` for reset/create).

## 5. Frontend
1. Regenerate the TypeScript client after the E13-S2 routes land (it has no portfolio methods now), then delete the mock default snapshot, the localStorage fallback and the TypeScript `revalueAccount`. The store holds only what the server sends; offline shows an explicit "offline, last server snapshot at T" banner instead of fake numbers.
2. Unify the workbench's mock positions/orders with the portfolio store; `placeOrder` must surface client errors.
3. **Simulator app** (currently a placeholder): pick a run -> equity + drawdown chart, trades table with costs, analytics tabs, and a "compare with paper account" toggle (3.4). **Researcher app** reuses the analytics payload for sweeps.
4. **Portfolio app**: add the equity curve, underwater chart, returns heatmap, exposure/concentration and costs tabs from the analytics payload. Charts via `openalgo-charts` (already a dependency) for time series; a small SVG/canvas component for heatmaps.
5. Layouts and alerts tie-in (see `Multi-User-Profiles-PLAN.md`): a saved portfolio layout stores the analytics **request** (accounts, range, widgets), never the result. Alert publishers (A5) take their inputs from `equity_point` / `snapshot_changed`: drawdown from peak, day P&L threshold, margin utilisation, concentration, and model drift.
6. A live-quote hook with a stale threshold: server SSE first, polling fallback, pause while the tab is hidden, catch-up refresh after a long hide.

## 6. Development chunks
Backend chunks go to `honba` and must be sequenced with the E13 session (it owns S2 to S6). Frontend chunks need only the generated client.

| Chunk | Scope | Depends on |
|---|---|---|
| P0 | Decision record: ADR 0033 "portfolio equity series and analytics" in `honba`, reconciling this design with ADR 0032 (what is S3/S6 vs new). | E13 session |
| P1 | Additive schema: optional `account_id`, `strategy_id`, `costs` on order/fill events; codegen; conformance vectors for old and new. | P0 |
| P2 | Fill ingest + ledger (idempotent, per user, costs, gross/net realised); `GET /positions` alias. | P1, E13-S2 |
| P3 | `EquitySeries` type + pure `series()` + golden tests + NDJSON store; day baseline; per-position valuation quality. | P2 |
| P4 | Analytics payload in `honba-analytics` (summary, drawdown, returns, trades, costs, exposure), `POST /portfolio/analytics`, `GET /backtests/{id}/analytics`; align `BacktestMetrics`. | P3 |
| P5 | Attribution + benchmark/beta + model-drift (sim vs paper) report. | P4 |
| P6 | Paper account create/reset, `/portfolio/events` SSE. | P2 |
| F1 | Frontend: regenerate client, drop mocks and TS revaluation, server-only snapshot with offline banner. | E13-S2 |
| F2 | Portfolio app analytics tabs from the payload. | P4, F1 |
| F3 | Simulator app (run picker, equity, trades, compare with paper). | P4, P5 |
| F4 | Layouts store analytics requests; alert publishers from the SSE stream. | P6, alerts A1, profile chunks |

Each chunk: one small commit set, tests, independent review after P2, P4 and F3, and per-chunk subagents one at a time (Rust chunks to a stronger model, mechanical frontend chunks to a lighter one).

## 7. Decisions (confirmed 2026-10-16)
1. **Parallel track**, not folded into the E13 sequence: this work gets its own ADR (0033, number to be confirmed against `honba/docs/adr/`). It must still not collide with the E13 session, which owns S2 to S6 of ADR 0032: P0 therefore also lists, item by item, which parts overlap (fill ingest, `GET /positions`, S6 analytics) and which session builds what.
2. **Backtest and sim runs are not part of the portfolio.** They stay run-scoped, read-only and valued by journal replay.
3. **Equity series is stored beside the portfolio document** (NDJSON), not inside it.
4. **The additive schema bump is accepted now**: optional `account_id`, `strategy_id` and `costs` on order and fill events, bumping `SCHEMA_VERSION`.
5. **Benchmark is optional in v1.** The benchmark and beta section appears only when benchmark bars are supplied.
Still open: the out-of-scope list in ADR 0032 (multi-currency/FX, dividends and corporate actions, tax lots) stays out of v1.

## 8. Risks
- Two sessions editing `honba` at once: sequence through P0 and keep commits file-scoped.
- Schema bumps ripple into the Python adapters, strategies and docs; additive-only mitigates.
- Metric convention changes (percent to fraction, 252 fixed to explicit) alter existing numbers; version the analytics payload and note it in the changelog.
- Replay cost for large journals: stream the NDJSON and cache series per `(run_id, config_hash)` (ADR 0020 `ResultCache`).
- Honest-analytics payloads are larger; paginate the series and keep tables summarised.
