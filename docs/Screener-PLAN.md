# Screener Usability Adaptation Plan (TradingView Parity)

## 1. Executive Summary & Context

To make the **Honba Screener** feel as intuitive, responsive, and familiar as industry-standard financial terminals like TradingView, we conducted an in-depth live inspection of TradingView India's stock screener (`https://in.tradingview.com/screener/`), ETF screener (`https://in.tradingview.com/etf-screener/`), and Bond screener (`https://in.tradingview.com/bond-screener/`).

We verified two critical architectural behaviors:
1. **Dynamic Asset Screener Switcher**: Switching the screener (e.g., from **Stock Screener** to **ETF Screener**) dynamically changes the primary title preset button from **"All stocks"** to **"ETF vault"**, for Bonds to **"All bonds"**, and for Mutual Funds to **"All mutual funds"**.
2. **Context-Specific Top-Level Filter Bubble / Button Dropdown Pills**: Each screener features distinct, domain-specific filter pills tailored to that asset class's quantitative and fundamental attributes, as well as distinct table tabs.

This document details the live inspection findings, gap analysis, and the comprehensive multi-asset screener adaptation plan for `honba-frontend`.

---

## 2. TradingView Multi-Asset Screener Inspection Findings

### A. Screener Hierarchy & Title Behavior

When selecting an asset screener from the top breadcrumb dropdown:

| Asset Screener | Default Screen Title (Preset Dropdown) | Asset Domain Focus |
| :--- | :--- | :--- |
| **Stock Screener** | **All stocks** | Equities by Market Cap, P/E, Growth, Volume, EPS, Sectors |
| **ETF Screener** | **ETF vault** | Funds by AUM, Focus, Expense Ratio, Asset Class, Holdings Region |
| **Bond Screener** | **All bonds** | Fixed income by YTW %, Coupon %, Maturity Date, Issuer, Credit Rating |
| **Mutual Fund Screener (MF)**| **All funds** / **Fund vault** | AMCs, Category (Equity/Debt/Hybrid), NAV, AUM, Expense Ratio, 3Y/5Y CAGR |

---

### B. Screener-Specific Filter Pills ("Bubble / Button Dropdown" Row)

Each asset class exposes a tailored sequence of top-level filter pills:

#### 1. Stock Screener Filter Pills
* `AI` (Natural language filter prompt)
* `Country / Market` (e.g., `IN` / `US`)
* `Watchlist`
* `Index` (e.g., Nifty 50, Sensex, Nifty Midcap)
* `Price`
* `Chg %`
* `Mkt cap`
* `P/E`
* `EPS dil growth`
* `Div yield %`
* `Sector`
* `Analyst rating`
* `Perf %`
* `Revenue growth`
* `PEG`
* `ROE`
* `Beta`
* `Recent earnings date`

#### 2. ETF Screener Filter Pills (Verified Live)
* `Country / Market` (`US` / `IN`)
* `Watchlist`
* `Asset class` (Equity, Fixed Income, Commodity, Multi-Asset)
* `Focus` (Broad Market, Large Cap, Tech, Gold, ESG)
* `Niche` (Sub-industry / thematic exposure)
* `Holdings region` (North America, Asia, Emerging Markets, Global)
* `Brand` / Issuer (iShares, Vanguard, Nippon, HDFC AMC)
* `Perf %`
* `NAV total return`
* `AUM` (Assets Under Management)
* `Management style` (Passive / Active)
* `Strategy`
* `Div treat` (Reinvesting / Acc vs Distributing)
* `Div yield % (indicated)`
* `Div freq`
* `Leveraged` (1x, 2x, 3x, Inverse)
* `Expense ratio`
* `UCITS comp`

#### 3. Bond Screener Filter Pills (Verified Live)
* `Watchlist`
* `Issuer type` (Sovereign/Government, Corporate, Municipal, Agency)
* `Issuer` (Treasury, SBI, Reliance, HDFC, Municipal)
* `YTW %` (Yield To Worst)
* `Coupon %`
* `Coupon type` (Fixed, Floating, Zero)
* `Coupon freq` (Annual, Semi-annual, Monthly)
* `Maturity date` / Tenor
* `Price %`
* `Outstanding amt`
* `Issue currency`
* `Coupon currency`
* `Source` / Credit Rating (AAA, AA+, Sovereign, High Yield)

