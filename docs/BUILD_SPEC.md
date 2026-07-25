# Voiceprint — Build Spec

**Context for the agent:** This is a 5-hour hackathon build (Cursor Social Media Hack, Stuttgart, 25 July 2026). Hard stop on development at 15:00. Everything below is scoped to that window. When in doubt, choose the option that ships and degrades gracefully over the option that is more complete.

---

## 1. What we are building

A layer that sits between a content creator's AI generator and the publish button.

It does three things:

1. **Builds a voice fingerprint** of a specific creator by analysing their existing published work, weighted toward their best-performing pieces.
2. **Scores any new content on two independent axes** — how much it sounds like *that creator*, and how well it fits *what is currently working in their niche* — and surfaces the tension between the two rather than silently averaging it.
3. **Enhances the content** iteratively until it clears a voice threshold, then attaches EU AI Act disclosure marking before it goes out.

### The one-sentence pitch

> AI content is about to become a legal liability in Europe and an audience liability everywhere. This is the layer between your generator and the publish button.

### Why this framing matters (do not lose it in implementation)

This is **not** a content generator. The market has ~258 of those. This is a *defence* of a creator's voice against generic AI output. Consumer preference for AI-generated creator content dropped from 60% (2023) to 26% (2026); Google's June 2026 updates penalise scaled low-value content regardless of authorship. The product's value is the critic, not the generator.

The **two-axis score is the headline feature.** Voice match and trend alignment pull in opposite directions. Every competing tool hides this by blending them. We show the tradeoff as a number and let the creator decide. If you have to cut something, do not cut this.

---

## 2. Non-goals — do not build these

- ❌ **No video re-rendering.** We never touch pixels of an existing video. Too heavy for the window.
- ❌ **No database.** JSON files on disk. A DB buys nothing here and costs 30 minutes.
- ❌ **No auth, no user accounts, no multi-tenancy.** One creator, loaded from disk.
- ❌ **No content recommender as a feature.** It's one extra LLM call over the fingerprint at the end (§7.3). Five minutes of work, appears on a slide, gets no dedicated build time.
- ❌ **No live scraping during the demo.** Ingest runs beforehand; results are committed.
- ❌ **No scheduler, no analytics dashboard, no publishing integrations.** Those are the organisers' listed inspiration projects, i.e. baselines we are deliberately not competing with.

---

## 3. Architecture

Six thin stages. Every stage reads files and writes files. Nothing is coupled to anything else.

```
Firecrawl ─→ corpus.json ─┐
                          ├─→ fingerprint.json  (cached, built once)
engagement data ──────────┘
                                    ↓
Firecrawl (niche) ─→ trends.json ─→ SCORER ─→ scorecard.json
                                       ↓
                              ENHANCER (max 2 loops)
                                       ↓
                        ┌──────────────┼──────────────┐
                   fal (thumbnail)  ElevenLabs (VO)  text assets
                        └──────────────┼──────────────┘
                                       ↓
                            DISCLOSURE MARKER
                                       ↓
                                  output/ + UI
```

**Why file-based:** if the enhancer breaks, we demo the scorer. If fal is rate-limited, we show a cached thumbnail. If the trend builder fails, the voice axis still works. No single failure kills the demo. This is the most important architectural decision in the spec.

### Stack

- **Backend:** Python + FastAPI
- **Frontend:** React + Tailwind (Vite)
- **Storage:** JSON files under `data/`
- **LLM:** Claude via API, structured JSON output, `temperature=0` for all scoring calls
- **Orchestration:** n8n wraps stages 4→6 as the "publish path" workflow

### Repo layout

```
/
├── data/
│   ├── corpus.json          # committed, built pre-event
│   ├── fingerprint.json     # committed, cached
│   ├── trends.json          # committed, cached
│   └── fixtures/            # fake versions of all of the above
├── backend/
│   ├── main.py              # FastAPI app
│   ├── ingest.py            # stage 1 — run offline
│   ├── fingerprint.py       # stage 2
│   ├── trends.py            # stage 3
│   ├── scorer.py            # stage 4  ← the important one
│   ├── enhancer.py          # stage 5
│   ├── marker.py            # stage 6
│   └── prompts/             # all prompts as separate .txt files
├── frontend/
└── output/                  # generated assets land here
```

