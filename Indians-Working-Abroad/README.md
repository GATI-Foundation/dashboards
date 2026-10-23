# GATI — Indian Global Mobility Dashboard

## 1. Project Overview

Interactive data dashboard tracking Indian nationals living and working abroad across 10 countries, benchmarked against each country's total foreign-national numbers. Covers three pillars: all-purpose migration (population), employment, and healthcare (nurses). Built as a static HTML/CSS/JavaScript site. All data is stored as files in the `DATASETS/` folder of this repository.

**Live dashboard:** https://velocitydashboard.netlify.app/

**Repository:** https://github.com/Gayathri-KG29/Indians-Working-Abroad-

---

## 2. Technology Stack

| Technology | Usage |
|---|---|
| HTML5 | Page structure (no framework, no build step) |
| CSS3 | Styling via CSS custom properties, fully inline in each HTML file |
| JavaScript (ES6+) | All logic — data fetching, parsing, chart rendering, filters, state |
| Chart.js 4.4.4 | Charts (loaded from CDN) |
| Google Fonts — Poppins | Typography |
| CSV / JSON files | Data source, stored in the repo under `DATASETS/` |
| Google Sheets | Working copy where data is edited before being exported into `DATASETS/` |
| Netlify | Static hosting with auto-deploy from GitHub |
| GitHub | Version control, single `main` branch |

No `package.json`, no build tools, no npm, no backend, no database.

---

## 3. Project Structure

| File | Purpose |
|---|---|
| `index.html` | **Main overview dashboard.** Contains all HTML structure, inline CSS, data-loading script (CSV fetch + parse), and boots `app.js`. Covers all 10 countries across 4 tabs. |
| `app.js` | **Main dashboard logic.** Chart registry, chart renderers (trend, share, snapshot, trend-share), per-chart filter UI builder, KPI calculations, tab navigation, localStorage state persistence. |
| `germany.html` | **Germany country dashboard.** Standalone deep-dive page with 5 tabs (Population, Migration Flows, Employment, Healthcare, Key Insights). Contains inline CSS and data loader that fetches `DATASETS/GERMANY/germany_data.json`. |
| `germany-app.js` | **Germany dashboard logic.** Processes 7 JSON worksheets, renders 18+ charts, executive KPIs, CAGR calculations, and auto-generated insight cards. |
| `japan.html` | **Japan country dashboard.** Standalone deep-dive page with 4 tabs (Overview, Workforce, Healthcare, Key Insights). Contains inline CSS and CSV data loader. |
| `japan-app.js` | **Japan dashboard logic.** Processes ISA residence-status CSV data, renders charts across 17 employment residence categories. Data period: June 2021–June 2025. |
| `gati-logo.png` | GATI Foundation logo displayed in the site header. |
| `DATASETS/` | **All dashboard data.** See the folder layout below. |
| `.gitignore` | Git ignore rules (OS files, editor configs, temp files). |

### `DATASETS/` folder

```
DATASETS/
├── all_reason_combined.csv      ← Overview: all-purpose migration (10 countries)
├── employment_combined.csv      ← Overview: employment (10 countries)
├── healthcare_combined.csv      ← Overview: healthcare / nurses (10 countries)
├── GERMANY/
│   └── germany_data.json        ← Germany page: all 7 worksheets in one file
└── JAPAN/
    └── japan_data.csv           ← Japan page: ISA residence-status data
```

File and folder names are case-sensitive and are referenced directly in the code. Do not rename them without also updating the code (see Section 6).

---

## 4. Data Architecture

```
Google Sheets (working copies, edited by hand)
        │
        ▼
Exported as CSV / JSON and uploaded to DATASETS/ in this repo
        │
        ▼
Browser fetches the files from DATASETS/ on page load (no backend)
        │
        ▼
JavaScript parses → builds DATA tables → renders KPIs + Chart.js charts
        │
        ▼
Static files served from Netlify (auto-deployed from GitHub main branch)
```

### How it works

1. **No backend.** Everything runs client-side in the browser.
2. **No database.** All data is read from files in `DATASETS/`. The live site does not depend on Google Sheets.
3. **No build step.** HTML files are served directly.

