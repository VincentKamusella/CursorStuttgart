# Claude Code prompt — build the Relevance Scorer in n8n

Copy everything in the fenced block below into Claude Code (the teammate should run it from the `CursorStuttgart` repo, with the n8n-mcp server connected in full/API mode to the team's n8n Cloud instance). It builds **Stage 4 — the two-axis Scorer** from `docs/BUILD_SPEC.md`.

---

```
ROLE
You are building an n8n Cloud workflow for the "Spotlight" hackathon project. Read
docs/BUILD_SPEC.md (esp. §4 data contracts and §5 Stage 4) and docs/INGEST_PLAN.md
first. The ingestion + fingerprint pipeline already exists (see
n8n/voiceprint_merged_cloud.workflow.json for the exact n8n patterns to copy: fal
HTTP nodes, Header Auth credential, structured-JSON output, onError/retry hardening).
Reuse those patterns verbatim.

GOAL
Build ONE n8n workflow: the RELEVANCE SCORER. It takes a candidate video (the piece
about to be published) plus the creator's fingerprint.json and the niche trends.json,
and produces scorecard.json — scoring the candidate on TWO INDEPENDENT AXES and
surfacing the tension between them.

THE ONE NON-NEGOTIABLE (do not violate this)
Voice-match and trend-alignment are scored in TWO SEPARATE LLM CALLS. NEVER a single
blended call — a blended call silently averages the two axes and destroys the entire
product premise. The tension between the two numbers IS the feature. If you must cut
something, never cut this.

HARD RULES (from the spec)
- temperature: 0 on every scoring call (reproducible demo).
- Every LLM call returns STRICT JSON only (no prose, no markdown). Parse it in a Code node.
- Every dimension score must cite a real excerpt as evidence. A score without an excerpt
  is a hallucination — instruct the model to leave it out rather than invent one.
- Taboo violations (from the fingerprint) are HARD FLAGS, not score deductions.
- No unbounded loops. No blending. Degrade gracefully (onError=continueRegularOutput).

fal LLM CALL PATTERN (proven working — copy exactly)
- Node: HTTP Request v4.4, POST https://fal.run/openrouter/router
- Auth: "Generic Credential Type" -> "Header Auth", credential = the team's fal
  credential (Header Auth: Name "Authorization", Value "Key <FAL_KEY>").
- Body: JSON, "Using JSON", jsonBody expression:
  {{ JSON.stringify({ model: "google/gemini-2.5-flash", temperature: 0,
     system_prompt: "<SYSTEM>", prompt: <the built prompt expression> }) }}
  (For higher-quality judgment, model can be an Anthropic Claude id via OpenRouter —
   the spec recommends Claude at temp 0 for scoring. Confirm the exact model id with
   the fal-ai MCP get_model_schema if unsure.)
- Output: the model's text is in the response field `.output` — it is a JSON STRING.
  Parse it with JSON.parse in the following Code node.
- Hardening on every fal node: onError=continueRegularOutput, retryOnFail=true,
  maxTries=3, waitBetweenTries=3000, alwaysOutputData=true.

WORKFLOW ARCHITECTURE (build these nodes)
1. Manual Trigger ("Score candidate").
2. "Load candidate" (Code): the candidate content. Support BOTH modes:
   - candidate_video_url present  -> needs extraction (step 3)
   - candidate_text present       -> a draft script/caption, skip extraction
   Output one item: { candidate_video_url?, candidate_text?, candidate_caption?, candidate_hook? }
3. Candidate extraction (ONLY if candidate_video_url):
   reuse the ingestion sub-chain from voiceprint_merged_cloud.workflow.json —
   Apify download (streamers/youtube-video-downloader, storeInKVStore) -> Wizper
   (audio->text on downloadedFileUrl) + Video-router (scene+on-screen text) -> combine
   into candidate_text (transcript) + candidate_visual + candidate_overlay.
   If candidate_text was supplied directly, pass it straight through.
4. "Load fingerprint" (Code or HTTP): read fingerprint.json (the creator's voice
   fingerprint). For the hackathon, embed it or read from the team's store; long-term
   read the committed data/fingerprint.json.
5. "Load trends" (Code or HTTP): read trends.json (trend_cards).
6. TWO INDEPENDENT SCORERS (both take the SAME candidate text; they must not see each
   other's output):
   6a. "score_voice" (fal LLM) — inputs: candidate text + fingerprint. -> voice_match JSON.
   6b. "score_trend" (fal LLM) — inputs: candidate text + trends. -> trend_align JSON.
   Parse each with a Code node ("parse voice", "parse trend").
7. "Merge scores" (Merge, combine by position) -> one item holding voice_match + trend_align.
8. "Divergence gate" (IF node): compute d = abs(voice_match.score - trend_align.score).
   - d > 25 -> run "find_tension" (fal LLM) with BOTH results + candidate. -> tension JSON.
   - d <= 25 -> set tension = { present: false }.
9. "Assemble scorecard" (Code): build scorecard.json (schema below), including slop_flags
   (see prompt). Output the scorecard as JSON.
10. Output: write/return scorecard.json (Cloud has no reachable disk — end here and the
    orchestrator pulls it via the n8n API, same as the ingestion pipeline does).

DATA CONTRACTS (frozen — match exactly; from BUILD_SPEC §4)

INPUT fingerprint.json (already produced by the fingerprint pipeline):
{ creator_handle, voice_traits:[{trait,evidence,strength}], hook_archetypes:[{name,pattern,example}],
  pacing:{rhythm_description,opener_style,closer_style}, vocabulary:{signature_phrases,register,formality},
  taboos:[{rule,reason}], exemplars:[{excerpt,why_representative}] }

INPUT trends.json:
{ built_at, niche, trend_cards:[{ id, pattern, evidence:[..], observed_on:[platform],
  estimated_decay, confidence }] }

OUTPUT scorecard.json (THE core artifact):
{
  "content_id": "string",
  "iteration": 0,
  "voice_match": {
    "score": 0,
    "dimensions": { "vocabulary":0, "pacing":0, "hook_style":0, "register":0, "structure":0 },
    "violations": [ { "taboo":"string", "excerpt":"string" } ],
    "reasoning": "string"
  },
  "trend_align": {
    "score": 0,
    "matched_trends": [ { "trend_id":"string", "how":"string" } ],
    "missed_opportunities": ["string"],
    "reasoning": "string"
  },
  "tension": {
    "present": true,
    "description": "string",
    "example": "string",
    "recommendation": "string"
  },
  "slop_flags": [ { "pattern":"string", "excerpt":"string", "severity":"low|medium|high" } ]
}

Every voice_match.dimensions score is 0-100 and needs an excerpt in reasoning/violations.
The tension object should read like a human editor, e.g.: "The trending hook format is a
hard cold-open claim; this creator consistently opens with a question. Adopting the trend
lifts reach but drops voice match to 41%."

LLM PROMPTS (system prompts — return STRICT minified JSON only)

score_voice SYSTEM:
"You score how much a CANDIDATE piece of content sounds like THIS creator, using their
voice fingerprint. Return ONLY minified JSON: {score:0-100, dimensions:{vocabulary,pacing,
hook_style,register,structure} each 0-100, violations:[{taboo,excerpt}], reasoning}. Score
each dimension against the fingerprint's voice_traits/pacing/vocabulary/hook_archetypes.
Cite a verbatim excerpt from the candidate as evidence in `reasoning` for each dimension;
if you cannot find evidence, score conservatively rather than invent it. If the candidate
violates any fingerprint TABOO, add it to `violations` as a hard flag (do not just lower a
score). temperature 0."
score_voice USER PROMPT (build in an expression):
"FINGERPRINT:\n<fingerprint.json>\n\nCANDIDATE:\nTRANSCRIPT: <candidate_text>\nHOOK:
<candidate_hook>\nCAPTION: <candidate_caption>"

score_trend SYSTEM:
"You score how well a CANDIDATE fits what is CURRENTLY WORKING in this niche, using the
trend_cards. Return ONLY minified JSON: {score:0-100, matched_trends:[{trend_id,how}],
missed_opportunities:[string], reasoning}. Weight each trend by its confidence and
estimated_decay (fresher/higher-confidence trends matter more). Do NOT consider the
creator's personal voice here — only trend fit. temperature 0."
score_trend USER PROMPT:
"TRENDS:\n<trends.json>\n\nCANDIDATE:\nTRANSCRIPT: <candidate_text>\nHOOK:
<candidate_hook>\nCAPTION: <candidate_caption>"

find_tension SYSTEM (only fires when |voice-trend| > 25):
"Two independent scores diverge: voice_match and trend_align. In ONE JSON object explain
the tradeoff for the creator. Return ONLY: {present:true, description, example,
recommendation}. `description` names the specific conflict (what the trend wants vs what
the voice does); `example` quotes the exact candidate line where they clash;
`recommendation` is one concrete, actionable choice. Speak like an editor, not a metric."
find_tension USER PROMPT:
"VOICE_RESULT:\n<voice_match json>\n\nTREND_RESULT:\n<trend_align json>\n\nCANDIDATE:
<candidate_text>"

slop_flags (in the Assemble node OR a small dedicated fal call): detect generic-AI writing
patterns in the candidate — hedging, listicle scaffolding, "in today's fast-paced world",
symmetric tricolons, empty superlatives. Each: {pattern, excerpt, severity}. Keep this
SEPARATE from the two axis scores so it never contaminates them.

CREDENTIALS
- fal: reuse the team's "Header Auth" credential (Authorization: Key <FAL_KEY>) on every
  fal node. If a candidate-extraction branch is included, also attach the Apify Header
  Auth credential (Authorization: Bearer <APIFY_TOKEN>) to the Apify node.
- Never hardcode keys in the workflow JSON. Never commit keys to git.

BUILD + VALIDATE
- Prefer building the workflow JSON programmatically, then deploy via the n8n API
  (POST /api/v1/workflows) as a NEW workflow — do NOT overwrite existing workflows.
- Use the n8n-mcp tools: get_node to confirm node schemas/typeVersions (httpRequest 4.4,
  switch 3.4, merge 3.2, if, code 2), and n8n_validate_workflow on the deployed id until
  errorCount = 0.
- Test with a small candidate first (one draft script), confirm score_voice and
  score_trend produce independent numbers and that the tension gate fires when they
  diverge >25.

DELIVERABLE
- The deployed, validated scorer workflow (report its workflow id).
- Save the workflow JSON to n8n/voiceprint_scorer_cloud.workflow.json (credentials
  stripped), and a short note in docs/ describing inputs/outputs.
- Confirm the output matches the scorecard.json schema above exactly.

Do NOT build the enhancer (Stage 5) or the frontend — scorer only.
```

---

## Architecture at a glance (for your teammate)

```
Score candidate (trigger)
  → Load candidate ─┬─(video url)→ Apify download → Wizper + Video-router → candidate_text
                    └─(draft text)─────────────────────────────────────────→ candidate_text
  → Load fingerprint.json ─┐
  → Load trends.json ──────┤
                           ├─► score_voice  (fal LLM: candidate + fingerprint) → voice_match ─┐
                           └─► score_trend  (fal LLM: candidate + trends)       → trend_align ─┤
                                                                                               ▼
                                                                                    Merge scores
                                                                                               ▼
                                                            divergence = |voice − trend|  (IF > 25)
                                                              ├─ yes → find_tension (fal LLM) → tension
                                                              └─ no  → tension = {present:false}
                                                                                               ▼
                                                                      Assemble scorecard.json (+ slop_flags)
```

**The three rules that make or break it:** (1) two *separate* LLM calls for the two axes — never one blended call; (2) `temperature: 0` everywhere; (3) every score cites a real excerpt, taboos are hard flags. Everything else is plumbing your teammate already has patterns for in the merged workflow.
