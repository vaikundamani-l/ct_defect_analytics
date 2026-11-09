# CT Defect Analytics

## Run locally or Deploy to GitHub

### 1. Hosted on GitHub Pages / Web Server (Recommended)
When uploaded to a GitHub repository with GitHub Pages enabled (or served on any HTTP/HTTPS web server):
- The dashboard automatically fetches `CT Defects-1.xlsx` from the same location (`./CT Defects-1.xlsx`).
- Anyone opening the site gets instant access with **zero setup or manual uploading required**.
- All processing and aggregations run **100% locally in the user's browser** via SheetJS and Chart.js.
- Workbooks are cached locally in the browser's IndexedDB, so subsequent visits or offline usage load instantly without re-downloading.

### 2. Broken Link & Offline Fallback
- If the file link is broken (e.g. 404, file moved, or network failure), the dashboard automatically checks local IndexedDB storage to restore any previously cached data.
- If no cache is found, the application gracefully prompts the user with a prominent **"📁 Choose CT Defects-1.xlsx"** button to pick the file directly from their device.

### 3. Local File System (`file://`)
1. Extract or clone this repository into a folder.
2. Double-click `index.html` in Chrome, Edge, or Firefox.
3. Due to browser security restrictions on the `file://` protocol, direct fetching is blocked; click **Choose CT Defects-1.xlsx** to select the workbook once.
4. The dashboard will automatically cache the workbook in IndexedDB for subsequent local launches.

No backend, server setup, or build step is required. Internet access is only needed once to load the pinned Chart.js (v4.4.8) and SheetJS (v0.20.3) CDN scripts. All analytics run entirely within client memory.

## Included

- `index.html`: application shell.
- `styles.css`: responsive interface.
- `engine.js`: date normalization, central filters, aggregation and CSV export.
- `app.js`: Excel import, all pages, slicers, chart interactions and exports.
- `CT Defects-1.xlsx`: original source workbook.
- `VALIDATION.md`: completed checks and verification limits.

## Working with filters

The top filter panel contains only Year and Month count tiles. Year and Month use the Excel `Date` column (column 2); when a row has no valid Date value, its `Xray Date` is used. The dashboard initially selects the current available year and leaves Month unselected. Months show the values available in the selected year. Changing years clears month choices that are no longer available.

Year and Month are shown as visible tile slicers with record counts. Select a Year first to populate the month-wise defect chart. Before a month is selected, Defect-wise Count shows totals for the selected year; selecting a month narrows it to that month and unlocks Day-wise Defect Count. The Dashboard Overview features an interactive Defect Spotting chart, ranking defect counts by their angular degree positions around the tire (0°–360°) with bar, horizontal bar, pie and doughnut view options. Clicking a day filters all remaining visuals to that day. Ctrl, Shift or Command adds another tile or chart value to the current selection.

Click a chart segment to select it, then click again to remove it. Ctrl, Shift or Command preserves existing chart selections when adding another visible value. Use slicers to select categories no longer visible after cross-filtering. Chips remove a dimension's selection. Each chart has a clear button; Clear chart selections preserves slicers; Reset filters clears slicers, chart selections and search. Every row in the dashboard is guaranteed unique; duplicate rows are automatically excluded upon import.

### Unified Dashboard Overview
The **Dashboard Overview** merges all perspectives from the former Responsibility Analysis and Location Analysis pages into a single, cohesive intelligence center:
- **11 Dedicated Count Charts** (all clean, non-stacked single-dimension charts with direct numeric data value labels):
  1. Month-wise defect count (drill sequence, wide full width)
  2. Day-wise defect count (drill sequence, line with numeric data points)
  3. Defect-wise count (drill sequence, top count selector)
  4. Defect Spotting (angular degree distribution 0°–360°)
  5. Defect responsibility (horizontal bar with count values)
  6. TBM machine-wise count (bar with count values)
  7. Curing machine code-wise count (horizontal bar with top selector and count values)
  8. Defect distribution (horizontal bar with top selector)
  9. Defect groups (bar with top count selector and count values)
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
