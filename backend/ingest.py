"""
Stage 1 — Ingestion pipeline.

Google Sheet (teammate's scraper dump) --> media->text via fal --> three JSON buckets.
Runs OFFLINE before the demo; outputs are committed. See docs/INGEST_PLAN.md.

Design rules (from the build spec):
  - Every fal call is wrapped; a failed item is skipped, never crashes the run.
  - Everything is cached to disk so re-runs never re-pay fal or re-hit Google.
  - The three-bucket split keeps the creator's own voice separate from
    audience comments and from image/visual descriptions. Mixing them poisons
    the fingerprint — this is the whole point of the routing in classify_row().

Usage:
    pip install pandas fal-client requests
    export FAL_KEY=...          # never hardcode; the repo is shared/public
    export SHEET_CSV_URL="https://docs.google.com/spreadsheets/d/<id>/export?format=csv&gid=<gid>"
    python backend/ingest.py [--no-fal]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

# --------------------------------------------------------------------------- #
# Config
# --------------------------------------------------------------------------- #
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
CACHE = DATA / "media_cache"
RAW_SHEET = DATA / "raw_sheet.csv"

WIZPER = "fal-ai/wizper"
SCRIBE = "fal-ai/elevenlabs/speech-to-text/scribe-v2"   # STT fallback
VAD = "fal-ai/silero-vad"
VISION = "openrouter/router/vision"

VISION_PROMPT = (
    "Describe this social-media image in one sentence for a creator style profile, "
    "then, on a new line prefixed 'TEXT:', transcribe verbatim any text overlaid on "
    "the image (captions, stickers, titles). If there is no overlaid text write 'TEXT:'."
)

# Fingerprint weights items above this percentile heavily.
TOP_QUARTILE = 0.75
MIN_ITEMS, MAX_ITEMS = 20, 100


# --------------------------------------------------------------------------- #
# Sheet pull (with local CSV fallback)
# --------------------------------------------------------------------------- #
def pull_sheet(url: str | None) -> pd.DataFrame:
    """Read the sheet as CSV; cache it; fall back to the cache on any failure."""
    if url:
        try:
            df = pd.read_csv(url, dtype=str, keep_default_na=False)
            CACHE.mkdir(parents=True, exist_ok=True)
            df.to_csv(RAW_SHEET, index=False)
            print(f"[sheet] pulled {len(df)} rows -> cached {RAW_SHEET.name}")
            return df
        except Exception as e:  # network / permissions / mid-edit
            print(f"[sheet] live pull failed ({e}); falling back to cache")
    if RAW_SHEET.exists():
        df = pd.read_csv(RAW_SHEET, dtype=str, keep_default_na=False)
        print(f"[sheet] loaded {len(df)} rows from cache {RAW_SHEET.name}")
        return df
    sys.exit("[sheet] no SHEET_CSV_URL and no cached raw_sheet.csv — nothing to ingest")


# --------------------------------------------------------------------------- #
# fal media -> text  (cached per item)
# --------------------------------------------------------------------------- #
def _fal():
    import fal_client  # imported lazily so --no-fal works without the dep/key
    if not os.environ.get("FAL_KEY"):
        sys.exit("[fal] FAL_KEY not set — export it or run with --no-fal")
    return fal_client


def _cache_path(item_id: str) -> Path:
    return CACHE / f"{item_id}.json"


def media_to_text(item_id: str, media_type: str, media_url: str, use_fal: bool) -> dict:
    """
    Return {'transcript': str|None, 'visual_desc': str|None, 'overlay_text': str|None}.
    Cached to data/media_cache/{id}.json — never re-pays fal.
    On any fal error, returns empties (item degrades, run continues).
    """
    cp = _cache_path(item_id)
    if cp.exists():
        return json.loads(cp.read_text())

    out: dict[str, str | None] = {"transcript": None, "visual_desc": None, "overlay_text": None}
    if not use_fal or not media_url:
        return out

    try:
        fal = _fal()
        if media_type in ("video", "audio", "story"):
            # story may be audio+overlay; we transcribe audio here, OCR handled below
            if media_type in ("video", "audio"):
                r = fal.subscribe(WIZPER, arguments={"audio_url": media_url})
                out["transcript"] = (r.get("text") or "").strip() or None
        if media_type in ("image", "story"):
            r = fal.subscribe(VISION, arguments={
                "image_url": media_url,
                "prompt": VISION_PROMPT,
            })
            text = _vision_text(r)
            out["visual_desc"], out["overlay_text"] = _split_vision(text)
    except Exception as e:
        print(f"[fal] {item_id} ({media_type}) failed: {e} — skipping media text")

    CACHE.mkdir(parents=True, exist_ok=True)
    cp.write_text(json.dumps(out, ensure_ascii=False, indent=2))
    return out


def _vision_text(resp: dict) -> str:
    """router/vision output shape varies by underlying model — parse defensively.
    TODO: confirm exact key with get_model_schema and pin it."""
    for k in ("output", "text", "response", "content"):
        v = resp.get(k)
        if isinstance(v, str) and v.strip():
            return v
    return str(resp)


def _split_vision(text: str) -> tuple[str | None, str | None]:
    """Split '<description>\\nTEXT: <overlay>' into (visual_desc, overlay_text)."""
    desc, overlay = text, None
    if "TEXT:" in text:
        head, _, tail = text.partition("TEXT:")
        desc = head.strip() or None
        overlay = tail.strip() or None
    return (desc or None), overlay


# --------------------------------------------------------------------------- #
# Normalize / classify / route
# --------------------------------------------------------------------------- #
def _iso(s: str) -> str | None:
    if not s:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(s.strip(), fmt).replace(tzinfo=timezone.utc).isoformat()
        except ValueError:
            continue
    return s.strip()  # already ISO or unknown; leave as-is


def _int(s: str | None) -> int:
    try:
        return int(float(str(s).replace(",", "").strip() or 0))
    except ValueError:
        return 0


def _ensure_id(row: dict) -> str:
    rid = (row.get("id") or "").strip()
    if rid:
        return rid
    seed = f"{row.get('platform','')}|{row.get('media_url','')}|{row.get('caption','')}"
    return hashlib.sha1(seed.encode()).hexdigest()[:12]


def derive_hook(transcript: str | None, caption: str | None) -> str:
    src = (transcript or caption or "").strip()
    if not src:
        return ""
    first = src.replace("\n", " ").split(". ")[0]
    words = first.split()
    return " ".join(words[:14]) + ("…" if len(words) > 14 else "")


# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #
def main(use_fal: bool) -> None:
    DATA.mkdir(exist_ok=True)
    df = pull_sheet(os.environ.get("SHEET_CSV_URL"))

    corpus_items: list[dict] = []      # VOICE-TEXT bucket
    visual_profile: list[dict] = []    # VISUAL bucket (for Stage-5 thumbnails)
    audience_signals: list[dict] = []  # AUDIENCE bucket (NOT voice)

    creator_handle = df.iloc[0].get("creator") if "creator" in df.columns else ""
    niche = df.iloc[0].get("niche") if "niche" in df.columns else ""

    for _, raw in df.iterrows():
        row = {k: (str(v).strip() if v is not None else "") for k, v in raw.items()}
        item_id = _ensure_id(row)
        mtype = (row.get("media_type") or "").lower()
        author = (row.get("author") or "creator").lower()

        # --- AUDIENCE bucket: other people's comments never touch voice ---
        if mtype == "comment" and author == "audience":
            audience_signals.append({
                "id": item_id, "platform": row.get("platform"),
                "text": row.get("caption") or row.get("transcript") or "",
                "likes": _int(row.get("likes")),
            })
            continue

        # --- media -> text (cached) ---
        media = media_to_text(item_id, mtype, row.get("media_url", ""), use_fal)
        transcript = row.get("transcript") or media["transcript"]

        # --- VISUAL bucket: VLM scene description is style, not prose ---
        if media["visual_desc"]:
            visual_profile.append({
                "id": item_id, "platform": row.get("platform"),
                "visual_desc": media["visual_desc"],
            })

        # --- VOICE-TEXT bucket: the creator's own words only ---
        # overlay text the creator wrote on an image IS his voice -> fold into caption
        caption = row.get("caption") or None
        if media["overlay_text"]:
            caption = ((caption + " ") if caption else "") + media["overlay_text"]

        # pure-image posts with no words contribute only to the visual profile
        if not (transcript or caption or row.get("title")):
            continue

        corpus_items.append({
            "id": item_id,
            "platform": row.get("platform"),
            "title": row.get("title") or None,
            "transcript": transcript or None,
            "caption": caption,
            "hook": row.get("hook") or derive_hook(transcript, caption),
            "published_at": _iso(row.get("published_at", "")),
            "metrics": {
                "views": _int(row.get("views")),
                "likes": _int(row.get("likes")),
                "comments": _int(row.get("comments")),
            },
            "performance_percentile": 0.0,  # filled below
        })

    compute_percentile(corpus_items)
    corpus = {
        "creator": {
            "handle": creator_handle,
            "niche": niche,
            "platforms": sorted({i["platform"] for i in corpus_items if i["platform"]}),
        },
        "items": corpus_items,
    }
    validate(corpus)
    write_outputs(corpus, visual_profile, audience_signals)


def compute_percentile(items: list[dict]) -> None:
    """Engagement-rate rank within THIS creator's catalogue (not raw views)."""
    if not items:
        return
    s = pd.Series([
        (i["metrics"]["likes"] + i["metrics"]["comments"]) / max(i["metrics"]["views"], 1)
        for i in items
    ])
    pct = s.rank(pct=True).round(3)
    for i, p in zip(items, pct):
        i["performance_percentile"] = float(p)


