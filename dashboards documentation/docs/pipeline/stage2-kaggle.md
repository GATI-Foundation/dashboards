# Stage 2 · Translate & Reshape

<span class="env kaggle">Kaggle · GPU T4×2</span>

**Input:** `construction_classified.csv` (from Stage 1) · **Output:** `construction_final.csv`

The postings are in German; the dashboard is English. This stage translates the free-text columns with a neural machine-translation model on a GPU, spot-checks the occupation codes, backfills any missing states, and reshapes everything into the strict 23-column dashboard schema — with English **replacing** the German content.

## Why Kaggle, why a GPU

Translating ~15,000 rows of job descriptions with a neural model is the one genuinely GPU-hungry step in the whole pipeline. Kaggle gives 30 free GPU-hours a week on a **T4×2** accelerator, which turns a job that would take hours on CPU into ~15–20 minutes.

!!! note "One-time Kaggle setup"
    1. New Notebook → right sidebar **Accelerator → GPU T4×2**.
    2. **Add Data → Upload** your `construction_classified.csv`. Kaggle places it under `/kaggle/input/<dataset>/`; the script auto-detects the path.
    3. Paste the translation cell and run.

## The translation engine

The model is **Helsinki-NLP/opus-mt-de-en** (a tuned `opus-mt-tc-big-de-en` for some corridors), run through **CTranslate2** in `int8_float16` — an inference engine that quantises the model to 8-bit for a large speedup with negligible quality loss.

```python
!pip install -q ctranslate2 transformers sentencepiece sacremoses

import ctranslate2, torch
from transformers import AutoTokenizer

# GPU is required — abort clearly if the accelerator wasn't enabled
if not torch.cuda.is_available():
    raise RuntimeError("No GPU. Right sidebar -> Accelerator -> GPU T4 x2, then re-run.")

# Convert the HuggingFace model to CTranslate2 int8 (once per session)
MODEL_HF = "Helsinki-NLP/opus-mt-de-en"
CT2_DIR  = "/kaggle/working/opus-mt-de-en-ct2-int8f16"

if not os.path.exists(f"{CT2_DIR}/model.bin"):
    subprocess.check_call([
        "ct2-transformers-converter",
        "--model", MODEL_HF,
        "--output_dir", CT2_DIR,
        "--quantization", "int8_float16",
        "--force",
    ])

translator = ctranslate2.Translator(
    CT2_DIR, device="cuda", compute_type="int8_float16",
    intra_threads=4, inter_threads=1,
)
tokenizer = AutoTokenizer.from_pretrained(MODEL_HF)
```

## What gets translated (and what doesn't)

Five text columns are translated into parallel `_EN` columns. Crucially, **`Job_Category` is *not* translated** — it's kept in German because it's a classification signal, not display text, and translating it would break the category map.

```python
EN_COLS = {
    "Job_Title":    "Job_Title_EN",
    "Job_Category": "Job_Category_EN",   # translated for reference only
    "Description":  "Description_EN",
    "Requirements": "Requirements_EN",
    "Benefits":     "Benefits_EN",
}
```

## Line-preserving segmentation

Job descriptions are structured — bullet lists, line breaks, sections. The translator splits text into sentences **without destroying that structure**, so the English reads like the German looked. Translation runs in batches with `beam_size=4`, and progress is checkpointed so a disconnected kernel resumes rather than restarts.

```python
# sentence-split each field, translate in batches, then reassemble
# preserving the original line breaks. beam_size=4 for quality.
results = translator.translate_batch(
    token_batches,
    beam_size=4,
    max_batch_size=2048,
)
```

## Cleaning translation artifacts

Neural MT has recurring quirks ("tics") — the same German phrase mistranslated the same way every time. A **post-substitution dictionary** fixes the recurring ones, tuned per corridor by spot-checking the first run's output.

```python
# opus-mt tics observed in this corridor, fixed verbatim after translation
POST_SUB = [
    ("m/f/d", "(m/f/d)"),
    ("You fit", "Your profile"),
    # ... recurring artifacts added after inspecting real output
]
```

!!! tip "Tune the substitutions on real output"
    The `POST_SUB` list starts as a guess. After the first translation of a new corridor, spot-check the English and add any recurring artifacts you actually see — the same loop that tuned the hospitality and logistics corridors.

## ISCO spot-check

Before trusting the codes downstream, a spot-check samples the occupations whose boundaries were ambiguous when the lexicon was built, and lets you read the English title + description to confirm the code fits.

```python
# The boundaries to watch in a construction/trades pull:
#   7112 Bricklayer      vs  7119 other building-frame trades
#   7126 Plumber/SHK     vs  7412 electrical mechanic
#   3123 Site supervisor vs  1323 construction manager
#
# Verdict rubric per code:
#   >80% clearly correct -> trust it, proceed
#   60-80%               -> targeted reclassification of that code
#   <60%                 -> revisit the lexicon rule for that code
```

## State backfill

Some scraped rows have a blank or `"nan"`-string state. A rebuild step resolves them properly (a literal `"nan"` string is *not* a filled value) so the dashboard's regional views are complete.

```python
# normalize "nan" / "None" / "<NA>" strings to real empties first,
# then backfill State from City where it can be inferred.
str_cols = raw_up_df.select_dtypes(include=[object]).columns
for c in str_cols:
    raw_up_df.loc[raw_up_df[c].str.lower().isin(["nan", "none", "<na>"]), c] = ""
```

## Final reshape to the 23-column schema

The last cell enforces the exact dashboard contract: English content **replaces** the German in the main columns, the `_EN` helper columns are dropped, and the columns are written in the fixed schema order.

```python
# 1. English overwrites German in the main text columns
REPLACEMENTS = {
    "Job_Title":   "Job_Title_EN",
    "Description":  "Description_EN",
    "Requirements": "Requirements_EN",
    "Benefits":     "Benefits_EN",
}
for main_col, en_col in REPLACEMENTS.items():
    if en_col in df.columns:
        mask = df[en_col].fillna("").astype(str).str.strip() != ""
        df.loc[mask, main_col] = df.loc[mask, en_col]

# 2. drop the _EN helpers
df = df.drop(columns=[c for c in REPLACEMENTS.values() if c in df.columns])

# 3. enforce the strict JSX 23-column schema, in order
JSX_COLUMNS = [
    "Job_Title", "Job_Category",
    "ISCO_4", "ISCO_3", "ISCO_2", "ISCO_4_name",
    "State", "City", "Company_Name", "Employer_Category",
    "Date_Posted", "Employment_type", "Salary",
    "Description", "Requirements", "Benefits",
    "Work_Type", "Sector", "Date_Scraped", "Job_URL", "Job_ID",
    "ISCO_Source", "ISCO_Reclassified",
]
for c in JSX_COLUMNS:
    if c not in df.columns:
        df[c] = ""
final = df[JSX_COLUMNS].copy()

# 4. final "nan"-string cleanup, then save
for c in final.columns:
    if final[c].dtype == object:
        final[c] = final[c].fillna("").astype(str)
        final.loc[final[c].str.lower().isin(["nan", "none", "<na>"]), c] = ""

final.to_csv("/kaggle/working/construction_final.csv", index=False)
```

Note that `Employer_Category` (column 10) is present but **empty** at this point — it gets filled in Stage 3.

## Output

`construction_final.csv` — 23 columns, English content, clean states, dashboard schema. Download it from the Kaggle **Output** panel.

Continue to **[Stage 3 · Employer Sectors](stage3-jsx.md)**.
