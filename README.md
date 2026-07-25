# Spotlight

**For creators who shine — the quality-control layer between a creator's AI generator and the publish button.**

AI-generated content is becoming a *legal* liability in Europe — EU AI Act Article 50 transparency obligations start **2 August 2026** — and an *audience* liability everywhere: consumer preference for AI-generated creator content fell from **60% (2023) to 26% (2026)**. Spotlight defends a creator's authentic voice against generic AI slop.

> Built at the Cursor Social Media Hack, Stuttgart — 25 July 2026.

---

## The idea

Spotlight is **not** a content generator (the market has ~258 of those). It's a **critic**.

1. **Fingerprint** — it builds a *voice fingerprint* of a specific creator by transcribing and analysing their best‑performing videos (weighted by engagement).
2. **Score on two independent axes** — for any new piece of content it measures, separately:
   - **Voice match** — how much it sounds like *that creator*
   - **Trend alignment** — how well it fits *what's currently working in their niche*
3. **Surface the tension** — these two pull in opposite directions. Every competing tool hides that by averaging them into one number. **We show the trade‑off and let the creator decide.** That tension is the headline feature.

> *"The trending hook is a hard cold‑open claim; your voice consistently opens with a question. Adopting the trend lifts reach but drops voice match to 41%."*

---

## Features

| Feature | What it does |
|---|---|
| 🧬 **Creator DNA** | Your signature voice, mapped from your own videos — hooks, pacing, signature phrases, and the things you *never* do (taboos). Built from the voice fingerprint. |
| 🎯 **Two‑axis score** | Every draft is measured on **two independent axes** — *sounds like you* and *fits a rising trend* — shown as a meter, with the **tension** between them called out instead of averaged away. |
| 🔥 **Trend radar** | Surfaces only the trends that fit *your* niche, each with a fit score and a decay estimate, ranked against your winning patterns. |
| 📈 **Draft predictor** | Paste a script, caption, or video link and get an **instant review before you post** — the two‑axis score, predicted reach, and concrete enhanced suggestions to lift it. |
| 🧾 **Receipts** | Every insight is **traceable** — each number links to the exact video, comment, or line it's based on. No black‑box opinions. Lines up with EU AI Act Article 50 transparency (effective 2 Aug 2026). |

---

## Architecture

Four n8n pipelines, each reads and writes structured data — nothing is coupled, so no single failure kills the demo.

```mermaid
flowchart LR
    subgraph Scrape["1 · Scrape (n8n + Apify + Firecrawl)"]
        A[creator.json<br/>creator videos + comments] --> S[(Google Sheets)]
        B[trends.json<br/>YouTube / TikTok / IG / Firecrawl] --> S
    end
    subgraph Extract["2 · Extract + Fingerprint (n8n + fal)"]
        S --> C[Apify download → MP4]
        C --> D[fal Wizper<br/>speech→text]
        C --> E[fal video/vision router<br/>scene + on‑screen text]
        D --> F[fal LLM<br/>voice fingerprint]
        E --> F
    end
    subgraph Score["3 · Two‑axis Scorer (n8n + fal)"]
        F --> G[score_voice]
        S --> H[score_trend]
        G --> I{divergence > 25?}
        H --> I
        I -->|yes| J[find_tension]
        I --> K[scorecard.json]
        J --> K
    end
```

| Pipeline | File | Role |
|---|---|---|
| Creator scraper | `n8nWorkflows/creator.json` | creator videos + comments → Google Sheets |
| Trend scraper | `n8nWorkflows/trends.json` | multi‑source trends (YouTube, TikTok, Instagram, Firecrawl) → Sheets |
| **Extraction + Fingerprint** | `n8n/voiceprint_merged_cloud.workflow.json` | download → transcribe (Wizper) + analyse (video router) → **voice fingerprint** |
| **Two‑axis Scorer** | `n8nWorkflows/contentAnalysis.json` | candidate vs fingerprint + trends → **scorecard** with tension |

