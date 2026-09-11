# Adding a New Country

The dashboard is built as a country layer: Germany is the first corridor, but the architecture expects others.

## Data layout

Each country gets its own folder under `data/`:

```
data/
├── germany/
│   ├── hospitality.csv
│   └── construction.csv
└── japan/            ← a new country
    └── ...
```

## The country registry

Countries are registered in `assets/js/sectors.js`. The `?country=` URL parameter selects which folder the dashboard loads from, defaulting to `germany`. The splash → country-selection → sector-landing → dashboard flow is already built to accommodate additional countries.

## What changes per country

| Item | Change |
|------|--------|
| Classification | ISCO-08 is international — no change. ISIC Rev.4 is international — no change. |
| Translation | Swap the opus-mt model for the source language (e.g. `opus-mt-ja-en` for Japanese). |
| States/regions | Replace the German `STATE_MAP` with the country's administrative regions. |
| Lexicon | Rebuild for the source language's occupational vocabulary. |
| Registry | Add the country to the registry and create its data folder. |

## The classifications are portable

Because both ISCO-08 (occupations) and ISIC Rev.4 (industries) are international standards, the *classification targets* never change between countries — only the language-specific inputs (the lexicon, the translation model, the region map) do. That's what makes the pipeline extensible.
