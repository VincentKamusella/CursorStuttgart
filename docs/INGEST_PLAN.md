# Ingestion Pipeline — Plan (Stage 1)

Owner: Dhruv. Upstream: teammate's scraper dumps to Google Sheets. Downstream: Stage 2 (fingerprint) reads `data/corpus.json`.

This pipeline is a **normalizer + media→text layer**, not a scraper. It turns a creator's raw multimodal output (videos, audio, image posts, stories, comments) into schema-valid JSON that the fingerprint builder can trust. Runs **offline before the demo; outputs are committed.**

---

## 1. The seam: Google Sheet contract (frozen)

The teammate's scraper writes one row per content item. Agreed headers:

| Sheet column | Required | → maps to | Notes |
|---|---|---|---|
| `id` | yes | `id` | stable per item; if absent we hash `platform+url` |
| `platform` | yes | `platform` | youtube / instagram / tiktok … |
| `media_type` | yes | (routing) | `video` \| `audio` \| `image` \| `story` \| `comment` |
| `media_url` | for media rows | (fal input) | direct URL to the asset; empty for pure-text rows |
| `author` | for comment rows | (routing) | `creator` \| `audience` — who wrote it |
| `title` | no | `title` | |
| `caption` | no | `caption` | creator's own caption/description |
| `transcript` | no | `transcript` | pre-supplied transcript; else we derive via fal |
| `hook` | no | `hook` | else derived (first line of transcript/caption) |
| `published_at` | no | `published_at` | forced to ISO8601 |
| `views` / `likes` / `comments` | no | `metrics.{}` | ints; blank → 0 |

`performance_percentile` is **not** a sheet column — we compute it.

---

## 2. Model picks (fal)

| Media type | fal endpoint | Kept output |
|---|---|---|
| video → words | `fal-ai/wizper` (audio track → Whisper v3, 2× fast) | transcript (creator voice) |
| audio / voiceover / story audio | `fal-ai/wizper` (fallback `fal-ai/elevenlabs/speech-to-text/scribe-v2`) | transcript (creator voice) |
| speech gate (skip silent clips) | `fal-ai/silero-vad` | boolean, saves spend |
| image / thumbnail / story screenshot | `openrouter/router/vision` (Claude/Gemini/Qwen VLM) | `visual_desc` + `overlay_text` (OCR) in one call |
| video → scene (optional) | `openrouter/router/vision` | `visual_desc` only |

`wizper` + `router/vision` cover ~everything; the rest are fallbacks.

---

## 3. The critical rule: three buckets, not one

The product measures **the creator's own voice**. Every extracted text chunk is tagged by *who authored it* and *what it's for*, then routed. Mixing them poisons the fingerprint.

```
                     ┌─ creator spoken words (wizper: video/audio)   ─┐
  VOICE-TEXT  ──────▶├─ creator captions/titles (from sheet)          ├─▶ corpus.json          (feeds fingerprint)
  (his words)        └─ creator's OWN comment replies + OCR overlays  ─┘

  VISUAL      ──────▶ image/video visual_desc (router/vision) ─────────▶ visual_profile.json    (feeds Stage-5 thumbnail gen)

  AUDIENCE    ──────▶ other people's comments ──────────────────────────▶ audience_signals.json  (NOT voice; optional trend signal)
```

Two fatal mistakes this prevents:
- **Audience comments in the voice bucket** → fingerprint learns the *fans'* voice. Only `author == creator` replies count as voice.
- **VLM image captions in the voice bucket** → "a man in a red hoodie points at camera" is not his prose. That text goes to `visual_profile.json` (which Stage 5 needs anyway). **Exception:** text *he wrote on the image* (story overlays, `overlay_text` from OCR) IS his voice → voice bucket.

---

## 4. Pipeline stages

