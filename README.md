# CT Defect Analytics

## Client-Side Architecture & Privacy

This application is built with a **100% client-side privacy architecture**:
- **Data files are maintained locally only**: `CT Defects-1.xlsx` and other raw data files are never committed to GitHub or sent to any remote server (enforced via `.gitignore`).
- **Browser-local processing**: All Excel parsing (via SheetJS) and visualization (via Chart.js) occur purely in your browser's memory on your machine.
- **Offline persistence**: When you choose `CT Defects-1.xlsx`, it is stored in your browser's private local IndexedDB (`CTDefectDB`), allowing the dashboard to remember your data across reloads and offline sessions without external server communication.

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
- `enhancements.css`: tile slicers (Year, Month, Shift), quality badge, and `@media print` executive styling.
- `engine.js`: date normalization, uniqueness enforcement, shift categorization (`Shift A: 06-14`, `Shift B: 14-22`, `Shift C: 22-06`), filtering, aggregation, and export utilities.
- `app.js`: client-side Excel ingestion, Chart.js rendering (Pareto dual-axis, Polar Clock radial area, single-dimension bars/lines), slicer controls, and offline IndexedDB cache management.
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
- **Shift Analysis Slicer**: Automatically categorizes records into manufacturing shifts based on `TBMTime` and `Curing Time`:
  - **Shift A (06:00 – 14:00)**: 4,961 records
  - **Shift B (14:00 – 22:00)**: 4,846 records
  - **Shift C (22:00 – 06:00)**: 4,820 records
  Click any shift tile to instantly filter the entire dashboard by shift.

### 2. Pareto 80/20 Rule Analysis
- Dual-axis chart with **Bar (Defect Count)** on the primary axis (y) and **Line (Cumulative %)** on the secondary axis (y1) reaching 100%.
- Includes a prominent dashed **80% Cutoff Threshold Line** to instantly pinpoint the "vital few" defect types responsible for 80% of factory scrap.
- Enabled by default on **Defect-wise count** and switchable on **Defect distribution** and **Defect groups**.

### 3. Polar / Clock View for Defect Spotting
- Defect Spotting reflects angular positions (0°–360°) around the tire circumference.
- Rendered natively as a radial **Polar Area Clock Chart**, visualizing spatial defect clusters around the tire.

### 4. Executive Print / PDF Quality Brief
- Click the **⎙ Print Brief** button in the header (or press `Ctrl+P`) to generate an executive-ready 2-column quality summary.
- Print stylesheets (`@media print`) hide navigation sidebars, controls, and pagination, producing an immaculate physical or PDF briefing.

### 5. PWA & Offline Installation
- Fully installable as a standalone desktop application via Chrome/Edge ("Install App").
- Powered by `sw.js` Service Worker and IndexedDB (`CTDefectDB`), enabling 100% offline usage with zero internet dependency once loaded.

### 6. Automated GitHub Pages CI/CD
- GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically builds and deploys the dashboard to GitHub Pages on every push to `main`.

### Unified Dashboard Overview
The **Dashboard Overview** merges all perspectives from the former Responsibility Analysis and Location Analysis pages into a single, cohesive intelligence center:
- **11 Dedicated Count Charts** (all clean, non-stacked single-dimension charts with direct numeric data value labels):
  1. Month-wise defect count (drill sequence, wide full width)
  2. Day-wise defect count (drill sequence, line with numeric data points)
  3. Defect-wise count (Pareto 80/20 dual-axis bar + cumulative % line)
  4. Defect Spotting (Polar Clock radial degree distribution 0°–360°)
  5. Defect responsibility (horizontal bar with count values)
  6. TBM machine-wise count (bar with count values)
  7. Curing machine code-wise count (horizontal bar with top selector and count values)
  8. Defect distribution (horizontal bar with top selector, switchable to Pareto)
  9. Defect groups (bar with top count selector and count values, switchable to Pareto)
  10. Defect area distribution (doughnut chart)
  11. Defect locations (horizontal bar)
- **Unified Summary Insights**: Highlights top responsibility category, leading TBM machine, leading Curing machine, top defect location, and Year-over-Year comparison in a single header banner.
- **Streamlined Navigation**: The navigation bar is cleanly organized into 3 focused workspaces: **Dashboard Overview**, **Machine Analysis**, and **Data Explorer**.
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