### Data flow per page

| Page | Data Source | Fetch Method | Loader Location |
|---|---|---|---|
| `index.html` (Overview) | 3 CSV files in `DATASETS/` | `fetch()` → custom RFC 4180 CSV parser | Inline `<script>` in `index.html` (lines ~710–925) |
| `germany.html` | `DATASETS/GERMANY/germany_data.json` | `fetch()` → `response.json()` | Inline `<script>` in `germany.html` (lines ~475–530) |
| `japan.html` | `DATASETS/JAPAN/japan_data.csv` | `fetch()` → custom CSV parser | Inline `<script>` in `japan.html` (lines ~411–520) |

### Overview page DATA tables

The overview page parses 3 CSV feeds into these internal tables (built in `buildDataTables()` in `index.html`):

| Internal Table | Source Sheet | Filter |
|---|---|---|
| `AllReasons_Stock` | allReasons CSV | `Type === 'Stock'`, excludes USA, France, Poland |
| `AllReasons_Flow_A` | allReasons CSV | `Type === 'Flow'`, countries: Germany, UK, South Korea |
| `AllReasons_Flow_B` | allReasons CSV | `Type === 'Flow'`, countries: France, Poland, Spain, Italy |
| `Employment_Stock` | employment CSV | `Type === 'Stock'`, excludes USA |
| `Employment_Flow` | employment CSV | `Type === 'Flow'`, excludes USA |
| `Healthcare_Nurses_Stock` | healthcare CSV | `Type === 'Stock'`, excludes USA |
| `Healthcare_Nurses_Flow` | healthcare CSV | `Type === 'Flow'`, excludes USA |

### Germany page data store

`germany_data.json` contains 7 worksheets, stored in the `DE` global object:

| Key | Worksheet |
|---|---|
| `DE.masterAnnual` | `Master_Annual` |
| `DE.masterMonthly` | `Master_Monthly` |
| `DE.eurostat` | `employment_Eurostat` |
| `DE.labour` | `germany_foreignLabour status` |
| `DE.healthcare` | `Healthcare` |
| `DE.nursingRank` | `top_10_nursing` |
| `DE.dictionary` | `Data_Dictionary` |

---

## 5. Data Sources

| Data file (in repo) | Purpose | Used By | Edited in (working copy) |
|---|---|---|---|
| `DATASETS/all_reason_combined.csv` | Population stock & flow data (10 countries) | `index.html` | Google Sheet — All Reasons |
| `DATASETS/employment_combined.csv` | Employment stock & flow data (10 countries) | `index.html` | Google Sheet — Employment |
| `DATASETS/healthcare_combined.csv` | Nurse stock & flow data (10 countries) | `index.html` | Google Sheet — Healthcare |
| `DATASETS/GERMANY/germany_data.json` | 7 worksheets: population, migration, employment, healthcare, nursing rankings | `germany.html` | Google Sheet — Germany (exported via its Apps Script) |
| `DATASETS/JAPAN/japan_data.csv` | ISA residence-status data (Jun 2021–Jun 2025) | `japan.html` | Google Sheet — Japan |

---

## 6. Data File Paths in Code

**Overview page** (`index.html`, `CSV_URLS`, lines 716–720):
```
allReasons:  DATASETS/all_reason_combined.csv
employment:  DATASETS/employment_combined.csv
healthcare:  DATASETS/healthcare_combined.csv
```

**Japan page** (`japan.html`, `JP_CSV_URL`, line 415):
```
DATASETS/JAPAN/japan_data.csv
```

**Germany page** (`germany.html`, `DE_API_URL`, line 479):
```
DATASETS/GERMANY/germany_data.json
```

If a data file is renamed or moved, update the matching path above in the code.

### Expected CSV Column Structure (Overview files)

Each of the 3 overview CSV files uses the same wide-format layout:

| Column | Content |
|---|---|
| Column 0 | Theme (e.g., "Population", "Employment", "Healthcare") |
| Column 1 | Type — must be exactly `Stock` or `Flow` |
| Column 2 | Nationality — must be `Indians` or `Total foreigners` |
| Column 3 | Year (integer, e.g., `2024`) |
| Columns 4+ | Country value columns — headers must match: `Germany`, `Japan`, `Italy`, `Spain`, `USA`, `UK`, `South Korea`, `France`, `Canada`, `Poland` |

**Critical formatting rules:**
- Column headers for countries must match the names in the `COUNTRY_HEADERS` array exactly (case-insensitive, whitespace-insensitive).
- Nationality values must contain either `Indian`/`Indians` or text starting with `Total foreign`.
- Numbers can use comma grouping (e.g., `3,71,773` or `155,310`). Commas are stripped during parsing.
- Empty cells or `N/A` values are treated as null and skipped.
- Renaming or removing a country column will cause that country to silently disappear from charts.
- Renaming `Stock`/`Flow` in the Type column will break the stock/flow split.

---

## 7. Data Update Procedure

Editing a Google Sheet no longer changes the live dashboard by itself. After editing, the updated file must be uploaded to `DATASETS/` on GitHub.

### Updating Overview Dashboard Data

1. Open the relevant Google Sheet (All Reasons, Employment, or Healthcare) and edit it. Preserve the column structure exactly.
2. Go to **File → Download → Comma-separated values (.csv)**.
3. Rename the downloaded file to the exact existing name (`all_reason_combined.csv`, `employment_combined.csv` or `healthcare_combined.csv`).
4. On GitHub, open the `DATASETS` folder → **Add file → Upload files** → drop the file in → **Commit changes**. The old file is replaced.
5. Netlify redeploys in about a minute. Hard-refresh the live dashboard (`Ctrl+Shift+R`) to check the new values.

### Updating Japan Data

1. Edit the Japan Google Sheet, then **File → Download → Comma-separated values (.csv)**.
2. Rename the file to `japan_data.csv`.
3. On GitHub, open `DATASETS/JAPAN` → **Add file → Upload files** → **Commit changes**.

### Updating Germany Data

The Germany page needs all 7 worksheets in one JSON file, which a normal CSV download cannot produce. Use the sheet's Apps Script web app to export it:

1. Edit the Germany Google Sheet.
2. Open the Apps Script web app URL in a browser: `https://script.google.com/macros/s/AKfycbyBrI9A912Wg8vp7DXhOcgIXj6NzbS7A-MAZGvgMKQ8up1pxzMTepSiwTHWMCHrBqGigw/exec`
3. Press `Ctrl+S` and save as `germany_data.json` (Save as type: All Files). Check that the name does not end in `.json.txt`.
4. On GitHub, open `DATASETS/GERMANY` → **Add file → Upload files** → **Commit changes**.

The Apps Script (`doGet`, under **Extensions → Apps Script** in the Germany sheet) reads every tab and returns `{ "<tab name>": [ {column: value, ...}, ... ] }`.

**Windows tip:** File Explorer hides file extensions by default. When renaming, type only the name (e.g. `japan_data`), or a second extension gets added (`japan_data.csv.csv`).

### If Code Changes Are Needed

1. Modify the relevant `.html` or `.js` file (locally, or on GitHub with the pencil/edit icon).
2. Test locally (see Section 8).
3. `git add .` → `git commit -m "description"` → `git push origin main` (or **Commit changes** on GitHub).
4. Netlify auto-deploys within ~1 minute.
5. Verify at https://velocitydashboard.netlify.app/

---

## 8. Local Development

### Prerequisites

- A modern web browser
- A local HTTP server (required because `fetch()` does not work with `file://` protocol)

### Running Locally

```bash
# Navigate to the repository root
cd Indians-Working-Abroad-

# Start a local server (any of these work):
python -m http.server 8080
# or
npx serve .

# Open in browser:
http://localhost:8080/
```

There is no `package.json`, no `npm install`, no build step. The files are served as-is.

---

## 9. Code Modification Guide

