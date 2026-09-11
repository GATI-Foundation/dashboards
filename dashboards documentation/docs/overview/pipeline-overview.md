# The Full Pipeline

This page is the map. It shows how a raw scrape becomes a dashboard-ready dataset, why each stage lives where it does, and what artefact leaves each stage.

## Why three environments?

Each stage runs where its work is cheapest and most reliable:

| Stage | Environment | Why there |
|-------|-------------|-----------|
| 1 · Clean & Classify | **Google Colab** (CPU) | Free, persistent Google Drive for the raw data and ISCO reference tables; no GPU needed for rule-based classification. |
| 2 · Translate & Reshape | **Kaggle** (GPU T4×2) | Free GPU hours make neural machine translation of ~15,000 rows fast; the heavy lifting is the translation model. |
| 3 · Employer Sectors | **In-dashboard JSX artifact** | Runs the ISIC classifier interactively with a built-in AI endpoint and no API key to manage; outputs the exact schema the dashboard reads. |

## End-to-end flow

```mermaid
flowchart TD
    A[stepstone_construction.csv<br/><i>raw scrape</i>] --> B

    subgraph S1["Stage 1 · Google Colab (CPU)"]
        B[Clean text · assign Job_IDs] --> C[Load official ILO ISCO-08 tables]
        C --> D[Deterministic lexicon<br/>77 German rules]
        D --> E[StepStone category map]
        E --> F[Gemini fallback<br/>schema-enum constrained]
        F --> G[Integrity checks]
    end

    G --> H[construction_classified.csv]

    subgraph S2["Stage 2 · Kaggle (GPU T4×2)"]
        H --> I[Helsinki-NLP opus-mt<br/>DE→EN via CTranslate2]
        I --> J[ISCO spot-check]
        J --> K[State backfill]
        K --> L[Reshape to 23-col JSX schema<br/>English replaces German]
    end

    L --> M[construction_final.csv]

    subgraph S3["Stage 3 · Dashboard JSX Artifact"]
        M --> N[Classify employers → ISIC Rev.4 4-digit]
        N --> O[Web-verify unresolved companies]
        O --> P[Fix portal-posted rows]
        P --> Q[Derive ISIC-3 / ISIC-2 names]
    end

    Q --> R[construction.csv]
    R --> S[(data/germany/construction.csv<br/><b>live dashboard</b>)]

    style A fill:#f4b40033,stroke:#C98A0B
    style H fill:#0F5B5A22,stroke:#0F5B5A
    style M fill:#0F5B5A22,stroke:#0F5B5A
    style R fill:#0F5B5A22,stroke:#0F5B5A
    style S fill:#C98A0B33,stroke:#C98A0B
```

## The two classification systems

Every posting gets classified on **two independent axes**. Keeping them separate is what lets the dashboard answer both "what work is in demand?" and "who is hiring?"

=== "Occupation — ISCO-08"

    **What the person does.** Assigned in Stage 1 from the job title and description.

    - International Standard Classification of Occupations, 2008 revision (ILO).
    - Four hierarchical levels; GATI classifies to the **4-digit unit group** and derives the 3- and 2-digit parents.
    - Example: `7112` Bricklayers → `711` Building frame trades → `71` Building trades workers.

=== "Employer sector — ISIC Rev.4"

    **What industry the employer is in.** Assigned in Stage 3 from the company name and ad context.

    - International Standard Industrial Classification of All Economic Activities, Rev.4 (UN).
    - GATI classifies to the **4-digit class** and derives the 3- and 2-digit parents; the dashboard displays the **2-digit division**.
    - Example: `4120` Construction of buildings → `412` → `41` Construction of buildings.

!!! note "Why both?"
    A bricklayer (ISCO 7112) might be employed by a construction firm (ISIC 41), a staffing agency (ISIC 78), or a facilities-management company (ISIC 81). The occupation stays the same; the employer sector varies. Separating them reveals how demand actually flows through the labour market.

## What leaves each stage

<div class="gati-flow" markdown="1">
<div class="gati-flow__step" markdown="1">
<span class="lbl">After Stage 1</span>
<h4>ISCO-08 codes added</h4>
<div class="file">construction_classified.csv</div>
German text, occupation codes, source & confidence columns.
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">After Stage 2</span>
<h4>English + 23-col schema</h4>
<div class="file">construction_final.csv</div>
English content, ISCO names, clean states, dashboard schema.
</div>
<div class="gati-flow__step" markdown="1">
<span class="lbl">After Stage 3</span>
<h4>ISIC employer sectors</h4>
<div class="file">construction.csv</div>
Employer_Category + ISIC codes + confidence. Ready to deploy.
</div>
</div>

Continue to **[Stage 1 · Clean & Classify](../pipeline/stage1-colab.md)** to see the code.