Keep prompts in separate files. They will be edited constantly under time pressure and inlining them makes that painful.

---

## 4. Data contracts

These are frozen at 11:15 and must not change. Everyone builds against them in parallel.

### `corpus.json`

```json
{
  "creator": {
    "handle": "string",
    "niche": "string",
    "platforms": ["youtube", "instagram"]
  },
  "items": [
    {
      "id": "string",
      "platform": "string",
      "title": "string",
      "transcript": "string | null",
      "caption": "string | null",
      "hook": "string",
      "published_at": "ISO8601",
      "metrics": { "views": 0, "likes": 0, "comments": 0 },
      "performance_percentile": 0.0
    }
  ]
}
```

`performance_percentile` is computed at ingest, relative to the creator's own catalogue. The fingerprint builder weights items above 0.75 heavily — the fingerprint is derived from what works for *them*, not from their average output.

### `fingerprint.json`

```json
{
  "version": 1,
  "built_at": "ISO8601",
  "creator_handle": "string",
  "voice_traits": [
    { "trait": "string", "evidence": "string", "strength": 0.0 }
  ],
  "hook_archetypes": [
    { "name": "string", "pattern": "string", "example": "string", "frequency": 0.0 }
  ],
  "pacing": {
    "avg_sentence_length": 0,
    "rhythm_description": "string",
    "opener_style": "string",
    "closer_style": "string"
  },
  "vocabulary": {
    "signature_phrases": ["string"],
    "register": "string",
    "formality": 0.0,
    "profanity_tolerance": "none | mild | high"
  },
  "taboos": [
    { "rule": "string", "reason": "string" }
  ],
  "exemplars": [
    { "excerpt": "string", "why_representative": "string" }
  ]
}
```

`taboos` are things this creator demonstrably never does — reads as insight in the demo and gives the scorer hard failure conditions.

### `trends.json`

```json
{
  "built_at": "ISO8601",
  "niche": "string",
  "trend_cards": [
    {
      "id": "string",
      "pattern": "string",
      "evidence": ["string"],
      "observed_on": ["platform"],
      "estimated_decay": "days | weeks | months",
      "confidence": 0.0
    }
  ]
}
```

### `scorecard.json` — the core artifact

```json
{
  "content_id": "string",
  "iteration": 0,
  "voice_match": {
    "score": 0,
    "dimensions": {
      "vocabulary": 0,
      "pacing": 0,
      "hook_style": 0,
      "register": 0,
      "structure": 0
    },
    "violations": [
      { "taboo": "string", "excerpt": "string" }
    ],
    "reasoning": "string"
  },
  "trend_align": {
    "score": 0,
    "matched_trends": [
      { "trend_id": "string", "how": "string" }
    ],
    "missed_opportunities": ["string"],
    "reasoning": "string"
  },
  "tension": {
    "present": true,
    "description": "string",
    "example": "string",
    "recommendation": "string"
  },
  "slop_flags": [
    { "pattern": "string", "excerpt": "string", "severity": "low | medium | high" }
  ]
}
```

The `tension` object is what makes this project different from every other submission. It should read like: *"The trending hook format for this niche is a hard cold-open claim. Your voice consistently opens with a question. Adopting the trend would likely lift reach but drops voice match to 41%."*

### `output/` bundle

```json
{
  "hook": "string",
  "script_beats": ["string"],
  "caption": "string",
  "thumbnail_url": "string",
  "voiceover_path": "string",
  "disclosure": { }
}
```

---

## 5. Stage specifications

### Stage 1 — Ingest (`ingest.py`)

**Runs offline, before the event.** Firecrawl over a public creator profile. Collect transcripts, captions, titles, hooks, engagement numbers. Compute `performance_percentile`. Write `corpus.json` and commit it.

Target ~40–60 items. Below 20 the fingerprint is noise; above 100 the fingerprint call gets expensive and slow.

> **Hackathon rules note:** research, notes, and prepared materials are explicitly permitted. Pre-built project-specific code is not. Selecting the demo creator and collecting public data is research. The pipeline code is written on the day.

