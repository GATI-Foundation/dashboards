# Stage 3 · Employer Sectors (ISIC)

<span class="env jsx">React / JSX Artifact</span>

**Input:** `construction_final.csv` (from Stage 2) + `ISICRev4_NT_input_csv.csv` · **Output:** `construction.csv`

The final stage answers "who is hiring?" It classifies each **employer** into an ISIC Rev.4 industry code, fills the `Employer_Category` column the dashboard reads, and produces the deploy-ready CSV. It runs as a self-contained React artifact inside Claude.ai — no install, no API key to manage.

## Why a JSX artifact

Employer classification is a different problem from occupation classification. It benefits from:

- **Deduplication by company** — many postings share one employer, so we classify each *company* once, not each row.
- **An interactive review loop** — web-verifying uncertain companies, fixing job-portal rows.
- **A built-in AI endpoint** — the artifact calls the in-artifact Anthropic API, so there's no key to store or leak.

The artifact is fully self-contained, including its own CSV parser so it never depends on an external library that might fail to load:

```jsx
// self-contained CSV (no external module; avoids papaparse load failures)
function parseCSV(text) {
  text = text.replace(/^\uFEFF/, "");
  const rows = [];
  let field = "", row = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c !== "\r") field += c;
    }
  }
  // ... assemble objects keyed by header
}
```

## The four steps

The artifact walks four buttons, in order:

<div class="gati-flow" markdown="1">
<div class="gati-flow__step" markdown="1">
<span class="lbl">Step 1</span>
<h4>Classify</h4>
Each unique company → ISIC 4-digit, via AI constrained to the official list.
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Step 2</span>
<h4>Web-verify</h4>
Look up companies the classifier couldn't resolve.
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Step 3</span>
<h4>Fix portal rows</h4>
Infer the real employer for job-board postings.
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Step 4</span>
<h4>Derive & save</h4>
Fill ISIC-3/2 names, write the final CSV.
</div>
</div>

## Step 1 — Classify employers

Companies are deduplicated into "signals" (company name + a sample title + a snippet), then classified in batches. The system prompt judges the **company's primary economic activity, not the advertised worker's role** — and is constrained to codes from the uploaded official ISIC sheet.

```jsx
const classifyBatch = async (batch, sig) => {
  const payload = batch.map((co, i) => ({
    i, company: sig[co].company, title: sig[co].title, snippet: sig[co].snippet
  }));
  const system =
    "You classify EMPLOYERS (companies) into ISIC Rev.4 FOUR-DIGIT classes. " +
    "Judge the company's PRIMARY ECONOMIC ACTIVITY, not the advertised worker's role. " +
    "Frequent cases: general building contractor/Hochbau=4100; civil engineering/Tiefbau=4290; " +
    "electrical installation=4321; plumbing-heating-air (SHK)=4322; finishing (Maler, Trockenbau)=4330; " +
    "architecture & engineering office/Ingenieurbuero=7110; wholesale of materials/Baustoffhandel=4663; " +
    "temp staffing/Zeitarbeit=7820; job boards/aggregators=6312. " +
    "A CONTRACTOR that does the work on site is 41xx/43xx; only a MATERIALS SELLER is 4663. " +
    "Use ONLY codes from the official list. If evidence doesn't identify the industry, use 0000. " +
    "confidence: High = unambiguous; Medium = plausible inference; Low = weak. " +
    'Respond ONLY with JSON: [{"i":0,"isic":"4100","conf":"High"},...]\n\n' +
    "OFFICIAL ISIC REV.4 4-DIGIT CLASSES:\n" + catalogue4();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-6", max_tokens: 1000, system,
      messages: [{ role: "user", content: JSON.stringify(payload) }],
    }),
  });
  // parse JSON, validate every code against the official isic4 map
};
```

Every returned code is validated — it must be a 4-digit string that exists in the uploaded ISIC sheet, or it's discarded:

```jsx
companyMap.current[co] = (r && /^\d{4}$/.test(r.code) && isic4[r.code])
  ? { code: r.code, conf: ["High","Medium","Low"].includes(r.conf) ? r.conf : "Low" }
  : { code: "", conf: "Low" };
```

The run is **resumable** — already-classified companies are skipped, and a Stop button keeps progress so Run continues where it left off.

## Step 2 — Web-verify unresolved

Companies the classifier left at `0000` can be looked up on the web to identify their actual industry — useful for firms whose name alone isn't enough.

```jsx
const system =
  "For each German company, SEARCH THE WEB to identify its primary economic " +
  "activity, then assign one ISIC Rev.4 four-digit class. " +
  "Typical: 4100 building, 4290 civil eng, 4321 electrical, 4322 SHK, " +
  "4330 finishing, 7110 planning office, 4663 materials wholesale, 7820 staffing. " +
  "If no clear answer, use 0000.";
```

## Step 3 — Fix portal-posted rows

Some postings are placed *via* a job board (meinestadt.de, etc.) — the portal is not the employer. For these, the classifier reads the **ad text** to infer the real employer's industry.

```jsx
const system =
  "These job ads were posted VIA a job portal; the portal is not the employer. " +
  "From the ad text infer the ACTUAL employer's industry and assign one ISIC Rev.4 " +
  "four-digit class from the official list. If unclear, use 0000.";
```

## Step 4 — Derive names & save

With every employer holding a 4-digit code, the 3- and 2-digit parents and their official names are derived instantly — no API. You choose which level fills `Employer_Category` (the dashboard uses the name; it rolls up to ISIC-2 for display).

```jsx
const chosen = nameLevel === "4" ? n4 : nameLevel === "3" ? n3 : n2;
row.Employer_ISIC_4 = code4;
row.Employer_ISIC_3 = code4.slice(0, 3);
row.Employer_ISIC_2 = code4.slice(0, 2);
row.Employer_Category               = chosen;          // what the dashboard reads
row.Employer_Category_ISIC4         = n4;
row.Employer_Category_ISIC3         = n3;
row.Employer_Category_ISIC2         = n2;
row.Employer_Category_Confidence_Level = m ? m.conf : "Low";
```

The confidence level flows straight into the dashboard's **"Hide unclear employer categories"** filter, which defaults on — so `Low`-confidence rows are hidden unless the user opts in.

## Output

`construction.csv` — the Stage 2 schema plus the filled `Employer_Category` and the ISIC code/confidence columns. This is the file that goes live.

Continue to **[Deploy to Dashboard](stage4-deploy.md)**.
