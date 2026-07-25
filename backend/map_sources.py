"""
Map the scraper's Excel exports to the frozen schemas.

  Single Creator.xlsx  ->  data/corpus.json   (voice axis / fingerprint input)
  Trends.xlsx          ->  data/trends.json   (trend axis input)

This is the SCHEMA mapping only. Real/final data isn't loaded yet, and the
media->text step (Wizper / vision) hasn't run, so `transcript`/`visual` fields
are left null here — Stage 1 (n8n or ingest.py) fills them. See
docs/SCHEMA_MAPPING.md for the column->field tables.

Usage:
    pip install openpyxl
    python backend/map_sources.py \
        --creator "/path/Single Creator.xlsx" \
        --trends  "/path/Trends.xlsx"
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"


def _rows(xlsx: str) -> tuple[list[str], list[dict]]:
    wb = openpyxl.load_workbook(xlsx, data_only=True)
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    hdr = [str(h) if h is not None else "" for h in rows[0]]
    return hdr, [dict(zip(hdr, r)) for r in rows[1:]]


def _int(v) -> int:
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return 0


# --------------------------------------------------------------------------- #
# Single Creator.xlsx  ->  corpus.json
# --------------------------------------------------------------------------- #
def map_creator(xlsx: str) -> dict:
    _, rows = _rows(xlsx)
    items = []
    for r in rows:
        # content_type "short" -> a YouTube video we transcribe via Wizper
        items.append({
            "id": r.get("video_id"),
            "platform": "youtube",
            "title": r.get("title"),
            "transcript": None,              # filled by Wizper on media_url below
            "caption": r.get("description") or None,
            "hook": None,                    # derived from transcript at ingest
            "published_at": r.get("published_at"),
            "metrics": {
                "views": _int(r.get("views")),
                "likes": _int(r.get("likes")),
                "comments": 0,               # not scraped -> 0
            },
            "performance_percentile": 0.0,   # computed at ingest
            # --- carried through for the media->text step, not part of the
            #     fingerprint schema itself ---
            "media_url": r.get("video_url"),
            "media_type": "video",
        })
    handle = rows[0].get("creator") if rows else ""
    return {
        "creator": {
            "handle": handle,
            "niche": "",                     # not in source; set manually
            "platforms": ["youtube"],
        },
        "items": items,
    }


# --------------------------------------------------------------------------- #
# Trends.xlsx  ->  trends.json
# --------------------------------------------------------------------------- #
# Raw scraped trend rows map to *proto* trend_cards. Stage 3's LLM later
# abstracts several rows into higher-level `pattern`s; here we do the 1:1
# field mapping so the schema is populated and inspectable.
_DECAY = {
    "trending_hashtag": "days", "trending_topic": "days",
    "trending_post": "days", "whats_hot": "days",
}


def map_trends(xlsx: str) -> dict:
    _, rows = _rows(xlsx)

    # confidence = min-max normalised metric_value within each metric_name group
    groups: dict[str, list[float]] = {}
    for r in rows:
        groups.setdefault(str(r.get("metric_name")), []).append(float(r.get("metric_value") or 0))
    bounds = {k: (min(v), max(v)) for k, v in groups.items()}

    def confidence(r) -> float:
        lo, hi = bounds[str(r.get("metric_name"))]
        val = float(r.get("metric_value") or 0)
        return round((val - lo) / (hi - lo), 3) if hi > lo else 0.5

    cards = []
    for r in rows:
        cards.append({
            "id": r.get("trend_key"),
            "pattern": r.get("title"),                 # topic/hashtag/post text
            "evidence": [x for x in [r.get("title"), r.get("context"), r.get("url")] if x],
            "observed_on": [r.get("platform")],
            "estimated_decay": _DECAY.get(str(r.get("category")), "weeks"),
            "confidence": confidence(r),
            # --- source detail kept for Stage 3 abstraction ---
            "category": r.get("category"),
            "metric": {"name": r.get("metric_name"), "value": _int(r.get("metric_value"))},
            "author": r.get("author"),
            "has_video": r.get("has_video") == "yes",
            "url": r.get("url"),
            "published_at": r.get("published_at"),
        })
    built_at = max((r.get("scraped_at") for r in rows if r.get("scraped_at")), default=None)
    return {
        "built_at": built_at,
        "niche": "",                                   # not in source; set manually
        "trend_cards": cards,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--creator", required=True)
    ap.add_argument("--trends", required=True)
    args = ap.parse_args()

    DATA.mkdir(exist_ok=True)
    corpus = map_creator(args.creator)
    trends = map_trends(args.trends)
    (DATA / "corpus.json").write_text(json.dumps(corpus, ensure_ascii=False, indent=2))
    (DATA / "trends.json").write_text(json.dumps(trends, ensure_ascii=False, indent=2))
    print(f"corpus.json: {len(corpus['items'])} items (creator={corpus['creator']['handle']})")
    print(f"trends.json: {len(trends['trend_cards'])} trend_cards (built_at={trends['built_at']})")


if __name__ == "__main__":
    main()