### Stage 2 — Fingerprint builder (`fingerprint.py`)

One long structured LLM call. Strict JSON schema. Cached to disk. **Never re-run during the demo.**

Prompt guidance:
- Feed top-quartile items in full, remaining items as summaries
- Instruct the model to cite specific evidence for every trait — a trait without an excerpt is hallucination
- Ask explicitly for taboos (what this creator never does), not just positives
- Reject and retry if JSON is malformed; do not attempt to repair by hand

### Stage 3 — Trend builder (`trends.py`)

Firecrawl over the niche — top performers who are *not* this creator, plus platform/community sources. Same one-call structured pattern. Separate cache from the fingerprint, deliberately: one can fail without killing the other.

### Stage 4 — Scorer (`scorer.py`) ⭐

**The most important file in the repo.**

Two **independent** LLM calls, not one blended call. This is non-negotiable — a single call will average the axes internally and destroy the entire premise.

- `score_voice(content, fingerprint) -> voice_match`
- `score_trend(content, trends) -> trend_align`

Then a third cheap call, `find_tension(voice_result, trend_result, content)`, which only fires if the two scores diverge by more than 25 points.

Requirements:
- `temperature=0`, structured JSON only
- Every dimension score needs an excerpt as evidence
- Taboo violations are hard flags, not score deductions
- `slop_flags` detects generic-AI patterns: hedging, listicle scaffolding, "in today's fast-paced world," symmetric tricolons, empty superlatives

### Stage 5 — Enhancer (`enhancer.py`)

Loop: rewrite → rescore → stop at threshold **or 2 iterations**. Hard cap, enforced in code, no exceptions.

```python
MAX_ITERATIONS = 2
VOICE_THRESHOLD = 75
```

**Log every iteration to disk.** The iteration log is the most persuasive screen in the demo — it shows the system actually critiquing and correcting itself rather than making one call and asserting success. Surface it in the UI as a diff.

The rewrite prompt receives: the original content, the fingerprint, the failing dimensions, and the specific violations. Not the whole scorecard — targeted repair beats general "make it better."

Then generate assets:
- **Thumbnail:** fal, prompt derived from fingerprint visual traits + content
- **Voiceover:** ElevenLabs, cadence guided by `pacing` from the fingerprint
- **Text assets:** hook, script beats, caption

Wrap each in try/except. A failed asset degrades to a cached placeholder; it never breaks the run.

### Stage 6 — Disclosure marker (`marker.py`)

Pure function, no API calls. ~15 minutes of work, disproportionate pitch value.

From 2 August 2026 — eight days after this hackathon — EU AI Act Article 50 transparency obligations apply. Deployers must clearly label deepfakes and AI-generated or manipulated text published on matters of public interest, and disclose when users interact with an AI system. The Commission's Code of Practice (June 2026) provides an optional official EU icon in three variants.

Implement:
- C2PA-style metadata block embedded in output JSON
- Which components were AI-generated vs. human-authored vs. AI-modified
- The EU disclosure icon applied to the thumbnail
- Append-only audit log: what was disclosed, when, under which provision

```json
{
  "disclosure": {
    "generated_at": "ISO8601",
    "components": [
      { "asset": "thumbnail", "origin": "ai_generated", "model": "fal/...", "requires_label": true },
      { "asset": "script", "origin": "ai_modified", "human_reviewed": true, "requires_label": false }
    ],
    "eu_ai_act": {
      "article": "50",
      "applicable_from": "2026-08-02",
      "icon_variant": "string",
      "machine_readable_mark": "string"
    },
    "audit_log": [
      { "ts": "ISO8601", "action": "string", "detail": "string" }
    ]
  }
}
```

---

## 6. Frontend

Single page, three panels. It exists to make the scorer legible — it is not the product.

```
┌────────────────────────────────────────────────────────┐
│  creator header · fingerprint summary chips            │
├──────────────────────┬─────────────────────────────────┤
│  INPUT               │  TWO-AXIS SCORE                 │
│  paste draft         │  ┌───────────────────────────┐  │
│  or pick sample      │  │  voice ████████░░  78     │  │
│                      │  │  trend ███░░░░░░░  34     │  │
│                      │  └───────────────────────────┘  │
│                      │  tension callout                │
│                      │  slop flags                     │
├──────────────────────┴─────────────────────────────────┤
│  ITERATION LOG — diff view, before → after per pass    │
├────────────────────────────────────────────────────────┤
│  OUTPUT — hook · beats · caption · thumb · VO · badge  │
└────────────────────────────────────────────────────────┘
```

