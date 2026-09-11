# Data Schema

The pipeline converges on one strict output: a **23-column CSV** in a fixed order. This is the contract between the data engineering and the dashboard — the dashboard's loader expects exactly these columns. Stage 2 enforces the schema; Stage 3 adds the employer-sector columns on top.

## The 23-column dashboard schema

This is what `construction_final.csv` looks like when it leaves Stage 2.

| # | Column | Origin | Meaning |
|---|--------|--------|---------|
| 1 | `Job_Title` | Scrape → translated | Advertised job title (English after Stage 2). |
| 2 | `Job_Category` | Scrape | StepStone's own category label (kept in German — used as a classification signal). |
| 3 | `ISCO_4` | Stage 1 | 4-digit ISCO-08 unit-group code. |
| 4 | `ISCO_3` | Stage 1 | 3-digit minor group (derived from `ISCO_4`). |
| 5 | `ISCO_2` | Stage 1 | 2-digit sub-major group (derived from `ISCO_4`). |
| 6 | `ISCO_4_name` | Stage 1 | Official ILO title for the 4-digit code. |
| 7 | `State` | Scrape → backfilled | German federal state (Bundesland). |
| 8 | `City` | Scrape | City. |
| 9 | `Company_Name` | Scrape | Employer name as advertised. |
| 10 | `Employer_Category` | **Stage 3** | Official ISIC name of the employer's sector. |
| 11 | `Date_Posted` | Scrape | Date the posting appeared. |
| 12 | `Employment_type` | Scrape | Full-time / part-time / etc. |
| 13 | `Salary` | Scrape | Salary text if present. |
| 14 | `Description` | Scrape → translated | Full ad body (English after Stage 2). |
| 15 | `Requirements` | Scrape → translated | Requirements section (English). |
| 16 | `Benefits` | Scrape → translated | Benefits section (English). |
| 17 | `Work_Type` | Scrape / derived | On-site / hybrid / remote signal. |
| 18 | `Sector` | Config | Corridor label, e.g. `construction`. |
| 19 | `Date_Scraped` | Scrape | When the row was collected. |
| 20 | `Job_URL` | Scrape | Link to the original posting. |
| 21 | `Job_ID` | Stage 1 | Sequential unique ID, `Job-1`, `Job-2`, … |
| 22 | `ISCO_Source` | Stage 1 | How the code was assigned (see below). |
| 23 | `ISCO_Reclassified` | Stage 1 | `Yes` if the original scrape code was overridden. |

## Employer-sector columns (added in Stage 3)

Stage 3 writes the employer-sector classification. `Employer_Category` (column 10 above) is filled with the chosen level's official name, and these supporting columns are added:

| Column | Meaning |
|--------|---------|
| `Employer_ISIC_4` | 4-digit ISIC Rev.4 class code. |
| `Employer_ISIC_3` | 3-digit group (derived). |
| `Employer_ISIC_2` | 2-digit division (derived) — **what the dashboard displays**. |
| `Employer_Category_ISIC4` | 4-digit class name (reference). |
| `Employer_Category_ISIC3` | 3-digit group name. |
| `Employer_Category_ISIC2` | 2-digit division name. |
| `Employer_Category_Confidence_Level` | `High` / `Medium` / `Low` — drives the dashboard's "Hide unclear categories" filter. |
| `Employer_Type_Raw` | Original poster-type field, preserved. |

!!! info "Why the dashboard reads `Employer_Category` directly"
    The dashboard never derives sectors from code columns at runtime — it reads the `Employer_Category` name straight from the CSV and rolls it up to the ISIC-2 division for display. Whatever Stage 3 writes into that column is exactly what the dashboard shows. This is a deliberate design rule.

## The `ISCO_Source` values

`ISCO_Source` records **how** each occupation code was assigned — a full audit trail:

| Value | Meaning |
|-------|---------|
| `Pre-existing` | The scrape already carried a valid ISCO code; kept as-is. |
| `Lexicon:<rule>` | Matched a deterministic German lexicon rule. |
| `Category_map` | Mapped from a StepStone sub-category that maps 1:1 to a unit group. |
| `Gemini` / `Claude` | Assigned by the AI fallback (validated against the official list). |
| `No_rule_match` / `Needs_Review` | No confident classification — flagged for review, never given a fake code. |

## Codes are always official

Both classification systems validate every code against an official reference table loaded at runtime:

- **ISCO-08** — the ILO "ISCO-08 EN Structure and definitions" workbook (436 unit groups).
- **ISIC Rev.4** — the UN "ISICRev4" reference CSV.

If any row ends a run with a code that isn't in the official table, an **integrity check aborts the export**. This is the single most important guarantee in the pipeline: the dashboard can trust that every code is real.
