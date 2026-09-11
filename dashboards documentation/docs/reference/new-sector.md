# Adding a New Sector

The pipeline is sector-agnostic by design. Adding a new sector — say, manufacturing — means editing config, not rewriting code.

## What changes per sector

| Item | Where | Change |
|------|-------|--------|
| Raw scrape | Drive `Data/raw/` | Add `stepstone_manufacturing.csv`. |
| Config block | Stage 1, Section 1 | Add a `SECTOR_CFG` entry and set `SECTOR`. |
| Lexicon | Stage 1, Section 5 | Add/adjust German rules for the sector's trades. |
| Translation | Stage 2 | Nothing — it's fully sector-agnostic. |
| `POST_SUB` | Stage 2 | Optionally add translation tics seen in the new output. |
| ISIC prompt | Stage 3 | Adjust the "frequent cases" hints for the sector's industries. |
| Dashboard | `assets/js/sectors.js` | Register the sector id, label, icon, ISCO scope. |

## Stage 1 — the lexicon is the real work

Most of the effort in a new sector is the German lexicon. Follow the existing pattern:

- **Order rules from general to specific**, management first, so a supervisor isn't caught as the trade being supervised.
- **Use context gates** where one title maps to different codes by setting.
- **Let the self-test guard you** — every code a rule emits is checked against the official ILO list at startup, so a typo can't ship.

Start with `USE_BODY_FALLBACK = False` and `USE_GEMINI = True`: the lexicon handles what it confidently can, the AI fallback mops up the residual, and nothing gets a fake code.

## Stage 3 — tune the ISIC hints

The classification still works without changes, but accuracy improves if the system prompt's "frequent cases" list reflects the new sector's real industries. For manufacturing you'd list the relevant ISIC divisions (e.g. 10–33) instead of the construction ones.

## Dashboard registration

Add the sector to `assets/js/sectors.js` with its `id` (matching the CSV filename), `label`, `icon`, and ISCO `scope`. The landing card and dashboard appear automatically once the CSV is in `data/germany/`.
