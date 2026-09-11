# Stage 1 · Clean & Classify

<span class="env colab">Google Colab · CPU</span>

**Input:** `stepstone_construction.csv` (raw scrape) · **Output:** `construction_classified.csv`

This stage does two jobs: it **cleans** the raw scrape into a consistent frame, and it **classifies** every posting to a 4-digit ISCO-08 occupation code. The classifier is deterministic-first — a German occupational lexicon handles the bulk of rows with zero API cost, and an AI model only sees the residual.

!!! danger "Before you run anything"
    The notebook calls a paid API for the fallback. Store your key in **Colab Secrets** (🔑 in the left sidebar) and read it with `userdata.get(...)`. Never paste a raw key into a cell or commit it. If a key is ever exposed, revoke it immediately.

## Section 1 — Config

The whole notebook is driven by one config block. Switching sectors means editing only this.

```python
# SECTION 1 — CONFIG  (the only section you edit to switch sector)
SECTOR = "construction"

BASE = "/content/drive/MyDrive/.../GATI/Data"

SECTOR_CFG = {
    "construction": {
        "raw_csv":      f"{BASE}/raw/stepstone_construction.csv",
        "out_dir":      f"{BASE}/preprocess/construction_ISCO",
        "stem":         "construction",
        "sector_label": "Construction & Skilled Trades",
    },
}[SECTOR]

ISCO_FILE    = f"{BASE}/ISCO-08 EN Structure and definitions.xlsx"
STRUCT_SHEET = "ISCO-08 EN Struct and defin"

# ---- engine switches -------------------------------------------------
TRUST_EXISTING_CODES = False   # scrape codes agree with the lexicon on only ~43%
                               # of rows, so they are NOT trusted by default.
USE_BODY_FALLBACK    = False   # match lexicon on Description when the title is silent.
                               # Raises coverage ~66%→~79% but risks "Erfahrung als Koch"
                               # in a dishwasher ad becoming a cook. Off = rigour first.
USE_GEMINI           = True    # False -> residual rows go to Needs_Review, zero API calls
DROP_URL_DUPLICATES  = True

# ---- Gemini free tier ------------------------------------------------
GEMINI_MODEL_CANDIDATES = ["gemini-2.5-flash", "gemini-2.5-flash-lite", "gemini-2.0-flash"]
GEMINI_BATCH_SIZE    = 12
GEMINI_RPM           = 10      # free-tier requests/minute — safe floor
GEMINI_RPD_BUDGET    = 1400    # hard stop before the daily cap
SAVE_EVERY_N_BATCHES = 20
```

The switches encode real decisions made while building the pipeline:

- **`TRUST_EXISTING_CODES = False`** — the scrape's own ISCO codes matched the lexicon on only ~43% of rows, so they aren't trusted; every row is re-derived.
- **`USE_BODY_FALLBACK = False`** — matching the lexicon against the ad *body* raises coverage but introduces errors (a dishwasher ad mentioning "experience as a cook" would misclassify). Rigour wins by default.

## Section 3 — Load & clean

Text is normalised (HTML entities, Unicode quotes, zero-width characters, whitespace), URL duplicates dropped, and a sequential `Job_ID` assigned. German employment types and states are mapped to a clean reference vocabulary.

```python
def clean_text(t):
    if pd.isna(t):
        return np.nan
    t = str(t).replace("\ufeff", "")           # strip BOM
    t = html.unescape(t)                        # &amp; -> &
    t = unicodedata.normalize("NFKC", t)        # canonical Unicode
    for a, b in {"\u201c": '"', "\u201d": '"', "\u2019": "'",
                 "\u2013": "-", "\u2014": "-"}.items():
        t = t.replace(a, b)                     # curly quotes/dashes -> ASCII
    t = re.sub(r"[\u200B-\u200D\uFEFF]", "", t) # zero-width chars
    t = re.sub(r"[ ]{2,}", " ", t)
    t = "\n".join(line.strip() for line in t.split("\n")).strip()
    return np.nan if t == "" else t

df = pd.read_csv(SECTOR_CFG["raw_csv"], dtype=str)
for c in df.columns:
    df[c] = df[c].apply(clean_text)

if DROP_URL_DUPLICATES and "Job_URL" in df.columns:
    df = df.drop_duplicates(subset=["Job_URL"], keep="first").reset_index(drop=True)

df["Job_ID"] = [f"Job-{i+1}" for i in range(len(df))]
```