#### 4. Mutual Fund (MF) Screener Filter Pills (Honba Specification)
* `Watchlist`
* `Category` (Equity Large Cap, Mid Cap, Flexi Cap, Liquid, Overnight, Hybrid)
* `AMC / Fund House` (SBI MF, HDFC MF, ICICI Prudential, Mirae, Quant)
* `AUM`
* `NAV Total Return` (1Y, 3Y, 5Y CAGR)
* `Expense Ratio`
* `Risk Rating` / `Riskometer` (Low, Moderate, Very High)
* `TER` (Regular vs Direct)
* `Fund Manager`
* `Fund Age / Inception`

---

### C. Screener-Specific Table Tabs Row

Each screener adapts the analytical sub-tabs below the filter pills:

* **Stock Tabs**: `Overview`, `Performance`, `Technicals`, `Extended hours`, `Forecasts`, `Valuation`, `Dividends`, `Profitability`, `Income statement`, `Balance sheet`, `Cash flow`, `Per share`.
* **ETF Tabs**: `Overview`, `Performance`, `Technicals`, `Extended hours`, `Fund flows`, `Dividends`, `NAV performance`, `Holdings`, `Risk`.
* **Bond Tabs**: `Overview`, `Security info`, `Interest rate risk`, `Spreads`, `Amounts`, `Bond features`, `Coupon`, `Issuer`, `Ratings`.
* **MF Tabs**: `Overview`, `Returns & CAGR`, `Portfolio Holdings`, `Sector Allocation`, `Risk & Ratios` (Sharpe, Sortino, Alpha, Beta), `Fees & Loads`.

---

### D. "All stocks" / "ETF vault" Dropdown Menu & "Open Screen…" Modal

The screen management menu preserves a consistent operational anatomy across all screeners:
1. **Autosave** switch toggle.
2. **Share screen**.
3. **Make a copy…**
4. **Download results as CSV**.
5. Divider.
6. **Create new screen…** (`Shift + N`).
7. **Open screen…** (`Dot` / `.`).

When clicking **Open screen…**, the dialog displays built-in screens scoped to the active asset screener:
* **Stock Screens**: *Most capitalized*, *Highest net income*, *Healthy growth tech*, *Dividend kings*, *Bullish and undervalued*, etc.
* **ETF Screens**: *Largest by AUM*, *Lowest expense ratio*, *Top performing tech ETFs*, *High yield dividend ETFs*, *Commodity & Gold trackers*.
* **Bond Screens**: *High yield corporate*, *Sovereign 10Y benchmarks*, *Investment grade AAA*, *Short duration treasury*.
* **MF Screens**: *Top 5Y CAGR Large Cap*, *Low expense direct plans*, *Best risk-adjusted Sharpe*, *Consistent dividend yield funds*.

---

## 3. Honba Gap Analysis & Usability Shortcomings

| Feature Area | TradingView Reference | Current Honba Implementation | Remediation Required |
| :--- | :--- | :--- | :--- |
| **Dynamic Title** | "All stocks" for Stock, "ETF vault" for ETF, "All bonds" for Bond | Title is statically tied to stock presets | Tie default screen title to `activeScreenerType` (`All stocks`, `ETF vault`, `All bonds`, `All mutual funds`). |
| **Filter Bubble Pills** | Dynamic pill row per asset class (Stocks: P/E, EPS; ETF: AUM, Focus, Expense; Bond: YTW, Coupon; MF: Category, AMC, 3Y CAGR) | Single static filter bar primarily displaying stock metrics | Build dynamic filter pill configuration registry `SCREENER_PILL_CONFIG[screenerType]` that renders asset-specific pills. |
| **Table Tabs** | Dynamic tab set (ETF has `Fund flows`, `Holdings`, `NAV`; Bond has `Spreads`, `Yield`, `Coupon`) | Fixed 12 stock-centric tabs for all views | Dynamically switch tabs based on `screenerType` (`HONBA_TABS[screenerType]`). |
| **Open Screen Modal** | Modal with scoped screens per asset class | Hardcoded 11 stock presets in dropdown | Add dedicated `OpenScreenModal` with catalog categorized by asset class. |
| **Keyboard Shortcuts** | `Shift + N` (New Screen), `.` (Open Screen), `Esc` (Close) | No hotkeys | Add global shortcut listener for screen navigation. |

---

## 4. Architecture & Implementation Plan for Honba

### Phase 1: Multi-Asset Filter & Tab Configuration Registry (`filter-config.ts`)

Create a clean modular configuration registry defining the pills and tabs for each asset screener:

```typescript
export interface FilterPillConfig {
  id: string;
  label: string;
  type: 'select' | 'range' | 'multi-select' | 'boolean' | 'custom';
  dropdownKey: string;
  badgeValue?: (state: any) => string | number | null;
  hasActiveFilter?: (state: any) => boolean;
}

export const SCREENER_CONFIG: Record<ScreenerType, {
  defaultTitle: string;
  pillConfigs: FilterPillConfig[];
  tabs: { id: string; label: string }[];
  defaultSort: { field: string; direction: 'asc' | 'desc' };
}> = {
  stocks: {
    defaultTitle: 'All stocks',
    pillConfigs: [
      { id: 'market', label: 'Market', type: 'select', dropdownKey: 'market' },
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      { id: 'index', label: 'Index', type: 'multi-select', dropdownKey: 'index' },
      { id: 'price', label: 'Price', type: 'range', dropdownKey: 'price' },
      { id: 'chg', label: 'Chg %', type: 'range', dropdownKey: 'chg' },
      { id: 'mktcap', label: 'Mkt cap', type: 'select', dropdownKey: 'mktcap' },
      { id: 'pe', label: 'P/E', type: 'range', dropdownKey: 'pe' },
      { id: 'epsGrowth', label: 'EPS dil growth', type: 'range', dropdownKey: 'epsGrowth' },
      { id: 'dividend', label: 'Div yield %', type: 'range', dropdownKey: 'dividend' },
      { id: 'sector', label: 'Sector', type: 'select', dropdownKey: 'sector' },
      { id: 'rating', label: 'Analyst rating', type: 'select', dropdownKey: 'rating' },
    ],
    tabs: STOCK_TABS,
    defaultSort: { field: 'marketCap', direction: 'desc' },
  },
  etf: {
    defaultTitle: 'ETF vault',
    pillConfigs: [
      { id: 'market', label: 'Market', type: 'select', dropdownKey: 'market' },
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      { id: 'assetClass', label: 'Asset class', type: 'select', dropdownKey: 'assetClass' },
      { id: 'focus', label: 'Focus', type: 'select', dropdownKey: 'focus' },
      { id: 'brand', label: 'Brand / AMC', type: 'select', dropdownKey: 'brand' },
      { id: 'aum', label: 'AUM', type: 'range', dropdownKey: 'aum' },
      { id: 'navReturn', label: 'NAV Return', type: 'range', dropdownKey: 'navReturn' },
      { id: 'expenseRatio', label: 'Expense ratio', type: 'range', dropdownKey: 'expenseRatio' },
      { id: 'divYield', label: 'Div yield %', type: 'range', dropdownKey: 'divYield' },
      { id: 'perf', label: 'Perf %', type: 'range', dropdownKey: 'perf' },
    ],
    tabs: ETF_TABS,
    defaultSort: { field: 'aum', direction: 'desc' },
  },
  bonds: {
    defaultTitle: 'All bonds',
    pillConfigs: [
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      { id: 'issuerType', label: 'Issuer type', type: 'select', dropdownKey: 'issuerType' },
      { id: 'issuer', label: 'Issuer', type: 'select', dropdownKey: 'issuer' },
      { id: 'ytw', label: 'YTW %', type: 'range', dropdownKey: 'ytw' },
      { id: 'coupon', label: 'Coupon %', type: 'range', dropdownKey: 'coupon' },
      { id: 'couponType', label: 'Coupon type', type: 'select', dropdownKey: 'couponType' },
      { id: 'maturity', label: 'Maturity date', type: 'range', dropdownKey: 'maturity' },
      { id: 'rating', label: 'Credit rating', type: 'select', dropdownKey: 'rating' },
    ],
    tabs: BOND_TABS,
    defaultSort: { field: 'ytw', direction: 'desc' },
  },
  mf: {
    defaultTitle: 'All mutual funds',
    pillConfigs: [
      { id: 'watchlist', label: 'Watchlist', type: 'boolean', dropdownKey: 'watchlist' },
      { id: 'category', label: 'Category', type: 'select', dropdownKey: 'category' },
      { id: 'amc', label: 'Fund House / AMC', type: 'select', dropdownKey: 'amc' },
      { id: 'aum', label: 'AUM', type: 'range', dropdownKey: 'aum' },
      { id: 'cagr3y', label: '3Y Return %', type: 'range', dropdownKey: 'cagr3y' },
      { id: 'cagr5y', label: '5Y Return %', type: 'range', dropdownKey: 'cagr5y' },
      { id: 'expenseRatio', label: 'Expense ratio', type: 'range', dropdownKey: 'expenseRatio' },
      { id: 'riskometer', label: 'Riskometer', type: 'select', dropdownKey: 'riskometer' },
      { id: 'plan', label: 'Direct / Regular', type: 'select', dropdownKey: 'plan' },
    ],
    tabs: MF_TABS,
    defaultSort: { field: 'aum', direction: 'desc' },
  },
};
```

