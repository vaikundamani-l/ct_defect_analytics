# CT Defect Analytics

CT Defect Analytics is a browser-based dashboard for investigating tyre manufacturing defects from Excel workbooks. Filters, charts, summaries, and exports use the records in your current selection.

[Open the dashboard](https://vaikundamani-l.github.io/ct_defect_analytics/)

## Load your data

1. Select **Choose workbook** or **Upload Excel** and open a compatible Excel workbook.
2. Use **Merge Files** to analyze several workbooks together. Duplicate normalized records are removed across the merged files.
3. Use the **Year** and **Month** filters to narrow the period. Select a supported chart element to drill into its category, remove an active filter from its chip, or use **Clear chart selections** to keep your date filters while clearing chart selections.

For local use, clone or download the repository and serve it with a local web server. The dashboard runs in the browser without a backend or build step.

## Explore the dashboard

| Workspace | What you can do |
| --- | --- |
| **Dashboard Overview** | Review defect counts and trends, the Quality Period Summary, and the Factory Quality Scorecard. Investigate leading defects with Pareto charts, the Root Cause Assistant, and the tyre cross-section map. Review machine health, repeat offenders, and process stability. |
| **Machine Analysis** | Compare TBM and curing machines using defect breakdowns, a machine-by-defect heatmap, and a Sankey diagram. |
| **SKU & Specification** | Compare defect patterns by tyre size, green tyre code, defect group, and defect name. |
| **Data Explorer** | Search, sort, and page through matching records. Use **Columns** to choose which fields to display, or open a row for details. |

Use **Presets** to save frequently used filter combinations and **Print Brief** to print the report or save it as a PDF. CSV and Excel exports include all matching rows in the current sort order and use the visible columns.

## How the data is interpreted

- Use a worksheet named `DefectReport`, or a workbook with one data worksheet. Keep the column headers near the top. The required field names are defined in [engine.js](engine.js).
- Date filters use `Date`, with `Xray Date` as a fallback. Records without a usable analysis date can appear in unfiltered totals and are excluded from date-based selections.
- Blank records are skipped and exact duplicates are removed after normalization. Shift is derived from available machine times and is available in record details and exports.
- Dashboard totals count defect records. Calculating a production defect rate requires production-volume data. The daily target compares the average across dates that have matching defect records.
- Period comparisons depend on available data and the active filters.

## Browser storage and deployment

The dashboard reads selected workbook contents locally in your browser. A single imported workbook can be restored from IndexedDB, and preferences and presets are stored in the browser. Chart.js and SheetJS are loaded from CDNs. Offline use depends on the browser having cached the app and its dependencies.

The [GitHub Pages workflow](.github/workflows/deploy.yml) publishes the dashboard from `main`.
