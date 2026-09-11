# Troubleshooting

Common issues across the three stages and how to resolve them.

## Stage 1 · Colab

!!! failure "`Only N unit groups — wrong ISCO sheet?`"
    The ISCO workbook loaded the wrong sheet. Check `STRUCT_SHEET` matches the exact sheet name in your `.xlsx` (they vary by ILO release).

!!! failure "Rule self-test raises on startup"
    A lexicon rule emits a code that isn't in the official ILO list — usually a typo. The error names the rule; fix the code.

!!! failure "Gemini daily cap hit"
    The free tier has a daily request cap. The run stops cleanly at `GEMINI_RPD_BUDGET` and checkpoints; re-run tomorrow and it resumes from the last save.

## Stage 2 · Kaggle

!!! failure "`No GPU detected`"
    The accelerator wasn't enabled. Right sidebar → Accelerator → GPU T4×2, then re-run the cell.

!!! failure "Translation looks odd for a phrase, every time"
    A recurring neural-MT tic. Add the exact German→English fix to the `POST_SUB` list and re-run — it's applied verbatim after translation.

!!! failure "`raw_up_df has no _EN columns`"
    A safety guard fired: you're about to overwrite the translated file with the German-only frame. Re-run the translation cell, or load the `_translated.csv` first.

## Stage 3 · JSX

!!! failure "Companies stuck at `0000`"
    The classifier couldn't identify the industry from the name alone. Run **Step 2 · Web-verify** to look them up, or **Step 3 · Fix portal rows** if they're job-board postings.

!!! failure "A returned code is rejected"
    Only codes present in the uploaded ISIC sheet are accepted. If a code is discarded, confirm you uploaded the correct `ISICRev4_NT_input_csv.csv`.

## Deployment

!!! failure "Dashboard shows old numbers after a new CSV"
    Browser cache. Hard-refresh (Ctrl/Cmd + Shift + R). The landing card counts the CSV live, so once the fresh file is served the count updates itself.

!!! danger "An API key ended up in a commit"
    Revoke it immediately in the provider console and issue a new one. Then remove it from the file and, if it's in git history, treat the key as compromised regardless of any history rewrite.