---

### Phase 2: Screener Store Refactor (`use-screener-store.ts`)

1. **Active Screener State**:
   - `screenerType: 'stocks' | 'etf' | 'bonds' | 'mf'`
   - `setScreenerType(type)`:
     - Automatically resets `activeScreenTitle` to `SCREENER_CONFIG[type].defaultTitle` (e.g. `ETF vault` when ETF is picked).
     - Switches `activeTab` to `SCREENER_CONFIG[type].tabs[0].id` (`Overview`).
     - Loads default preset filters for that asset class.
2. **Multi-Asset Filter State**:
   - Generic or partitioned filter state supporting stock fundamentals, ETF attributes (AUM, expense ratio, asset class), Bond attributes (YTW, coupon, issuer), and MF attributes (CAGR, category, AMC).
3. **Screen Library Scoping**:
   - `getScreensForAsset(screenerType)` returns built-in + user screens specifically for that asset class.

---

### Phase 3: Dynamic Filter Bar Component (`filter-bar.tsx`)

1. **Title Rendering**:
   ```tsx
   const currentConfig = SCREENER_CONFIG[screenerType];
   const title = activeCustomScreen?.name || currentConfig.defaultTitle;
   ```
2. **Dynamic Pill Rendering**:
   - Replace static hardcoded pills with:
   ```tsx
   <div className="tv-filter-pills-row">
     {currentConfig.pillConfigs.map((pill) => (
       <FilterPillButton
         key={pill.id}
         pill={pill}
         isActive={activeDropdown === pill.dropdownKey}
         hasFilterApplied={pill.hasActiveFilter?.(advanced)}
         onClick={() => toggleDropdown(pill.dropdownKey)}
       />
     ))}
     <button className="tv-pill-more-btn" onClick={() => setFilterModalOpen(true)}>
       <Plus size={14} />
     </button>
   </div>
   ```
3. **Dynamic Tabs Rendering**:
   - Map over `currentConfig.tabs` instead of fixed `HONBA_TABS`.

---

### Phase 4: Scoped "Open Screen…" Modal (`open-screen-modal.tsx`)

1. Title: **"Open screen"** with badge indicating the active asset (e.g. `Stocks`, `ETFs`, `Bonds`, `Mutual Funds`).
2. Catalog categorized into:
   - **Popular Screens** (Asset-specific: *ETF Vault*, *Gold & Commodity ETFs*, *High Dividend ETFs*).
   - **Performance & Momentum**.
   - **Value / Yield / Fundamental**.
   - **My Saved Screens** (Filtered by current `screenerType`).
3. Selecting a screen updates the title dropdown label, applies the filter recipe, and closes the modal.
4. Hotkey trigger: Pressing `.` opens the modal instantly; `Shift + N` creates a new custom screen.

---

## 5. Verification & Acceptance Criteria

1. **Title Switching**:
   - Selecting **Stock Screener** displays **"All stocks"** as the primary title.
   - Selecting **ETF Screener** immediately updates title to **"ETF vault"**.
   - Selecting **Bond Screener** immediately updates title to **"All bonds"**.
   - Selecting **MF Screener** immediately updates title to **"All mutual funds"**.
2. **Filter Pills**:
   - Stocks show: Price, Chg%, Mkt cap, P/E, EPS dil growth, Div yield%, Sector, Analyst rating.
   - ETFs show: Asset class, Focus, Brand/AMC, AUM, NAV Return, Expense ratio, Div yield%.
   - Bonds show: Issuer type, Issuer, YTW%, Coupon%, Coupon type, Maturity, Rating.
   - MFs show: Category, AMC, AUM, 3Y Return, 5Y Return, Expense ratio(Base+Total),          
      Riskometer, Sharpe ratio,Type - Liquid/growth/debt/hybrid etc
      

0.69%
0.53%
-0.89
Cat Total Exp. RatioCat Total Exp. Ratio
Average total expense ratio of all the direct mutual fund schemes in the category

Cat Sharpe RatioCat Sharpe Ratio
Average sharpe ratio of all the direct mutual fund schemes in the category

PE RatioPE Ratio
Price to earnings ratio

3. **Tabs Consistency**:
   - Table tabs dynamically reflect the asset domain without broken column layouts.
4. **Open Screen Catalog**:
   - Modal displays relevant screens scoped to the selected instrument class.
