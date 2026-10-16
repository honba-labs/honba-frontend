# OpenAlgo portfolio and analytics survey

Source: read-only survey of `~/tmp/openalgo` (OpenAlgo 2.0.2.8, commit `b4cf56ded`), 2026-10-16. Produced by a subagent; line references are the subagent's and were not re-verified.

**Licence: AGPL-3.0.** Copying code into honba would taint it. Borrow ideas and formulas only. The `openstatz` and `opengreeks` dependencies are separate libraries whose licences were not checked.

## Headline
OpenAlgo has no real portfolio entity. It is a single-user trading gateway (`CLAUDE.md:53`, "Single user per deployment"). Portfolio and analytics are thin views over the broker's live holdings and positions, plus a separate investor-style backtester/analyzer (`portfolio/`, `sip/`), a per-strategy fill ledger and an intraday P&L tracker.

## 1. Data model
- Holdings, positions, orders, trades and funds are **not stored**; they are fetched live per request (`services/holdings_service.py`, `positionbook_service.py`, `funds_service.py`, `tradebook_service.py`) and normalised in `broker/<x>/mapping`. Unified position shape: symbol, exchange, product, quantity, average_price, ltp, pnl, pnlpercent.
- No multi-account or multi-broker aggregation. `user_id` exists only in the strategy book and the sandbox.
- `database/strategy_portfolio_db.py`: saved option-strategy templates (watchlist enum, underlying, expiry, `legs_json`), no `user_id`, not P&L.
- `database/strategy_book_db.py` (per-strategy ledger):
  - `StrategyOrderTag` (orderid, user_id, strategy, symbol, exchange, product, `applied_quantity`, `applied_notional` watermarks).
  - `StrategyPendingFill` buffers fills that arrive before their tag.
  - `StrategyPosition` (quantity, average_price, realized_pnl, today_realized_pnl, trade_date).
  - Fed only from event-bus `order.placed` / `order.update`, so the order path is untouched. Idempotent: books only the unseen fill delta, which handles duplicate postbacks and partial fills. Weighted-average cost; a flip through zero realises the closed leg and reopens the remainder at the fill price. `RLock` around read-modify-write.
- Sandbox tables (`database/sandbox_db.py`): orders, trades, positions (with accumulated and today realised P&L, margin), holdings (T+1 settlement), funds (default starting capital 1 crore).

## 2. Computations
- **Live P&L:** broker pnl passed through; recomputed in the browser from WebSocket LTP (`frontend/src/hooks/useLivePrice.ts`).
- **Strategy P&L** (`services/strategy_pnl_service.py`): realised from the book; unrealised computed at read time (open quantity marked to LTP) and never stored, because it would be stale on write.
- **Intraday MTM curve** (`blueprints/pnltracker.py:206-1105`): per-minute series rebuilt from tradebook plus 1-minute candles, realised P&L layered per closed leg, drawdown = `Total_PnL - cummax(Total_PnL)`. Intraday only. The user guide's week/month/YTD views, equity curves and per-strategy tables were **not found in code**.
- **Portfolio backtester** (`portfolio/`, daily bars, pandas/numpy, long-only):
  - `engine.py`: drift-and-reset weights, costs on traded value. `rebalance.py`: calendar or drift-band policies.
  - `costs.py`: composable `CostSchedule` (rules with basis turnover/buy/sell/order and a taxed flag); presets `india_delivery` (matches a public calculator to the paisa) and `us_equity`.
  - Metrics delegated to `openstatz`: CAGR, volatility, Sharpe, Sortino, Calmar, max drawdown, win rate, VaR, CVaR, ulcer index, recovery factor, tail ratio, skew, kurtosis, alpha, beta, information ratio.
  - Local additions (`analytics.py`): correlation matrix (NaN below `min_overlap`), average pairwise correlation, effective holdings (1/HHI), diversification ratio, up/down capture as ratios of mean returns.
  - `attribution.py`: not Brinson. Splits excess return into selection (equal-weight basket vs benchmark), allocation (realised gross path vs that basket) and costs (net vs gross); the three reconcile exactly.
  - `health.py`: six pillars scored 0-100, each publishing raw inputs, formula and weight; grades A 80+, B 65+, C 50+, D 35+, F below. `insights.py`: SWOT findings, each with its figure and threshold. `crisis.py`: named stress windows as data. `walkforward.py`: walk-forward plus Monte Carlo bootstrap. `compare.py`: rebalancing sweep. `grouping.py`: correlation clustering instead of a sector pie.
  - `analyse_live_holdings` (`services/portfolio_service.py:776`): applies today's weights to past prices ("how would today's portfolio have behaved", not "how did my account perform").