The German federal states are mapped to their English names so the dashboard's geography is consistent:

```python
STATE_MAP = {
    "bayern": "Bavaria", "hessen": "Hesse",
    "niedersachsen": "Lower Saxony",
    "nordrhein-westfalen": "North Rhine-Westphalia",
    "rheinland-pfalz": "Rhineland-Palatinate",
    "sachsen": "Saxony", "thüringen": "Thuringia",
    # ... all 16 Bundesländer
}
```

## Section 4 — Official ILO tables

The single source of truth for occupation codes. Loaded from the ILO workbook; four dictionaries keyed by hierarchy level.

```python
struct = pd.read_excel(ISCO_FILE, sheet_name=STRUCT_SHEET)
struct["Level"]        = struct["Level"].astype(str).str.strip()
struct["ISCO 08 Code"] = struct["ISCO 08 Code"].apply(_code)   # strip ".0" artifacts
struct["Title EN"]     = struct["Title EN"].astype(str).str.strip()

_lvl = lambda k: dict(zip(struct.loc[struct.Level == k, "ISCO 08 Code"],
                          struct.loc[struct.Level == k, "Title EN"]))
MAJOR = _lvl("1"); SUBMAJOR = _lvl("2"); MINOR = _lvl("3"); UNIT = _lvl("4")
```

`UNIT` is the classification target — the ~436 four-digit unit groups. If it loads with fewer than 400 entries the notebook aborts, because that means the wrong sheet was read.

## Section 5 — The German lexicon

The heart of the deterministic classifier: **77 ordered rules**. Each rule is a regex on the job title, an ISCO-08 code, and an optional **context test** — a second regex checked against the full ad. Order matters: the first rule that hits wins, so management sits above the trades it manages.

```python
HOTEL  = r"hotel|resort|beherberg|gastgeb|pension|herberge|hostel"
GASTRO = r"restaurant|gastronom|kueche|cafe|bistro|imbiss|pizzeria|kantine|baeckerei"

LEXICON = [
    # (title_pattern, ISCO_code, context_pattern_or_None, rule_name)

    # --- management first (a Bauleiter must not be caught as the trade led) ---
    (r"\bbauleiter",              "1323", None, "construction_manager"),
    (r"\bpolier|\bvorarbeiter",   "3123", None, "site_supervisor"),

    # --- specific skilled trades ---
    (r"\bmaurer",                 "7112", None, "bricklayer"),
    (r"\bzimmerer|\bzimmermann",  "7115", None, "carpenter"),
    (r"\bdachdecker",             "7121", None, "roofer"),
    (r"\belektr(iker|oniker)",    "7411", None, "electrician"),
    (r"\b(anlagenmechaniker|shk|installateur)", "7126", None, "plumber_shk"),

    # --- context-gated rules: the same title means different codes by setting ---
    (r"\bempfang",  "4224", HOTEL,  "reception_hotel"),   # hotel -> hotel receptionist
    (r"\bempfang",  "4226", None,   "reception_general"), # else -> general receptionist
    (r"\bfilialleiter", "1412", GASTRO, "branch_mgr_gastro"),
    (r"\bfilialleiter", "1420", None,   "branch_mgr_retail"),

    # ... 77 rules total
]
```

!!! tip "The context gate is the clever part"
    A *Rezeptionist* at a hotel (ISCO 4224) and a *Rezeptionist* at a doctor's office (ISCO 4226) share a title but are different occupations. The context regex — tested against title + category + company + body — resolves the ambiguity deterministically, with no AI call.

A **startup self-test** guarantees rule integrity: every code any rule can emit is checked against the official `UNIT` table before the run begins. An invented code can't survive.

