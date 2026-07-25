# Demo Script — "Why didn't my video perform?" (2 minutes)

Speaking + showcasing script. Product: **Spotlight — for creators who shine.**

**Website (Spotlight frontend):** `http://localhost:8777` (served from `frontend/`; run `python3 -m http.server 8777` in that folder — ask to deploy for a public link).
**Workflows (n8n Cloud):** `crawlCreatorContent`, `SocialTrends`, `Spotlight — Extract + Fingerprint`, `Spotlight — Two-axis Scorer`, and Vincent's webhook scorer `ContentAnalysis`.
**Repo:** `CursorStuttgart` (branch `main`) · contract in `docs/BUILD_SPEC.md`.

**Demo creator (real data, already crawled & fingerprinted):** `ChaosAdam13` — German candy/food comedy Shorts, 15 videos. All outputs are committed in `data/` (`fingerprint.json`, `corpus.json`, `trends.json`, `scorecard.json`).

---

## The problem we're solving

**A creator posts a video. It flops. Their analytics say "3.2% CTR, 41% retention."**

That tells them *what* happened. It never tells them *why*. And you cannot fix what
you cannot name — so the creator guesses, changes five things at once, and learns
nothing from the next post either.

There are really only two reasons a post underperforms, and they need opposite fixes:

1. **It didn't sound like them.** The audience subscribed for a specific voice and got
   a stranger. Nothing about the topic was wrong.
2. **It sounded exactly like them, but it was out of step** with what is currently
   working in their category.

Analytics cannot tell these apart. One number cannot either — which is why a single
"quality score" from an AI tool is useless here. Averaging the two causes together
produces a mediocre number that describes neither.

**So we build two separate reference points from real data, and score against each
independently:**

| Reference | Built from | Answers |
|---|---|---|
| **Fingerprint** (Creator DNA) | The creator's own past videos — `crawlCreatorContent` → `Spotlight — Extract + Fingerprint` | "Does this sound like me?" |
| **Trend cards** (Trend radar) | What's currently working in the creator's categories — `SocialTrends` | "Is this in step with right now?" |

Two isolated LLM calls (fal → `openrouter/router`, `temperature 0`), neither seeing the
other's input. When they **disagree by more than 25 points**, a third call names the
trade-off in plain language.

That gap is the answer to "why didn't it perform" — and it's the one thing a creator
cannot get from their own analytics.

### Why the calls must stay isolated

Put both references in one prompt and the model collapses them: it starts treating
"on-trend" as evidence of "good," and a strong voice match drags the trend score up.
You get one opinion wearing two hats, and the disagreement — the entire product —
disappears. Each prompt states the other axis is explicitly out of scope.

### Two details worth defending if challenged

- **Taboo violations are hard flags, not deductions** — the fingerprint lists things the
  creator *never* does; a violation is flagged as a rule break in `voice_match.violations`,
  never quietly averaged into a score.
- **A degraded axis returns `null`, not `0`** — "unavailable" is a different fact from
  "scored zero."

### The differentiator judges remember: **Receipts** 🧾

Every number Spotlight shows is **traceable**. Voice-match cites the exact fingerprint
trait and the verbatim line it matched; trend fit names the specific trend card; a taboo
flag points at the exact clashing sentence. In the UI, every insight has an **Evidence**
button — *"Where this statistic comes from."* Nothing is a black-box opinion. This is the
trust story, and it lines up with the **EU AI Act Article 50** disclosure obligations that
start **2 August 2026**.

---

## Run of show — 2:00

> Two ways to run Beat 3: **(A) the Spotlight Draft Predictor** (in-browser, zero
> failure risk — recommended for the recorded video) or **(B) the live backend curl**
> (proof for judges in the room). Pick one; keep the other as fallback.

### Beat 1 — The problem (0:30)

**SHOW:** Spotlight **landing page** (`http://localhost:8777`) — the "Beyond the scroll /
into every second" hero, the five feature chips (Creator DNA · Two-axis score · Trend
radar · Draft predictor · **Receipts**), and the *Powered by fal · Apify · n8n ·
Firecrawl* strip.

**SAY:**
> "This is Spotlight. Meet a creator with 40,000 subscribers whose latest video did half
> his usual numbers. His analytics tell him retention dropped at three seconds. They do
> not tell him *why* — and that's the real problem: he can't fix what he can't name. There
> are only two possibilities. Either it didn't sound like him, or it sounded just like him
> but was out of step with what's working right now. Opposite fixes — and nothing in his
> dashboard can tell them apart."

Click **Get Started** → the app opens on his channel.

### Beat 2 — The two reference points (0:30)

**SHOW:** The Spotlight app. On **Statistics**, his real best video —
*"Süßigkeiten die es 2027 nicht mehr geben wird…"*, **367K views, 8.5K likes.** Then the
**For You** tab: **Creator DNA** (the fingerprint) and **Trend radar** side by side.

**SAY:**
> "So we build him two reference points from real data. First his **fingerprint** — we
> crawl his own back catalogue, 15 recent videos with their performance, and extract how
> he actually writes: he opens on a nostalgia challenge, pivots fast to engagement bait,
> closes on a clickbait link. That's his DNA, and it repeats verbatim across every video.
> Second, the **trends** in his category, pulled live from social platforms — each with a
> confidence score and a decay estimate, because a trend that dies in 14 days is different
> advice from one with 45 days left."

*(Point at any **Evidence** button.)* "And everything here has receipts — tap any insight
and it shows the exact video or line it came from."

### Beat 3 — The diagnosis (0:45)

#### Option A — Spotlight Draft Predictor (recommended for the video)

