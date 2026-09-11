# Deploy to Dashboard

**Input:** `construction.csv` (from Stage 3) · **Result:** live on the dashboard

The final CSV drops into the dashboard repo's country folder and the dashboard picks it up automatically.

## Where the file goes

The dashboard organises data by country. Germany's sector CSVs live in `data/germany/`:

```
gati-dashboard/
└── data/
    └── germany/
        ├── hospitality.csv
        ├── logistics.csv
        ├── healthcare.csv
        └── construction.csv   ← drop the Stage 3 output here
```

The filename must match the sector `id` registered in `assets/js/sectors.js`. For construction that's `construction.csv`.

## Steps

1. **Rename** the Stage 3 output to the sector id: `construction.csv`.
2. **Place** it in `data/germany/`.
3. **Commit and push** to the dashboard repo — Vercel redeploys automatically.
4. **Hard-refresh** the live site (Ctrl/Cmd + Shift + R) to clear cached files.

```bash
# from the dashboard repo root
cp ~/Downloads/construction.csv data/germany/construction.csv
git add data/germany/construction.csv
git commit -m "Add construction sector data"
git push
```

## How the dashboard reads it

The dashboard is deliberately simple about this — it reads the `Employer_Category` name straight from the CSV and does the rest at runtime:

- **Occupations** come from `ISCO_4` / `ISCO_4_name`, rolled up to the 3- and 2-digit groups for the classification views.
- **Employer sectors** come from `Employer_Category`, rolled up to the ISIC-2 division for display. Nothing is derived from code columns at runtime.
- The **landing card** counts the postings live from the CSV, so the number updates itself the moment the file changes.

!!! tip "Verify the deploy"
    After pushing, open the sector's dashboard and check the footer build stamp and the landing-card count. If the count looks stale, hard-refresh — the browser may be serving a cached copy of the old CSV.

## Confidence filter

Because Stage 3 wrote `Employer_Category_Confidence_Level`, the dashboard's **"Hide unclear employer categories"** filter works out of the box. It defaults **on**, so `Low`-confidence rows are hidden until the user chooses to include them — keeping the headline employer-sector figures clean.

## That's the full loop

```
raw scrape → Stage 1 (Colab) → Stage 2 (Kaggle) → Stage 3 (JSX) → data/germany/ → live
```

To repeat the whole thing for another sector or country, see the reference guides:

- **[Adding a New Sector](../reference/new-sector.md)**
- **[Adding a New Country](../reference/new-country.md)**