| Task | File(s) to Modify |
|---|---|
| Change overview chart titles | `index.html` — `<h3>` elements inside `chart-card` divs |
| Change overview KPI labels | `index.html` — `.kpi-label` elements |
| Change overview KPI logic / data source | `app.js` — `renderKPIs()`, `renderFixedYearKPI()`, `renderFixedYearShareKPI()` |
| Add/remove/reorder overview charts | `app.js` — `CHARTS` registry (line ~15) and `TABS_CHARTS` (line ~508); `index.html` — add/remove `chart-card` HTML |
| Change chart rendering (colors, options) | `app.js` — `renderTrendChart()`, `renderShareChart()`, `renderSnapshotChart()`, `lineOptions()`, `barOptions()` |
| Change per-chart filters | `app.js` — `buildChartFilters()` |
| Change which countries are excluded | `index.html` — `buildDataTables()` function (line ~817) |
| Change flow chart country grouping | `index.html` — `FLOW_GROUP_A` and `FLOW_GROUP_B` arrays in `buildDataTables()` |
| Change overview data file paths | `index.html` — `CSV_URLS` object (line ~716) |
| Change Japan / Germany data file paths | `japan.html` — `JP_CSV_URL` (line ~415); `germany.html` — `DE_API_URL` (line ~479) |
| Change overview styling | `index.html` — `<style>` block (lines 10–303) |
| Change Germany dashboard | `germany.html` (HTML/CSS/data loader) + `germany-app.js` (logic/charts) |
| Change Japan dashboard | `japan.html` (HTML/CSS/data loader) + `japan-app.js` (logic/charts) |
| Add a new country profile | Create `country.html` + `country-app.js`; add navigation link in all HTML files' `.country-nav-menu` |
| Change data notes content | `index.html` — Data Notes tab panel (`#tab-notes`) |
| Change site header / logo | All HTML files — `.site-header` section; replace `gati-logo.png` |

---

## 10. Dashboard Pages

| File | Page | JavaScript | Data Source |
|---|---|---|---|
| `index.html` | Multi-country overview (4 tabs: All-purpose migration, Employment, Healthcare, Data Notes) | `app.js` | 3 CSV files in `DATASETS/` |
| `germany.html` | Germany deep-dive (5 tabs: Population, Migration Flows, Employment, Healthcare, Key Insights) | `germany-app.js` | `DATASETS/GERMANY/germany_data.json` |
| `japan.html` | Japan deep-dive (4 tabs: Overview, Workforce, Healthcare, Key Insights) | `japan-app.js` | `DATASETS/JAPAN/japan_data.csv` |


---

## 11. Key Calculations in Code

### Overview Dashboard (`app.js`)

| Calculation | Function | Logic |
|---|---|---|
| KPI totals (Indian count, Foreign count) | `renderFixedYearKPI()` | Sums all `Value` for matching `Year`, `Nationality`, and available countries |
| KPI share (%) | `renderFixedYearShareKPI()` | For each country: `Indian ÷ Total Foreigners × 100`, then averages across countries (unweighted) |
| Healthcare growth KPI | `renderHealthGrowthKPI()` | `((lastYear - firstYear) / firstYear) × 100` per country, then averaged |
| Share bar chart | `renderShareChart()` → `shareRowsForYear()` | Per-country: `Indian ÷ Total Foreigners × 100` for a single year |
| Trend-share chart (nurses) | `renderTrendShareChart()` | Per-country share computed for each year, plotted as time series |

### Important data assumptions encoded in code

- **USA is excluded** from all tables after parsing (`buildDataTables()` in `index.html`).
- **France and Poland are excluded** from `AllReasons_Stock` (population stock) — they use Eurostat permit data, not population registers.
- **Flow data is split** into Group A (Germany, UK, South Korea — national sources) and Group B (France, Poland, Spain, Italy — Eurostat/Istat).
- **Share KPIs** use simple unweighted averages of per-country shares — not a pooled global percentage.
- **Filter state** is persisted to `localStorage` (key: `gati_cState`) so user selections survive page refreshes.

---

## 12. Deployment — Netlify