```
Google Sheet (media URLs + metadata + comments)
      │
 [0] MEDIA→TEXT  (fal, offline, cached per item at data/media_cache/{id}.json)
      │           route by media_type → wizper / router-vision / vad-gate
 [1] normalize   (types, ISO dates, blanks→null)
 [2] classify    (creator|audience · voice|visual) → route to buckets
 [3] derive hook (first sentence of transcript, else caption)
 [4] percentile  (engagement rank within THIS creator's catalogue)
 [5] validate + write
      │
      ▼
  data/corpus.json  +  data/visual_profile.json  +  data/audience_signals.json
```

### `performance_percentile` (the only real analytics)
Rank each item against the creator's *own* catalogue by **engagement rate**, not raw views (raw views let one viral outlier dominate the fingerprint):

```
score = (likes + comments) / max(views, 1)
performance_percentile = rank(score, pct=True)   # 0..1
```
Stage 2 weights items above **0.75** heavily.

---

## 5. Robustness (Stage-1 rules from the build spec)

- **Runs offline, outputs committed.** A Sheets/fal flake at demo time is irrelevant — the JSON is already on disk.
- **Cache everything.** Raw sheet → `data/raw_sheet.csv`; each fal result → `data/media_cache/{id}.json`. Re-runs never re-pay or re-hit Google.
- **Every fal call in try/except** → on failure, skip the item, log it, keep going. No single asset breaks the run.
- **Respect fal concurrency** (new accounts = 2 parallel jobs). Sequential-with-cache is the safe default; parallelize to ≤2 only if slow.
- Warn (don't crash) if item count falls outside 20–100 (below = noisy fingerprint, above = slow/expensive).

---

## 6. Two ways to run it

Same pipeline, two implementations. Both emit identical `corpus.json` / `visual_profile.json` / `audience_signals.json`.

### A) n8n workflow — `n8n/voiceprint_ingest.workflow.json` (primary)

Runs on a teammate's laptop that has a live n8n. **Import → set two credentials → run.** Validated against real node schemas (5 nodes, 0 errors). Topology:

```
Run ingestion (manual) → Read creator sheet (Google Sheets) → Enrich + assemble buckets (Code)
    → To JSON files (Convert to File) → Write to data/ (Read/Write Files from Disk)
```

All fal calls + the three-bucket routing + percentile live in the single **Code** node (calls fal's sync endpoint `https://fal.run/<model>` via n8n's `httpRequest` helper). Import steps:

1. In n8n: *Workflows → Import from File →* `n8n/voiceprint_ingest.workflow.json`.
2. **Set `FAL_KEY` in n8n's environment** before starting n8n (`export FAL_KEY=...`) — the Code node reads `$env.FAL_KEY`, nothing is hardcoded (repo is public).
3. On *Read creator sheet*: attach a Google Sheets OAuth credential and set the real **document ID** + **sheet/tab name** (placeholders `YOUR_GOOGLE_SHEET_ID` / `Sheet1`).
4. On *Write to data/*: output path is `./data/*.json` relative to n8n's working dir — edit to an absolute path if needed.
5. Click **Run ingestion**. Three JSON files are written; commit them.

Caveats vs. the Python version: n8n's Code node can't easily do the per-item disk cache, so a re-run re-hits fal — fine for a one-shot pre-event ingest. fal concurrency (2) is respected because the Code node awaits sequentially.

### B) Python script — `backend/ingest.py` (reference / fallback)

Zero infra, runs anywhere; also the readable spec of the exact logic. Use it if n8n isn't handy, or to regenerate outputs fast. It **does** cache each fal result to `data/media_cache/{id}.json`, so re-runs never re-pay.

```bash
pip install pandas fal-client requests
export FAL_KEY="<key>"          # NOT hardcoded — repo is shared/public
export SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>"
python backend/ingest.py        # add --no-fal to skip media→text and use sheet text only
```

Outputs land in `data/`. Commit `corpus.json`, `visual_profile.json`, `audience_signals.json` either way.

> Note: n8n-mcp is **documentation mode only** — it authored & validated this workflow JSON but does not run it; execution happens on the teammate's live n8n. n8n's *other* assigned job in the spec is the publish path (stages 4→6).