**SHOW:** For You tab → **Draft Predictor**. Paste his next script into the box → click
**Review my draft**. The two-axis bars fill in, predicted reach appears, and enhanced
suggestions render.

**SAY** (while it reviews, then read it):
> "Here's his next script. **Voice scores high** — it opens on his signature hook, exactly
> his style. **Trend scores low** — in his niche right now, audiences are rewarding
> authentic, less manipulative openers, and his engagement-bait close is out of step.
>
> **That's the answer.** The video isn't bad and it isn't off-brand. It's *him*, and it's
> out of step — and no single score could have told him that. A blended number would have
> averaged those into a meaningless middle.
>
> It also caught a hard violation: he has a pattern of clickbait CTAs, and the scorer flags
> the exact line — a rule break with the receipt attached, not a quiet deduction."

#### Option B — Live backend (proof for the room)

**SHOW:** Run the request; n8n canvas visible behind it — the two branches make the
isolation obvious. *(Vincent's webhook scorer.)*

```bash
curl -s -X POST https://vincentkamusella.app.n8n.cloud/webhook/score \
  -H 'Content-Type: application/json' \
  -d @~/Desktop/demo_payload.json | tee ~/Desktop/demo_out.json | jq '{
    voice: .voice_match.score, trend: .trend_align.score,
    gap: (.voice_match.score - .trend_align.score),
    violations: .voice_match.violations, tension: .tension.recommendation,
    slop: [.slop_flags[].pattern], degraded: .meta.degraded }'
```

Real result we produced on this creator (`data/scorecard.json`): **voice 98, trend 0,
gap 98, tension fires** — *"the voice relies on aggressive, sensationalist clickbait,
out of step with trends that favor authentic content."*

### Beat 4 — Close (0:15)

**SHOW:** `tension.recommendation` on screen (or the Draft Predictor's suggestions +
Apply button).

**SAY:**
> "Now the fix is nameable and it's his call: keep his signature opener and accept the
> reach, or lead with the authentic angle and keep his voice in the second line. He posts
> again knowing which lever he pulled — with receipts for every call — instead of changing
> five things and learning nothing."

---

## Pre-flight — 10 minutes before

| # | Check | If it fails |
|---|---|---|
| 1 | Spotlight served: `cd frontend && python3 -m http.server 8777` → `http://localhost:8777` loads | Use the committed screenshots / `data/*.json` |
| 2 | Both Sheets tabs open (Single Creator, Trends) — optional B-roll | Screenshot them the night before |
| 3 | Draft Predictor pre-filled with a sample draft (it is, by default) | Type any script live — it reads hook/CTA/length |
| 4 | *(Option B only)* Webhook scorer **active** (toggle, top-right) | Inactive = 404. Click **Execute workflow**, POST to `/webhook-test/score` |
| 5 | *(Option B only)* fal credential on the scorer's fal nodes | Share `fal.ai account` with the **CursorStuttgart** project first |
| 6 | *(Option B only)* Dry-run the curl | Keep the response — it's your fallback |

Backend at `localhost:8000` is **expected** unreachable; the Spotlight demo is fully
front-end + committed data, so nothing on stage depends on it.

## If it breaks

| Symptom | Do this, live |
|---|---|
| Website won't load | Fall back to committed screenshots + `data/scorecard.json` — the story still lands |
| Draft Predictor doesn't respond | Refresh; the review is client-side and instant. Worst case, read the numbers from `data/scorecard.json` |
| *(Option B)* `404 not registered` | Webhook inactive or test URL consumed — click **Execute workflow**, resend |
| *(Option B)* Hangs >30s | Keep talking through beat 3's argument; switch to the saved `demo_out.json` |
| `tension.present: false` | Own it: "the model was kinder than expected — threshold is 25," point at `IF: divergence > 25`, move on |

**Golden rule:** one retry, then canned output, then keep talking.

## If asked

**Where does the fingerprint data come from?** `crawlCreatorContent` → `Spotlight —
Extract + Fingerprint`. It resolves a YouTube profile to its channel, downloads recent
Shorts (Apify), transcribes speech (fal **Wizper**) and reads the visuals + on-screen text
(fal video/vision router), then a fal LLM extracts the voice fingerprint. 15 videos, 10
with speech, real output in `data/fingerprint.json`.

**And the trends?** `SocialTrends` — Bluesky, Mastodon and Reddit public APIs, plus
**Firecrawl** search for TikTok/Instagram/LinkedIn. Last live run: ~120 rows.

**Why not TikTok/Instagram/LinkedIn properly?** They have no open trends API. TikTok's
Creative Center returns `no permission`; Instagram and LinkedIn serve login walls. We use
Firecrawl search there and label it discovery-grade, not official metrics. Saying that
straight beats implying coverage we don't have.

**Is the scorer real?** Yes — two independent fal LLM calls at `temperature 0`, a
divergence gate at 25, and a third call for the tension. We ran it end-to-end and the
result is committed: `data/scorecard.json` (voice 98 / trend 0 / tension). Rebuilt raw-HTTP
so it needs only a fal key — no community-node install.

**What are the numbers in the UI?** Views/likes and the voice fingerprint are **real**
(from `corpus.json` / `fingerprint.json`). Derived sub-metrics (watch-time, completion,
growth chart) are illustrative demo values — we never scraped per-second retention. The
**98% voice match and the two-axis tension are the real, defensible stars.**

**Don't demo live:** `content.type: "video_url"` (runs Apify download + Wizper — slowest,
most fragile path); YouTube worldwide trends and video comments (need the free Data API
key, nodes disabled until then).