```python
for pat, code, ctx, name in LEXICON:
    assert code in UNIT, f"Rule '{name}' emits {code}, not in the official ILO list!"
```

## Section 6 — Deterministic passes

Sector-agnostic. Each row is tried in order; the first layer that resolves it wins.

```python
# PASS A — pre-existing codes (only if TRUST_EXISTING_CODES)
# PASS B — lexicon rules against the title (+ body if USE_BODY_FALLBACK)
# PASS C — StepStone category map (sub-categories that map 1:1 to a unit group)

def apply_code(i, code4, source, rule=""):
    h = derive(code4)                    # fill ISCO_4/3/2 + names from the code
    for k, v in h.items():
        df.at[i, k] = v
    df.at[i, "ISCO_Source"]       = source
    df.at[i, "ISCO_Reclassified"] = "Yes" if _code(df.at[i, "ISCO_Code_Original"]) != code4 else "No"
    df.at[i, "Classification_Status"] = "Done"
```

Everything a rule resolves is marked `Done`; whatever's left is `pending` and flows to the fallback.

## Section 7 — Gemini fallback (residual only)

Only the rows the deterministic layers couldn't resolve reach the AI — and even then, the model is **constrained to the official code list by a JSON-schema enum**. A hallucinated code isn't in the enum, so it physically can't come back. Every answer is re-validated against `UNIT` anyway.

```python
if not USE_GEMINI:
    for i in pending:
        df.at[i, "Classification_Status"] = "Needs_Review"
        df.at[i, "ISCO_Source"]           = "No_rule_match"
else:
    # response schema: the code MUST be one of the official unit groups, or "REVIEW"
    schema = {
        "type": "array",
        "items": {
            "type": "object",
            "properties": {
                "i":    {"type": "integer"},
                "code": {"type": "string", "enum": list(UNIT.keys()) + ["REVIEW"]},
            },
            "required": ["i", "code"],
        },
    }
    # batched calls with RPM/RPD budgeting, checkpoint every SAVE_EVERY_N_BATCHES
```

The fallback respects the free-tier budget (`GEMINI_RPM`, `GEMINI_RPD_BUDGET`) and checkpoints to Drive, so a disconnect never loses progress and re-running resumes from the last save.

## Section 8 — Integrity checks & save

The export refuses to run if the data isn't internally consistent. These assertions are the pipeline's guarantee of trust.

```python
# every 4-digit code must be a real ILO unit group
coded = df["ISCO_4"].astype(str).str.len() == 4
bad   = df.loc[coded & ~df["ISCO_4"].isin(UNIT.keys())]
if len(bad):
    raise ValueError(f"{len(bad)} rows carry a code absent from the ILO Level-4 list")

# hierarchy must be internally consistent
assert (df.loc[coded, "ISCO_4"].str[:3] == df.loc[coded, "ISCO_3"]).all(), "ISCO_3 != ISCO_4[:3]"
assert (df.loc[coded, "ISCO_4"].str[:2] == df.loc[coded, "ISCO_2"]).all(), "ISCO_2 != ISCO_4[:2]"

# no name may drift in spelling across rows sharing a code
assert df.loc[coded].groupby("ISCO_3")["ISCO_3_name"].nunique().max() == 1, "ISCO_3_name drift"
assert df.loc[coded].groupby("ISCO_4")["ISCO_4_name"].nunique().max() == 1, "ISCO_4_name drift"

df.to_csv(FINAL_CSV, index=False)
```

## Output

`construction_classified.csv` — the raw scrape plus:

- `ISCO_4`, `ISCO_3`, `ISCO_2`, `ISCO_4_name`, `ISCO_3_name`
- `ISCO_Source` (audit trail), `ISCO_Reclassified`
- `Classification_Status` (`Done` / `Needs_Review`)

Rows flagged `Needs_Review` are written to a separate file for manual inspection — they're never given a fake code to paper over uncertainty.

Continue to **[Stage 2 · Translate & Reshape](stage2-kaggle.md)**.