**Design direction.** Do not reach for the default AI-product look (cream background, serif display, terracotta accent) — judges see that on every submission. The subject here is *editorial quality control*, so borrow from proofing and review interfaces: monospace for scores and excerpts, a proportional face for prose, redline/diff visual language for the iteration log. One signature moment only — the two-axis meter, where the divergence between the bars is the thing the eye lands on first. Everything else stays quiet.

Copy rules: name things by what the creator controls. "Voice match," not "similarity coefficient." Errors state what failed and what still works — if trends failed to load, say the trend axis is unavailable and the voice score still stands.

---

## 7. Build order and timing

Team registration closes 11:00. Development stops 15:00. Submission 16:30.

| Time | Milestone |
|---|---|
| 11:00–11:15 | Freeze data contracts (§4). No code before this is agreed. |
| 11:15–12:30 | Parallel: fingerprint builder · scorer skeleton · frontend shell |
| **12:30** | **Fixtures committed** — complete fake `fingerprint.json`, `trends.json`, `scorecard.json` in `data/fixtures/`. Frontend builds against these from here and never blocks on backend. |
| 12:30–13:00 | Lunch (provided). Keep long LLM calls running through it. |
| 13:00–14:00 | Scorer working on real data. Both axes. Tension detection. |
| 14:00–14:45 | Enhancer loop + asset generation + disclosure marker |
| 14:45–15:00 | End-to-end run on the demo creator. Fix only what is broken. |
| **15:00** | **Freeze.** No new code. |
| 15:00–16:15 | Record 2-min video · build 5-slide deck · README · make repo public |
| 16:30 | Submit |

### Parallelisation (3 people)

- **A:** ingest + fingerprint + trends
- **B:** scorer + enhancer *(critical path — this person should be strongest)*
- **C:** frontend + video + deck

Fixtures at 12:30 are what make this actually parallel. Without them C is blocked until 14:00 and the video gets recorded in a panic.

---

## 8. Judging alignment

| Weight | Criterion | Where we win |
|---|---|---|
| 30% | Real problem solving | Voice dilution is the #1 creator anxiety in 2026; the AI Act deadline is 8 days out |
| 30% | Technical innovation & sponsor integration | Two-axis scoring + self-critiquing enhancement loop; Firecrawl, fal, ElevenLabs, n8n, Cursor all used non-decoratively |
| 25% | Execution & working demo | File-based stages degrade gracefully; 15:00 freeze protects stability |
| 15% | Presentation | Before/after with a number attached; the tension callout is the memorable beat |

Round one is judged **online** — the 2-minute video carries everything. It gets a full hour, not the leftovers.

### Demo sequence (2 minutes)

1. Show the fingerprint — built from *their* top performers, with cited evidence (15s)
2. Score their **existing** content, show one post that drifted — proves the scorer works before asking anyone to trust it (20s)
3. Feed in a fresh AI-generated draft. Voice 41%. Trend 89%. **Show the tension.** (30s)
4. Run the enhancer. Show the iteration diff. Voice 41 → 82. (30s)
5. Final asset with the EU disclosure badge attached. "This obligation starts August 2nd." (25s)

---

## 9. Standing rules for the agent

1. **Every stage reads from disk and writes to disk.** No in-memory coupling between stages.
2. **Every external API call is wrapped in try/except with a cached fallback.** fal, ElevenLabs, and Firecrawl will all rate-limit at some point today.
3. **All LLM calls return structured JSON.** No free-text parsing anywhere.
4. **Hard iteration caps everywhere.** No unbounded loops.
5. **`temperature=0` for all scoring.** Non-determinism in the scorer makes the demo unreproducible.
6. **Commit early and often.** Repo created at kickoff, public before submission, MIT licence.
7. **When time-constrained, cut features, never stability.** A working three-stage demo beats a broken six-stage one.
