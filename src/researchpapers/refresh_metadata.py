"""Refresh paper metadata from OpenAlex + arXiv for known-bad records.

Targets: top-cited papers (where wrong title/count is most visible),
plus arxiv 'Attention Is All You Need' style underaccounts.

Strategy:
  1. For each top-N arxiv paper by citation_count, GET arxiv API for canonical
     title (overrides OpenAlex when they disagree).
  2. For each top-N paper by current cited_by_count, refresh from OpenAlex
     (cited_by_count, authorships including author_id, year).
  3. Write to a paper_metadata_v2 table (paper_id, title, citation_count,
     authors_with_ids, refreshed_at). Astro/API can JOIN against it.

This is an overlay table, similar to the effective_date strategy — avoids
touching the partition-keyed papers table.
"""

from __future__ import annotations

import json
import logging
import time
from typing import Iterable

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from researchpapers.ch_db import connect as ch_connect

log = logging.getLogger("researchpapers.refresh_metadata")

ARXIV_API = "https://export.arxiv.org/api/query"
OPENALEX_WORKS = "https://api.openalex.org/works"
MAILTO = "anonymous@example.com"


def _ensure_metadata_table() -> None:
    with ch_connect() as ch:
        ch.command("""
            CREATE TABLE IF NOT EXISTS paper_metadata_v2 (
              paper_id String,
              title String,
              citation_count UInt32,
              authors Array(Tuple(name String, openalex_id String)),
              refreshed_at DateTime DEFAULT now()
            )
            ENGINE = ReplacingMergeTree(refreshed_at)
            ORDER BY paper_id
        """)


@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=1, max=10),
    retry=retry_if_exception_type((httpx.HTTPError,)),
)
def _arxiv_titles_batch(client: httpx.Client, arxiv_ids: list[str]) -> dict[str, str]:
    """Batch fetch titles from arXiv API via feedparser (proper Atom XML)."""
    import re
    import feedparser
    out: dict[str, str] = {}
    if not arxiv_ids:
        return out
    resp = client.get(ARXIV_API, params={
        "id_list": ",".join(arxiv_ids),
        "max_results": len(arxiv_ids),
    })
    resp.raise_for_status()
    feed = feedparser.parse(resp.text)
    for entry in feed.entries:
        entry_id = entry.get("id", "")
        # entry.id is like 'http://arxiv.org/abs/1810.04805v2'
        m = re.search(r"arxiv\.org/abs/([0-9a-zA-Z.\-/]+?)(?:v\d+)?$", entry_id)
        if not m:
            continue
        aid = m.group(1)
        title = " ".join((entry.get("title") or "").split())
        if title:
            out[aid] = title
    return out


@retry(
    stop=stop_after_attempt(5),
    wait=wait_exponential(multiplier=2, min=2, max=30),
    retry=retry_if_exception_type((httpx.HTTPError,)),
)
def _openalex_batch(client: httpx.Client, short_ids: list[str]) -> dict:
    resp = client.get(
        OPENALEX_WORKS,
        params={
            "filter": f"ids.openalex:{'|'.join(short_ids)}",
            "per-page": len(short_ids),
            "select": "id,title,cited_by_count,authorships",
        },
    )
    resp.raise_for_status()
    return resp.json() or {}