The two scorer axes are **two independent LLM calls** — never blended. A single blended call would silently average the axes and destroy the entire premise.

---

## It works — real output

Both halves ran end‑to‑end on n8n Cloud against a real creator (German food/comedy Shorts, 15 videos).

### 1 · Fingerprint — `data/fingerprint.json`

The LLM saw past the surface topic and caught the *mechanics*: his real voice isn't "candy reviewer," it's **engagement‑bait machinery** — it detected that *"like and subscribe if this cat deserves a home"* and *"5 YouTubers had a serious accident, click below"* repeat **verbatim across every video**.

- **6 voice traits** (each with a cited excerpt), **3 hook archetypes**, **pacing**, **signature phrases**, and **3 taboos** ("never delivers topic content without pivoting to engagement bait").

### 2 · Two‑axis score — `data/scorecard.json` ⭐ the headline feature

The same on‑voice, clickbait‑heavy draft, scored on both axes independently:

| Axis | Score |
|---|---|
| **Voice match** | **98 / 100** — nails his hook + engagement‑bait + clickbait style |
| **Trend alignment** | **0 / 100** — that manipulative style is out of step with current trends |
| **Divergence** | **98** → tension gate fires |

Instead of averaging those into a meaningless **49**, the system surfaces the **tension**:

> **The conflict:** *"The creator's voice relies on aggressive, sensationalist clickbait and engagement bait, which is completely out of step with current trends that favor more authentic, less manipulative content."*
>
> **Where it clashes:** *"…5 YouTubers had a serious accident, click the link below. But beware, you will cry."*
>
> **Recommendation:** *"Remove all engagement bait and external clickbait links. Focus on delivering value within the content itself."*

That trade‑off — shown as two numbers plus a human‑readable explanation — is what no competing tool does, and it runs on real data today.

---

## Sponsor tools (all used non‑decoratively)

| Tool | Used for |
|---|---|
| **fal.ai** | Wizper (speech→text), video/vision routers (scene + OCR), `openrouter/router` LLM for the fingerprint & scorer |
| **Apify** | video download (hosted MP4) + creator/trend scraping |
| **Firecrawl** | trend discovery in the trend pipeline |
| **n8n** | orchestrates all four pipelines |
| **Cursor** | built the entire project |

---

## Repo layout

```
n8n/            voiceprint_merged_cloud.workflow.json    — extraction + fingerprint (working)
                voiceprint_scorer_raw.workflow.json      — two-axis scorer (working)
                voiceprint_orchestrator.workflow.json    — links the pipelines
n8nWorkflows/   creator.json · trends.json · contentAnalysis.json  — scrapers + scorer
data/           fingerprint.json · corpus.json · trends.json · scorecard.json  — real outputs
backend/        ingest.py · map_sources.py               — reference logic / Excel→schema mapping
docs/           BUILD_SPEC.md · INGEST_PLAN.md · SCHEMA_MAPPING.md
                SCORER_BUILD_PROMPT.md · CREDENTIALS.md
```

## Run it

Workflows run on **n8n Cloud**. Credentials are **not** committed — see [`docs/CREDENTIALS.md`](docs/CREDENTIALS.md).

1. `cp .env.example .env` and fill in `FAL_KEY`, `APIFY_TOKEN` (shared out‑of‑band).
2. Import the workflow JSONs into n8n and attach the **fal** and **Apify** Header‑Auth credentials.
3. Run the extraction/fingerprint workflow → produces `fingerprint.json`; run the scorer against a candidate → produces `scorecard.json`.

Data contracts and stage specs: [`docs/BUILD_SPEC.md`](docs/BUILD_SPEC.md).

---

## Status & roadmap

**Working:** scrapers → Google Sheets · extraction + fingerprint (real output) · two‑axis scorer with tension gate.
**Next:** enhancer loop (rewrite → rescore to a voice threshold), EU AI Act disclosure marker, and a single‑page UI featuring the two‑axis meter.
