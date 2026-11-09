# CT Defect Analytics

## Client-Side Architecture & Privacy

This application is built with a **100% client-side privacy architecture**:
- **Data files are maintained locally only**: `CT Defects.xlsx` and other raw data files are never committed to GitHub or sent to any remote server (enforced via `.gitignore`).
- **Browser-local processing**: All Excel parsing (via SheetJS) and visualization (via Chart.js) occur purely in your browser's memory on your machine.
- **Offline persistence**: When you choose `CT Defects.xlsx`, it is stored in your browser's private local IndexedDB (`CTDefectDB`), allowing the dashboard to remember your data across reloads and offline sessions without external server communication.

## How to Run

### 1. Hosted on GitHub Pages (or any Web Server)
1. Open the hosted dashboard URL (e.g. `https://vaikundamani-l.github.io/ct_defect_analytics/`).
2. Click **Choose workbook** (or **Upload Excel**) to select your local `CT Defects-1.xlsx`.
3. The dashboard loads your quality data instantly and saves it to local browser storage for future visits.

### 2. Local File System (`file://`)
1. Clone or download this repository to your computer.
2. Double-click `index.html` in Chrome, Edge, or Firefox.
3. Click **Choose CT Defects-1.xlsx** to select your workbook from your device.

No backend, database, or build step is required. Internet access is only needed to fetch the pinned Chart.js (v4.4.8) and SheetJS (v0.20.3) CDN scripts.

## Included Files (GitHub Repository)

- `index.html`: application shell, PWA metadata, and layout.
- `styles.css`: clean manufacturing interface styling.
- `enhancements.css`: tile slicers (Year, Month), quality badge, and `@media print` executive styling.
- `engine.js`: date normalization, uniqueness enforcement, shift categorization (`Shift A: 06-14`, `Shift B: 14-22`, `Shift C: 22-06` for data reporting), filtering, aggregation, and export utilities.
- `app.js`: client-side Excel ingestion, Chart.js rendering (Pareto dual-axis, Polar Clock radial area, single-dimension bars/lines), slicer controls, 17-column data table with Shift, and offline IndexedDB cache management.
- `manifest.json`: Web App Manifest for Progressive Web App (PWA) installation.
- `icon.svg`: vector tire crosshair quality icon.
- `sw.js`: Service Worker providing offline caching for application shell and CDN dependencies.
- `.github/workflows/deploy.yml`: automated GitHub Pages deployment workflow on push to `main`.
- `.gitignore`: ensures Excel workbooks (`*.xlsx`, `*.xls`, `*.csv`) remain local and are never pushed to GitHub.
- `README.md`: user guide and architecture documentation.
- `VALIDATION.md`: test results and verified limits.

*(Note: `CT Defects-1.xlsx` is maintained strictly on your local computer).*

## Working with filters & Analytics Features

### 1. Dynamic Tile Slicers
- **Year & Month Slicers**: Visual tile slicers with real-time record counts driven by the Excel `Date` column (column 2; fallback: `Xray Date`).
- **Separated Shift Scope**: Production Shift is preserved exclusively in the Defect records table and data exports (not in slicer filters or chart analytics), ensuring analytics remain focused on machinery, tyre sizes, and defect topology.

### 2. Pareto 80/20 Rule Analysis
- Dual-axis chart with **Bar (Defect Count)** on the primary axis (y) and **Line (Cumulative %)** on the secondary axis (y1) reaching 100%.
- Includes a prominent dashed **80% Cutoff Threshold Line** to instantly pinpoint the "vital few" defect types responsible for 80% of factory scrap.
- Enabled by default on **Defect-wise count** and switchable on **Defect groups** and **Tyre Size defect distribution**.

### 3. Polar / Clock View for Defect Spotting
- Defect Spotting reflects angular positions (0°–360°) around the tire circumference.
- Rendered natively as a radial **Polar Area Clock Chart**, visualizing spatial defect clusters around the tire.

### 4. Statistical Process Control (SPC) & Anomaly Detection
- Daily defect run chart with automated **$3\sigma$ Upper Control Limit (UCL)**, **Mean ($\bar{X}$)**, and **Lower Control Limit (LCL)**.
- Automatically detects and flags **Out-of-Control Anomaly Spikes** exceeding UCL with red warning badges and alert indicators.
- Operates 100% on internal defect record variations without requiring external production volume figures.

### 5. Automated Root Cause Intelligence Assistant
- Multi-dimensional diagnostic assistant for any selected defect (or overall leading defect).
- Automatically attributes defect concentrations across **Defect Responsibility** (responsible manufacturing department, e.g. TBM, Curing), **Curing Machines**, **TBM Machines**, **Tyre Sizes**, and **Physical Circumference Angles**.
- Displays interactive diagnostic tiles with 1-click drill-down filtering, header badge context, and human-readable diagnostic synthesis takeaways.