def refresh_top_papers(limit: int = 1000, batch_size: int = 50) -> dict:
    """Refresh title/citation_count/authors for the top-N most-cited arxiv papers."""
    _ensure_metadata_table()

    with ch_connect() as ch:
        rows = ch.query(
            """
            SELECT paper_id, arxiv_id, openalex_id, title, citation_count
            FROM papers FINAL
            WHERE source='arxiv' AND length(openalex_id) > 0
            ORDER BY citation_count DESC
            LIMIT %(lim)s
            """,
            parameters={"lim": limit},
        ).result_rows
    log.info("refreshing %d papers", len(rows))

    client = httpx.Client(
        timeout=30.0,
        headers={"User-Agent": f"researchpapers/0.2 ({MAILTO})"},
        params={"mailto": MAILTO},
    )

    counters = {"refreshed": 0, "title_corrected": 0, "citation_changed": 0, "authors_disambiguated": 0}
    t0 = time.monotonic()

    # Pre-build openalex_id → row map
    oa_to_row = {r[2].rsplit("/", 1)[-1]: r for r in rows}

    # OpenAlex batch fetch
    short_ids = list(oa_to_row.keys())
    updates = []
    for i in range(0, len(short_ids), batch_size):
        chunk = short_ids[i : i + batch_size]
        body = _openalex_batch(client, chunk)
        for w in body.get("results", []):
            oa_url = w.get("id", "")
            oa_short = oa_url.rsplit("/", 1)[-1]
            row = oa_to_row.get(oa_short)
            if not row:
                continue
            paper_id, arxiv_id, _, old_title, old_cites = row
            new_title = (w.get("title") or "").strip()
            new_cites = int(w.get("cited_by_count") or 0)
            authorships = w.get("authorships") or []
            authors_with_ids = [
                (
                    (a.get("author", {}).get("display_name") or "").strip(),
                    (a.get("author", {}).get("id") or "").rsplit("/", 1)[-1] or "",
                )
                for a in authorships
            ]
            # Only count "disambiguated" if we actually got at least one author with an OpenAlex ID
            if any(name and aid for name, aid in authors_with_ids):
                counters["authors_disambiguated"] += 1

            if old_title != new_title:
                counters["title_corrected"] += 1
            if old_cites != new_cites:
                counters["citation_changed"] += 1

            updates.append([paper_id, new_title or old_title, new_cites, authors_with_ids])
            counters["refreshed"] += 1
        if counters["refreshed"] % 200 < batch_size:
            elapsed = time.monotonic() - t0
            log.info("progress: %d refreshed (%.1fs elapsed)", counters["refreshed"], elapsed)

    # Now override titles with arXiv API (authoritative). OpenAlex sometimes
    # has wrong titles (e.g. BERT's record shows "AI-Assisted Pipeline...").
    log.info("fetching authoritative titles from arXiv API for %d papers", len(updates))
    arxiv_id_by_paper_id = {paper_id: paper_id.replace("arxiv:", "") for paper_id, _, _, _ in updates}
    paper_id_by_arxiv_id = {a: p for p, a in arxiv_id_by_paper_id.items()}

    arxiv_titles: dict[str, str] = {}
    all_aids = list(paper_id_by_arxiv_id.keys())
    # arXiv API limit: 100 ids per request, recommend 3s between requests
    for i in range(0, len(all_aids), 80):
        chunk = all_aids[i : i + 80]
        try:
            arxiv_titles.update(_arxiv_titles_batch(client, chunk))
        except Exception as e:  # noqa: BLE001
            log.warning("arxiv batch fetch failed: %s", e)
        time.sleep(3.5)  # be polite

    log.info("fetched %d/%d arxiv titles", len(arxiv_titles), len(all_aids))

    title_overrides = 0
    final_updates = []
    for paper_id, ol_title, cites, authors in updates:
        aid = arxiv_id_by_paper_id[paper_id]
        arxiv_title = arxiv_titles.get(aid)
        final_title = arxiv_title if arxiv_title else ol_title
        if arxiv_title and arxiv_title != ol_title:
            title_overrides += 1
        final_updates.append([paper_id, final_title, cites, authors])
    counters["arxiv_title_overrides"] = title_overrides

    if final_updates:
        with ch_connect() as ch:
            ch.insert(
                "paper_metadata_v2",
                final_updates,
                column_names=["paper_id", "title", "citation_count", "authors"],
            )
    counters["elapsed_seconds"] = round(time.monotonic() - t0, 2)
    return counters