| Setting | Value |
|---|---|
| Hosting | Netlify (static site) |
| Connected repository | `Gayathri-KG29/Indians-Working-Abroad-` on GitHub |
| Production branch | `main` |
| Build command | None (static files, no build step) |
| Publish directory | `/` (repository root) |
| Auto-deploy | Yes — every push to `main` triggers automatic deployment |
| Netlify config files | None (`netlify.toml`, `_redirects`, `_headers` are not present) |

---

## 13. GitHub Workflow

```
1. Make changes locally
2. Test in browser via local server
3. git status                    # review changes
4. git add .                     # stage changes
5. git commit -m "description"   # commit
6. git push origin main          # push to GitHub
7. Netlify auto-deploys (~1 min)
8. Verify at https://velocitydashboard.netlify.app/
```

- Single branch: `main`
- Remote: `origin` → `https://github.com/Gayathri-KG29/Indians-Working-Abroad-.git`

---

## 14. Environment Variables & Secrets

No environment variables, API keys, tokens, or backend secrets are required by the application. All data is read from static files in `DATASETS/` using relative paths.

---

## 15. Troubleshooting

| Issue | Possible Cause | Check / Fix |
|---|---|---|
| "Unable to load data" error banner | A data file is missing, renamed, or in the wrong folder | Check the file exists in `DATASETS/` with the exact name and capitalisation used in the code (Section 6). Check for double extensions like `.csv.csv` |
| Error when opening an HTML file by double-click | Browsers block `fetch()` on `file://` pages | Use the live site or a local server (Section 8) |
| KPIs show "—" or "No data available" | Data missing for the expected year (2024) or nationality | Check the CSV has rows with `Year=2024` and correct `Nationality` values |
| A country disappeared from charts | Country column header renamed in the sheet | Verify header matches `COUNTRY_HEADERS` array in `index.html` |
| Charts render but with wrong numbers | Number formatting issue in the sheet | Ensure numbers don't have extra spaces; commas are OK |
| Germany page fails to load | `germany_data.json` saved incorrectly (e.g. as a web page or `.json.txt`) | Re-export from the Apps Script URL (Section 7) and check the file opens as plain JSON text |
| Works locally but not on Netlify | Likely a file path case-sensitivity issue | Netlify uses Linux (case-sensitive); check filenames match exactly |
| Filters reset on every visit | `localStorage` cleared or browser in private mode | Expected behavior if localStorage is unavailable |
| Updated sheet values not appearing | The new file was not uploaded to GitHub | Editing Google Sheets alone does not update the site; upload the exported file to `DATASETS/` (Section 7) |

---

## 16. Known Limitations

- **Manual data updates** — data is edited in Google Sheets and exported to `DATASETS/` by hand; there is no automated data pipeline or scraper.
- **No backend** — fully static; no server-side processing, authentication, or access control.
- **Public data** — if the repository is public, the files in `DATASETS/` can be downloaded by anyone.
- **Column name sensitivity** — renaming columns will silently break parsing; there is no validation or error message for structural mismatches.
- **No automated data validation** — incorrect data types or formats in the files will produce wrong numbers without warning.

---

## 17. Known Issues

No known unresolved issues are documented at the time of handover.

---

## 18. Backup / Important Files

| File | Type | Notes |
|---|---|---|
| `DATASETS/` folder | Live data source | The files the dashboard actually loads. Version history is kept by GitHub. |
| Google Sheets (5 spreadsheets) | Working copies | Where data is edited before export. Keep them as the editable source. |
| Germany Apps Script | Export tool | Needed to regenerate `germany_data.json` from the Germany sheet. |

---

## 19. Access & Ownership

The following accounts/services require organizational access for ongoing maintenance:

| Service | What to Transfer |
|---|---|
| **GitHub** | Repository: `Gayathri-KG29/Indians-Working-Abroad-` — collaborator or ownership transfer |
| **Netlify** | Project connected to the GitHub repository — team access or ownership transfer |
| **Google Sheets** (5 spreadsheets) | Editor access to the working-copy spreadsheets used to prepare data |
| **Google Apps Script** | The Germany sheet's Apps Script — needed to export `germany_data.json` |

> **Note:** The live site only needs GitHub and Netlify. Google Sheets and Apps Script access is needed only to prepare data updates.
