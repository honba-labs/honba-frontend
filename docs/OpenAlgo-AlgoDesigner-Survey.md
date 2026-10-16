# OpenAlgo Algo Designer & Flow Interface Survey

Source: read-only survey of `~/tmp/openalgo` (OpenAlgo 2.0.2.8), 2026-10-16.

> [!WARNING]
> **Licence: AGPL-3.0.**
> Direct copying of code from OpenAlgo into Honba would taint the repository. Borrow architectural ideas, UX paradigms, and interaction patterns only. Implementation in Honba must be built clean-room against Honba's existing domain models and ADR 0029.

---

## 1. Executive Summary

OpenAlgo's visual strategy and automation designer is branded as **Flow** (located in `frontend/src/pages/flow` and `frontend/src/components/flow`, backed by `blueprints/flow.py`, `services/flow_executor_service.py`, and `database/flow_db.py`).

In OpenAlgo, the Flow interface serves as a **visual workflow and broker execution orchestration canvas**. It enables users to construct automated trade-routing trees, event-triggered order sequences, and conditional logic graphs without writing Python or Pine Script code.

OpenAlgo also includes a separate **Strategy Builder** (`frontend/src/pages/strategy/`, `frontend/src/components/strategy-builder/`), which specializes in multi-leg options structures (straddles, strangles, spreads, iron condors) with Greek curves, payoff charts, and basket order execution.

---

## 2. Frontend Architecture & Tech Stack

The Flow designer frontend is built with:
* **Canvas Engine**: `@xyflow/react` (React Flow v12.3.6) with custom nodes, custom edges, background grids, and minimap.
* **State Management**: Zustand (`frontend/src/stores/flowWorkflowStore.ts`).
* **API / Async Cache**: TanStack React Query (`@tanstack/react-query` v5.90.20) for query hydration, caching, and mutation invalidation.
* **Component Primitives**: Radix UI headless components (`@radix-ui/react-*`), Lucide React icons, and Tailwind CSS v4.

---

## 3. Core Flow Components & Interaction Model

### 3.1 Canvas Viewport & Coordinate Mapping (`FlowEditor.tsx`)
* **Coordinate Projection**: Uses React Flow's `useReactFlow().screenToFlowPosition({ x, y })` to translate browser client coordinates during drag-and-drop into canvas flow coordinates.
* **Dual Placement**:
  1. *Drag-and-Drop*: Mouse drag from the left sidebar palette directly drops the node at the pointer location.
  2. *Click-to-Add*: Clicking a node in the palette calculates the center of the current canvas viewport (`bounds.x + bounds.width / 2`, `bounds.y + bounds.height / 2`), ensuring keyboard and trackpad accessibility.
* **Navigation & Grid**:
  * Canvas snap-to-grid: `snapToGrid={true}`, `snapGrid={[16, 16]}`.
  * Dot background: `<Background gap={16} size={1} />`.
  * Controls & Minimap: `<Controls />` and `<MiniMap nodeStrokeWidth={3} pannable zoomable />`.
  * Status indicator: Centered bottom panel showing workflow execution/active state.

### 3.2 Draggable Node Palette (`NodePalette.tsx`)
The left sidebar presents a searchable, tabbed catalogue of node templates:
1. **Triggers (Orange)**:
   * `start` (Scheduled cron / timer trigger)
   * `priceAlert` (LTP threshold cross)
   * `webhookTrigger` (Inbound HTTP webhook with HMAC/token auth)
   * `orderUpdateTrigger` (Order status change events)
2. **Actions (Blue / Green)**:
   * `placeOrder` (Standard market/limit order)
   * `smartOrder` (Position-aware order routing)
   * `optionsOrder` (ATM/ITM/OTM relative options orders)
   * `optionsMultiOrder` (Multi-leg structures: straddle, strangle, spreads)
   * `basketOrder` (Multi-contract atomic dispatch)
   * `splitOrder` (Iceberg-style order chunking)
   * `modifyOrder`, `cancelOrder`, `cancelAllOrders`, `closePositions`
3. **Data (Blue / Primary)**:
   * `getQuote`, `multiQuotes`, `getDepth`
   * `history` (OHLCV historical bars)
   * `indicator` (Technical indicator computation)
   * `priorPeriodOhlc`, `barOffset`
   * `optionChain`, `optionSymbol`, `syntheticFuture`, `expiry`
   * `openPosition`, `orderStatus`, `funds`, `margin`, `holdings`
4. **Streaming (Green / Cyan)**:
   * `subscribeLtp`, `subscribeQuote`, `subscribeDepth`, `unsubscribe`
5. **Logic & Conditions (Amber / Purple)**:
   * `priceCondition`, `timeCondition`, `timeWindow`, `positionCheck`, `fundCheck`, `varCondition`
   * Logical gates: `andGate`, `orGate`, `notGate`
6. **Utilities (Muted / Slate)**:
   * `variable` (In-memory key/value state manipulation)
   * `mathExpression` (Math operations)
   * `delay`, `waitUntil`
   * `log`, `telegramAlert`, `whatsappAlert`, `httpRequest`
   * `timings`, `holidays`