- **SIP** (`sip/`): XIRR solver bracketed to [-0.9999, 100] that raises when undefined, rolling XIRR, start-date heatmaps, underwater duration.
- **Greeks** (`services/option_greeks_service.py`): Black-76 via the `opengreeks` Rust library, batch calls for a chain, synthetic-future forward, theta per day, vega per 1% vol. Parity benchmark: bit-identical to py_vollib on 40 samples, 12.8x faster.
- **Refresh:** WebSocket LTP, a 30 s MultiQuotes poll as fallback, 5 s stale threshold, polling paused while the tab is hidden, catch-up refresh after a 30 s hide, refetch on order events.

## 3. API surface
- `/api/v1` (API-key auth): `GET /portfolio/benchmarks`, `POST /portfolio/backtest` (one large payload, every tab is a view of one simulation; 10/min), `POST /portfolio/tearsheet` (HTML report; 5/min), `POST /portfolio/holdings` (live holdings analysis; needs a broker session). Also positionbook, holdings, funds, tradebook, openposition, optiongreeks, multioptiongreeks, and a SIP endpoint.
- Session-only routes: `/pnltracker/api/pnl`, `/api/strategy-portfolio` CRUD, `/sandbox/mypnl/api/data` and CSV exports (sanitised against formula injection), `/alerts` history.
- MCP (`mcp/mcpserver.py`): `@openalgo_tool(toolset, write, destructive, risk)` decorator, narrowable toolsets, read-only mode, outputs wrapped in an "untrusted_tool_output" envelope. Tools exist for positions, holdings, funds, margin, Greeks and indicators; **none for the portfolio backtester, analyzer or strategy P&L**.
- UI state: backtest result in a non-persisted zustand store (a stale result would look current after reload).

## 4. UI
React 19, Vite, TanStack Query, zustand, Tailwind 4. Pages: Positions (1079 lines, grouping/filters in localStorage), Holdings, TradeBook, Dashboard, PnLTracker (lightweight-charts), SandboxPnL, PortfolioBacktester(+Results, 1564 lines), PortfolioAnalyzer, SIP, StrategyPortfolio, option tools (GEX, IV smile, vol surface, OI profile, max pain). Charts: lightweight-charts for series, Plotly for surfaces/heatmaps. Only the chart workspace has a saved layout. No customisable portfolio dashboards. No multi-user.

## 5. Sandbox / analyzer mode
A global toggle (`get_analyze_mode()`); when on, holdings and positionbook route to `sandbox_service` instead of the broker. Engines in `sandbox/` (execution, funds, positions, T+1 holdings, squareoff, session boundary, catch-up). The frontend refetches on mode change.

## 6. Quality notes and limits
- Tests: portfolio engine/service/API, SIP, strategy book, Greeks, per-broker mapping, vitest for heatmaps and Positions. Engine cases are chosen so plausible-but-wrong implementations fail.
- Known limits (hardening spec `docs/superpowers/specs/2026-07-31-portfolio-backtester-release-hardening-design.md`): no dividends or total return, no sector/market-cap data, crisis coverage from about 2015, cash equity/ETF only, long-only, no portfolio persistence or multi-portfolio comparison, a 793-line service and 1,847-line page left undecomposed, live-broker certification not automated.
- `pnltracker.py` is a 1,105-line pandas blob with per-broker timestamp hacks; the backtest payload is large and unpaginated; the tearsheet needs matplotlib.

## 7. Ranked ideas for honba (as reported)
1. Strategy-tagged fill ledger with an idempotent per-order applied-quantity watermark, pending-fill buffer, weighted-average cost, realise-on-flip, read-time unrealised. Effort M.
2. "Honest analytics": every number carries inputs, formula and threshold; gaps instead of noise. Effort S (convention).
3. Cost schedule as data with market presets. Effort S-M.
4. Single-payload analysis endpoint so views cannot disagree; a saved layout stores the request, not the result. Effort S.
5. Concentration/diversification metrics (effective holdings, diversification ratio, correlation clustering, capture ratios). Effort S-M.
6. Exactly reconciling attribution (selection, allocation, costs). Effort M.
7. Intraday MTM and drawdown curve as an event-sourced running series; a natural alert source. Effort M.
8. Live-quote hook: WebSocket first, stale threshold, polling fallback, pause when hidden. Effort S.
9. MCP trust envelope: toolsets, read-only mode, risk classes. Effort S-M.
10. XIRR/SIP toolkit (explicit "undefined") and batch Greeks over a chain. Effort M.

**Where honba can lead:** saved portfolio dashboards/layouts, per-user data, P&L-driven alerts, and equity-curve history beyond one intraday session.
