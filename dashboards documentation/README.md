# GATI Data Pipeline Documentation

MkDocs Material documentation for the GATI labour-market data pipeline —
how raw StepStone job postings become classified, dashboard-ready data.

## Local preview

```bash
pip install -r requirements.txt
mkdocs serve
```

Open http://127.0.0.1:8000

## Build

```bash
mkdocs build      # outputs static site to ./site
```

## Deploy (Vercel)

This repo deploys to Vercel as a separate project from the dashboard.
Vercel reads `vercel.json`:

- Build command: `pip install -r requirements.txt && mkdocs build`
- Output directory: `site`

Push to the connected branch and Vercel builds and serves it.

## Structure

- `mkdocs.yml` — site config, navigation, theme
- `docs/` — all content (Markdown)
- `docs/stylesheets/gati.css` — GATI brand theme
- `docs/assets/` — logos