def validate(corpus: dict) -> None:
    assert "creator" in corpus and "items" in corpus, "corpus missing top-level keys"
    n = len(corpus["items"])
    req = {"id", "platform", "hook", "metrics", "performance_percentile"}
    for it in corpus["items"]:
        missing = req - it.keys()
        assert not missing, f"item {it.get('id')} missing {missing}"
    if not (MIN_ITEMS <= n <= MAX_ITEMS):
        print(f"[warn] {n} items — outside {MIN_ITEMS}-{MAX_ITEMS} "
              f"(<{MIN_ITEMS} noisy fingerprint, >{MAX_ITEMS} slow/expensive)")
    top = sum(i["performance_percentile"] >= TOP_QUARTILE for i in corpus["items"])
    print(f"[ok] {n} voice items, {top} above {TOP_QUARTILE} percentile")


def write_outputs(corpus, visual_profile, audience_signals) -> None:
    (DATA / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, indent=2))
    (DATA / "visual_profile.json").write_text(
        json.dumps({"items": visual_profile}, ensure_ascii=False, indent=2))
    (DATA / "audience_signals.json").write_text(
        json.dumps({"items": audience_signals}, ensure_ascii=False, indent=2))
    print(f"[write] corpus={len(corpus['items'])} "
          f"visual={len(visual_profile)} audience={len(audience_signals)} -> data/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-fal", action="store_true",
                    help="skip media->text; use only text already in the sheet")
    args = ap.parse_args()
    main(use_fal=not args.no_fal)