### 5b. Interactive Chart Highlighting & Bar Selection
- **Defect-wise count Pareto chart**: Styled in clean, uniform single-color blue (`#3674e8cc`) (not multi-color rainbow) with a pink cumulative 80/20 line.
- **Consistent dark highlighting**: Clicking any bar in Defect-wise count (or any chart across the dashboard) highlights the selected item in dark blue (`#153f98`) with a high-contrast dark border (`#0f295e`, 2.5px width).
- **Other elements preserve their colors**: When an item is selected, all other items keep their exact same colors without changing or fading.
- Re-clicking the selected item unselects it and restores the normal border.

### 6. Interactive Tire Anatomical Cross-Section Map
- Vector SVG cross-section visualizing defect density across physical tire zones: **Crown / Tread**, **Shoulder**, **Sidewall**, **Bead Area**, and **Innerliner**.
- Zones dynamically heat-map from cool blue to alert red based on defect frequency.
- Clicking any zone or legend item instantly filters the entire dashboard by that physical zone.

### 7. Machine × Defect Correlation Heatmap Matrix
- 2D grid matrix on the **Machine Analysis** workspace mapping Machinery (TBM or Curing) against Top Defect Types.
- Color intensity gradient visualizes defect density per machine; clicking any cell isolates that machine-defect pair.

### 8. Product / SKU Quality Profiling (`Size` & `Green Tyre Code`)
- Dedicated **SKU & Specification** workspace featuring:
  - **Tyre Size Defect Distribution & Pareto**: Analysis across all commercial tire sizes (`Curing Tyre Size`).
  - **Green Tyre GT Code Breakdown**: Defect frequency across tire building specs (`TBM GT Code`).
  - **Tyre Size × Defect Group** and **Top Defects by Tyre Size** cross-tabulations.

### 9. Control Room Dark Mode & Quality Target Setting
- High-contrast **🌙 Dark Mode / ☀️ Light Mode** toggle tailored for factory control rooms, test labs, and dark plant floors.
- **Custom Daily Defect Target Setting**: Set factory defect thresholds (e.g. Target $\le 50$ defects/day) with live dynamic comparison badges (`✓ Within Target` vs `⚠️ Exceeding Target`).

### 10. Defect Records Table & Data Exports
- Displays all matching defect records with **17 columns** including a dedicated **Shift** column (`Shift A (06-14)`, `Shift B (14-22)`, `Shift C (22-06)`).
- Full interactive sorting on all headers including Shift.
- Row inspection modal displaying full record metadata including Shift.
- Full CSV and Excel exports including Shift column.
- **Defect Recurrence Badges**: Recurring barcode defects are visually tagged with `🔁 2x` recurrence badges.
- **Conditional Row Highlighting**: Color-codes rows based on severity (top 3 critical defects in red, recurring defects in amber).
- **Column Visibility Toggle**: Show/hide any of the 17 columns with state saved to `localStorage`.

### 11. KPI Trend Badges (Period-over-Period % Change)
- Real-time month-over-month or period-over-period trend badges on primary KPI cards (`Total Defect Records`, `Unique Barcodes`, `Defect Names`).
- Dynamic directional indicators (`↑` increase in red, `↓` decrease in green, `→` flat in neutral).

### 12. Automated Quality Period Summary
- Automatically synthesized text narrative highlighting leading defect types, machine concentrations, and SPC process stability events for the active date filter.

### 13. Repeat Offender Machine Detection
- Intelligent statistical detection identifying machinery that consistently produces specific defect types above plant average.
- Categorizes concentration risk levels (`CRITICAL`, `WARNING`, `WATCH`); clicking any row automatically isolates the machine and defect on the dashboard and removes that item from the active offender view.

### 14. Pareto Progress Tracker
- Tracks month-over-month performance of the historical "vital few" top 5 defect categories to verify whether corrective actions actually reduced defects. Side-by-side with Quality Period Summary in an aligned single-row layout.

### 15. Cumulative Defect Tracker & Target Curve
- Running cumulative defect chart comparing actual defect accumulation against custom factory targets over the period.

### 16. Defect → Machine Flow (Sankey Diagram)
- Interactive flow diagram on the **Machine Analysis** workspace mapping defect types to originating machines with flow-width proportional to defect volume.

### 17. Saved Filter Presets & Bookmarks
- Save named filter configurations to browser local storage for instant 1-click recall of frequent investigation filters.

### 18. Multi-File Excel Merge
- Merge multiple Excel workbooks simultaneously via the `⊕ Merge Files` action, automatically deduplicating records across all files upon ingestion.

### 19. Data Annotations & Notes
- Attach persistent engineer notes and quality memos to specific barcodes/records, stored locally in IndexedDB/localStorage.

