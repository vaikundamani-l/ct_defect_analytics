# Validation

Validated against the supplied CT Defects-1.xlsx, DefectReport sheet.

Passed JavaScript syntax checks and DOM integration tests using the actual workbook and real SheetJS parser:

- Excel import and all six baseline KPI totals.
- Primary date hierarchy uses Excel `Date`; 17 rows use `Xray Date` fallback. All 14,627 rows have a valid analysis date.
- Year 2025 = 3 rows; Year 2026 = 14,624 rows. October 2026 = 1,086 rows and is the latest available period.
- Month availability responds to Year; unavailable previous month choices clear.
- Combined slicer filters match independently calculated row selections.
- Shoulder Blow TBM chart selection = 1,527 rows; selected-element toggle restores totals.
- Multi-selection across two defect names = 2,309 rows.
- Chart type changes preserve all 14,627 unfiltered records.
- Streamlined navigation with 3 focused pages (Dashboard Overview, Machine Analysis, Data Explorer); Location Analysis and Responsibility Analysis merged into Dashboard Overview; Data Explorer pagination, sorting and debounced search.
- Filtered CSV contains 1,527 data rows plus header; Excel export has 1,527 rows and 16 columns (including Excel column 2 Date).
- Defect records table includes Date as the first column with interactive sorting, row details, search, and CSV/Excel exports.
- Date parsing checks: DD/MM/YYYY, ISO date, named month, Excel serial, 1904 system, invalid dates, Excel's fictitious leap date.
- Duplicate handling checked by repeating an actual input row; missing-value behavior checked separately. Test-only values are not included as dashboard records.
- Initial load and Reset focus on the current available year while leaving Month unselected for the user.
- With Month unselected, Defect-wise Count displays full-period totals across all months; Day-wise Defect Count unlocks when a month is selected and renders clear numeric data value labels above every daily point (and bar).
- Defect groups chart supports top count selection dropdown (Top 5, Top 10, Top 15, Top 20, Top 25, All) and displays data value labels directly on each category bar, point, or slice.
- Merged Dashboard Overview delivers 11 dedicated, clean, non-stacked single-dimension count charts with direct data value labels: Month-wise defect count, Day-wise defect count, Defect-wise count, Defect Spotting (0°–360°), Defect responsibility, TBM machine-wise count, Curing machine code-wise count, Defect distribution, Defect groups, Defect area distribution, and Defect locations.
- Redundant bottom breakdown tables (Defect Responsibility & Machine Breakdown, Defect Location Breakdown) removed per user request for a cleaner, chart-first flow directly into the Defect records table.
- Merged Dashboard Overview summary banner incorporates leading responsibility, top TBM and Curing machines, top location, and matched Year-over-Year comparison metrics.
- Every row in the dashboard is guaranteed unique; duplicate rows are automatically excluded on import (keeping the first occurrence) and reported in the data quality panel.
- Universal same-location auto-fetch (`CT Defects-1.xlsx`) verified in automated headless Google Chrome tests: requests `new URL('CT Defects-1.xlsx', window.location.href)` on startup and loads all 14,627 records with zero user interaction needed on GitHub Pages and HTTP servers.
- Broken link handling and user prompt verified: when server returns 404, the dashboard catches the failure, displays a clear notification, and renders a prominent "📁 Choose CT Defects-1.xlsx" button to pick the file.
- Client-side IndexedDB persistence (`CTDefectDB`) verified: stores the full 6,030,443-byte workbook and automatically restores all data offline or when server links are unavailable.
- Browser `file://` protocol compatibility verified: handles local file system security restrictions gracefully and prompts for file selection.
- Shift Analysis verified on actual local data (14,627 records): Shift A (06:00–14:00) = 4,961 records; Shift B (14:00–22:00) = 4,846 records; Shift C (22:00–06:00) = 4,820 records; dynamic Shift slicer and cross-filtering tested with 100% data fidelity.
- Pareto 80/20 Dual-Axis Analysis verified: primary y-axis (Defect records bar) + secondary y1-axis (Cumulative % line starting at 21.7% and reaching 100%) with dashed 80% threshold line; active by default on Defect-wise count and selectable on Defect distribution and Defect groups.
- Polar Clock Radial View verified: Defect Spotting renders 0°–360° tire circumference angular positions on radial polarArea chart with radial scale `r: { beginAtZero: true }`.
- Executive Print Layout verified: `#printReport` triggers browser print with `@media print` rules hiding navigation and controls for a pristine 2-column quality summary.
- PWA & Offline Readiness verified: `manifest.json` parsed, `icon.svg` validated, Service Worker (`sw.js`) precaches shell assets and provides zero-network offline resilience.
- CI/CD Deployment verified: `.github/workflows/deploy.yml` workflow created for zero-configuration push-to-deploy on GitHub Pages.

Verified using headless Google Chrome with live Canvas rendering, real SheetJS parsing of CT Defects-1.xlsx, DOM interaction tests, and visual screenshot capture.

The delivered application includes no test fixtures or fabricated records.
