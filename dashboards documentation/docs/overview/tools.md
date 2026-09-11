# Tools & Accounts

What you need before running the pipeline, and how the pieces fit together.

## Accounts

| Account | Used in | Cost | Notes |
|---------|---------|------|-------|
| **Google (Colab + Drive)** | Stage 1 | Free | Drive holds the raw data, ISCO reference tables, and checkpoints. |
| **Kaggle** | Stage 2 | Free | GPU T4×2 accelerator; 30 GPU-hours/week on the free tier. |
| **Anthropic API** | Stage 1 (optional fallback) | Pay-as-you-go | Only used for the residual rows the lexicon can't resolve. |
| **Claude.ai** | Stage 3 | Included in plan | The JSX artifact runs its ISIC classifier through the in-artifact API — no key to manage. |

## Reference files you must have in Drive

Stage 1 loads two things from Google Drive besides the raw scrape:

- **`ISCO-08 EN Structure and definitions.xlsx`** — the official ILO occupation table. The single source of truth for occupation codes and names.
- The **raw scrape** itself, e.g. `stepstone_construction.csv`, under `Data/raw/`.

Stage 3 needs one upload alongside the dataset:

- **`ISICRev4_NT_input_csv.csv`** — the official UN industry classification table.

## Key libraries

=== "Stage 1 · Colab"

    ```
    pandas          data handling
    openpyxl        reads the ISCO .xlsx
    anthropic       optional AI fallback
    google-genai    optional Gemini fallback
    ```

=== "Stage 2 · Kaggle"

    ```
    ctranslate2     fast int8 inference engine
    transformers    tokenizer + model loading
    sentencepiece   subword tokenization
    sacremoses      Moses-style detokenization
    ```

    Model: **Helsinki-NLP/opus-mt-tc-big-de-en** (and `opus-mt-de-en` for some corridors), run through CTranslate2 in `int8_float16` on the GPU.

=== "Stage 3 · JSX"

    Runs as a React artifact inside Claude.ai. No install — it uses the in-artifact Anthropic endpoint and a self-contained CSV parser, so there are no external dependencies to break.

## :material-shield-alert: API key security

!!! danger "Never commit API keys"
    The classification code calls paid APIs. Those keys must **never** appear in a notebook you share, a public repo, or its git history.

    **Do this instead:**

    - In **Colab**, store the key with the Secrets manager (the 🔑 icon in the left sidebar) and read it with `from google.colab import userdata; userdata.get('ANTHROPIC_API_KEY')`.
    - In **Kaggle**, use *Add-ons → Secrets*.
    - Never paste a raw `sk-ant-...` or `AIza...` string directly into a cell.

    If a key is ever exposed — in a file, a screenshot, or a commit — **revoke it immediately** in the provider console and issue a new one. A leaked key can be used by anyone who finds it, at your expense.

## Repository layout

The dashboard and this documentation live in **separate repositories**, each with its own Vercel deployment:

```
gati-dashboard/          ← the live dashboard (static + /api)
└── data/
    └── germany/
        └── construction.csv   ← Stage 3 output lands here

gati-docs/               ← this documentation (MkDocs)
├── mkdocs.yml
└── docs/
    └── ...
```

They cross-link by URL: a "Docs" link in the dashboard, a "Live dashboard" link here.