### 20. Executive Print / PDF Quality Brief
- Click the **⎙ Print Brief** button in the header (or press `Ctrl+P`) to generate an executive-ready 2-column quality summary.
- Print stylesheets (`@media print`) hide navigation sidebars, controls, and pagination, producing an immaculate physical or PDF briefing.

### 21. PWA & Offline Installation
- Fully installable as a standalone desktop application via Chrome/Edge ("Install App").
- Powered by `sw.js` Service Worker and IndexedDB (`CTDefectDB`), enabling 100% offline usage with zero internet dependency once loaded.

### 22. Automated GitHub Pages CI/CD
- GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically builds and deploys the dashboard to GitHub Pages on every push to `main`.

### Unified Workspaces & Navigation
The navigation bar is cleanly organized into 4 focused workspaces:
1. **Dashboard Overview**: Root Cause Assistant with Defect Responsibility tile, Tire Cross-Section Map, 10 dedicated defect charts (redundant duplicate Defect distribution removed in favor of Pareto Defect-wise count drill), summary KPI cards, and quality uniqueness badge.
2. **Machine Analysis**: Machine × Defect Heatmap Matrix, TBM & Curing machine-wise counts, and machine-defect split distributions.
3. **SKU & Specification**: Tyre Size Pareto, Green Tyre GT Code breakdown, and SKU defect matrices.
4. **Data Explorer**: Full defect records table with column sorting, pagination, debounced search across all 16 fields, and CSV/Excel exports.
- **Side Navbar Hide / Expand Option**: Toggle the side navigation on or off via the `☰ Navbar` header button or the `⇦ Hide` button inside the sidebar. Hiding the sidebar expands the entire dashboard to 100% full width (`margin-left: 0`) for maximum charting canvas area, automatically triggering Chart.js canvas refits and persisting user preference in `localStorage`.
- **Defect Records Explorer**: Clean full-width records table at the bottom of the dashboard with search across all 16 fields, pagination, column sorting, and CSV/Excel exports (redundant bottom breakdown tables removed for a clean, chart-first interface).

Data Explorer search applies to the entire dashboard. Search covers the 16 displayed fields. Sort column headers, adjust page size, and click a row or press Enter to inspect it. Exports include every matching row, in current sort order, not only the visible page. Both CSV and Excel contain all 16 fields (including the Excel 2nd column Date). CSV prefixes potentially executable spreadsheet formulas with an apostrophe; Excel writes strings. Normalized dates are exported as YYYY-MM-DD. Unrecognized date text is retained.

The filtered data table is also displayed at the bottom of every analysis page. It supports vertical and horizontal scrolling, pagination, sorting, search, row details, and the same CSV/Excel exports.

## Data policy

- Only the 16 retained fields (including Excel column 2 Date) are read. All other workbook fields are ignored.
- Exact matching headers must appear within the first 51 used rows of `DefectReport`.
- Whitespace around field values is trimmed; category case is preserved.
- Non-empty numeric and text barcodes are normalized to strings. Numeric barcode cells with displayed leading zeros preserve those zeros. Precision already lost inside Excel cannot be recovered.
- DD/MM/YYYY, D/M/YY (2000–2099), YYYY-MM-DD, YYYY/MM/DD, day-month-name-year and Excel serial dates are supported. Excel's 1904 date system is honored; the fictitious 1900-02-29 is rejected. Unrecognized formats are reported rather than guessed.
- Missing or invalid Date/Xray Date values remain in unfiltered totals. They cannot match Year/Month filters. TBMDate and Curing Date remain record fields but do not drive the date hierarchy.
- Rows empty across all 16 selected fields are skipped. A non-empty selected field keeps the row. Excel error cells are treated as missing values.
- Every row in this project is guaranteed unique: duplicate rows across the 16 normalized fields are excluded automatically upon import, keeping the first occurrence.
- Missing category values are excluded from category charts and distinct-value KPIs, and the omitted count is disclosed beneath each chart. They remain in total records.
- Counts represent defect records, not defect rates: production-volume denominators are not available.
- Year-over-year percentages require a single selected year, an immediately preceding year and shared available months under the same other filters. Only shared months are compared. Partial-month coverage is not assumed complete. No percentage is fabricated when comparison data is absent.

## Verified baseline

| Metric | Count |
|---|---:|
| Defect records | 14,627 |
| Distinct non-empty barcodes | 14,624 |
| Defect names | 160 |
| Defect groups | 86 |
| Defect areas | 11 |
| Responsibility categories | 7 |
| Exact duplicate rows | 0 |
| Missing or invalid TBMDate | 0 |

Available TBM periods: November–December 2025 (34 rows) and January–October 2026 (14,593 rows). These years have no shared months, so this workbook correctly produces no year-over-year percentage.
