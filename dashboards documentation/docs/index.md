---
hide:
  - navigation
  - toc
---

<div class="gati-hero" markdown="1">
<img class="gati-hero__logo" src="assets/gati-logo-white.svg" alt="GATI">
<p class="gati-hero__tagline">
The data engineering behind GATI's labour-market dashboards — how a raw scrape of German job postings becomes classified, translated, dashboard-ready intelligence on skills mobility from India.
</p>
<span class="gati-hero__sub">Global Access to Talent from India</span>
<div class="gati-hero__cta">
<a class="primary" href="overview/pipeline-overview/">Explore the pipeline →</a>
<a class="ghost" href="https://draft-version-german-demand-dashboa.vercel.app/" target="_blank">Live dashboard</a>
</div>
</div>

## What this documents

Every GATI sector dashboard — hospitality, logistics, construction, healthcare — is built from the same repeatable pipeline. This site documents that pipeline end to end, using the **construction** corridor as the worked example, from the raw StepStone scrape all the way to the CSV that lands in the dashboard's country folder.

The pipeline runs in **three stages**, each in a different environment chosen for what it does best:

<div class="gati-stages" markdown="1">

<div class="gati-stage" markdown="1">
<div class="gati-stage__num">1</div>
### Clean & Classify
Raw postings are cleaned and each job is classified to a 4-digit **ISCO-08** occupation code using a deterministic German lexicon backed by an AI fallback.
<span class="env colab">Google Colab · CPU</span>
</div>

<div class="gati-stage" markdown="1">
<div class="gati-stage__num">2</div>
### Translate & Reshape
German text is machine-translated to English on a GPU, occupation codes are spot-checked, and the data is reshaped into the strict 23-column dashboard schema.
<span class="env kaggle">Kaggle · GPU T4×2</span>
</div>

<div class="gati-stage" markdown="1">
<div class="gati-stage__num">3</div>
### Employer Sectors
Employers are classified to **ISIC Rev.4** industry codes in an in-dashboard tool, producing the final CSV that the dashboard reads.
<span class="env jsx">React / JSX Artifact</span>
</div>

</div>

## The journey of one dataset

<div class="gati-flow" markdown="1">
<div class="gati-flow__step" markdown="1">
<span class="lbl">Input</span>
<h4>Raw scrape</h4>
<div class="file">stepstone_construction.csv</div>
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Stage 1 · Colab</span>
<h4>ISCO-08 classified</h4>
<div class="file">construction_classified.csv</div>
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Stage 2 · Kaggle</span>
<h4>Translated + reshaped</h4>
<div class="file">construction_final.csv</div>
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Stage 3 · JSX</span>
<h4>ISIC employer sectors</h4>
<div class="file">construction.csv</div>
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">Output</span>
<h4>Live dashboard</h4>
<div class="file">data/germany/construction.csv</div>
</div>
</div>

## Design principles

The whole pipeline is built around a few non-negotiable rules that keep the data trustworthy:

- **Official codes only.** Every ISCO-08 and ISIC Rev.4 code is validated against the official ILO / UN reference tables. An invented or hallucinated code can never survive a run — integrity checks abort the export if one does.
- **Classify the work, not the employer.** A salesperson in a bakery is a shop assistant, not a baker. Occupation classification reflects the actual job described in the ad.
- **Deterministic first, AI second.** Rule-based classification handles the bulk of rows with zero API cost and full reproducibility; an AI model only sees the residual it genuinely can't resolve — and even then, constrained to the official code list.
- **Every stage is checkpointed.** Long runs save progress so a disconnect never loses work; re-running resumes where it stopped.

!!! tip "New to the project?"
    Start with [The Full Pipeline](overview/pipeline-overview.md) for the bird's-eye view, then follow the three stage guides in order. The [Data Schema](overview/schema.md) page is the reference for what every column means.

---

<small>GATI operates under The Convergence Foundation. This documentation describes the data engineering behind its German-corridor labour-market dashboards.</small>