### 3.3 Node Visual Representation (`BaseNode.tsx`)
All nodes share a unified design shell:
* **Category Color Accent**: Left border `border-l-2` colored by category (`border-l-node-trigger`, `border-l-node-action`, `border-l-node-condition`, etc.).
* **Header**: Node icon with matching translucent background, title, and optional subtitle (e.g. underlying symbol or interval).
* **Summary Rows**: Displays key configured parameters in compact font-mono chips (`NodeDataRow`).
* **Handle / Port Topologies**:
  * Default nodes: Single target handle at `Position.Top`, single source handle at `Position.Bottom`.
  * Decision / Condition nodes: Dual source handles at `Position.Bottom` — Left handle (`id="true"`, green `bg-buy`) for TRUE branches, and Right handle (`id="false"`, red `bg-sell`) for FALSE branches.

### 3.4 Custom Midpoint Splicing Edge (`InsertableEdge.tsx`)
* Custom edge component implementing `getSmoothStepPath` with SVG path rendering.
* Uses `EdgeLabelRenderer` to place an interactive `+` button directly at the mathematical midpoint of each connected wire.
* Hovering or selecting the edge reveals the button. Clicking opens a dropdown menu; selecting a node dynamically inserts the new node at the midpoint position and re-links the source to the new node, and the new node to the target.

### 3.5 Node Configuration Inspector (`ConfigPanel.tsx`)
* Slides out from the right sidebar when any node is clicked (`selectedNodeId`).
* Contains typed form fields customized per node type:
  * Symbol search and exchange selection.
  * Product type (`MIS`, `CNC`, `NRML`) with auto-fallback based on asset class derivative rules.
  * Order parameters: Action (`BUY`/`SELL`), price types (`MARKET`, `LIMIT`, `SL`, `SL-M`), price, trigger price, stop loss, target.
  * Options controls: Strike offsets (`ITM25` through `OTM25`), expiry types (`CURRENT_WEEK`, `NEXT_WEEK`, `MONTHLY`).
  * Templatable variables: Text fields support dynamic substitution using `{{node_id.output_variable}}` syntax.
  * Indicator parameter forms: Dynamically generated from indicator parameter schemas (period, source, fast/slow, deviations).

### 3.6 Execution & Diagnostics Stream (`ExecutionLogPanel.tsx`)
* Flyout right drawer toggled from the top action bar.
* Displays:
  * Overall workflow run status: `idle`, `running`, `started`, `success`, `error`.
  * Timestamped log list with colored badges: `[INFO]`, `[WARN]`, `[ERROR]`.
  * Summary payload or error alert.

### 3.7 Canvas Lifecycle & Store Mechanics (`flowWorkflowStore.ts`)
* **Change Filtering**: React Flow emits `dimensions` changes on mount/measurement and `select` changes on click. The store implements an `isRealEdit()` guard to ensure passive layout measurements do not mark the workflow dirty.
* **Safe Mutation & Dirty Guarding**: The Run and Activate actions enforce a `saveIfDirty()` check before dispatching execution requests. If unsaved edits exist on canvas, it saves first to ensure the backend executes the exact revision visible to the user.
* **Lossless JSON Roundtrip**: Includes an export feature to download the entire graph as `.json` and a "Replace from JSON" modal that validates and swaps graph nodes and edges while preserving workflow ID and webhook credentials.

---

## 4. Backend Engine & Workflow Execution

OpenAlgo's backend runs on Flask + gevent (`blueprints/flow.py`):
1. **Storage**: Workflows are stored in SQLite (`database/flow_db.py`) as serialized JSON containing `nodes`, `edges`, `name`, `is_active`, and webhook tokens.
2. **Validation**: `services/flow_workflow_validator.py` executes acyclic topological graph validation, ensuring:
   * Graph has at least one valid trigger node.
   * No invalid or circular references exist.
   * Required parameters for every node type are satisfied.
   * Templatable variable paths reference valid upstream nodes.
3. **Execution Runtime**: `services/flow_executor_service.py` evaluates the graph step-by-step:
   * Traverses nodes starting from the trigger.
   * Evaluates conditions and follows `true` or `false` edge branches.
   * Executes broker API calls (placing orders, cancelling orders, querying positions).
   * Emits structured JSON execution logs.

---

## 5. Architectural Comparison with Honba

| Dimension | OpenAlgo Flow | Honba Target (ADR 0029) |
| :--- | :--- | :--- |
| **Primary Domain** | Retail broker webhook orchestration & trade routing | Institutional quantitative research, backtesting, simulation & live execution |
| **Strategy Representation** | JSON DAG interpreted by Python runtime engine | **Dual Representation**: Machine-readable StrategyGraph JSON $\longleftrightarrow$ Clean, runnable Python `Strategy` class |
| **Port Typings** | Untyped string/event handles (general in/out) | Strictly typed ports: `bars`, `series`, `bool`, `size`, `order` |
| **Indicator System** | Hardcoded technical indicator catalog | Introspected dynamic catalogue derived directly from `honba.strategies.indicators` |
| **Verification** | Basic graph topological & schema validator | Rust `StrategyIr` compiler with multi-tier validation (`honba verify` codes) |
| **Execution** | Live broker order dispatch (synchronous / background) | Event-driven bar-by-bar runner, tick-by-tick simulation, and live session port |
| **Analytics & Diagnostics** | Status message + flat text logs | Validation trust badges (DSR, PBO, holdout, walk-forward), equity & drawdown SVG curves, trade log |
| **Ops Console** | Webhook activation switch & log drawer | Full ops console with run-mode selector (paper, signal-only, live), kill-switch, and order queue |
