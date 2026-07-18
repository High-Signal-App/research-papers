# ADR-003 — MLX (Qwen2.5-3B-4bit) for premium tagging

**Date:** 2026-05-30
**Status:** Accepted

## Context

Tags from spaCy's POS-only noun-chunk extractor are syntactically valid but
semantically coarse ("language models", "deep learning"). A subset of
high-citation papers warrants richer tags (specific method names, dataset names,
TLDRs). The machine is an M1 Pro — Apple Silicon with a unified memory
architecture.

## Decision

`mlx-community/Qwen2.5-3B-Instruct-4bit` via the `mlx-lm` Python package,
running entirely on-device using the MLX framework. Applied to a "premium"
subset defined by citation-count thresholds (≥100 citations, or recent papers
with ≥20–50 citations).

## Rationale

- MLX runs quantised models directly on Apple Silicon's Neural Engine / GPU with
  unified memory. No PCIe bandwidth bottleneck, no CUDA required.
- 4-bit quantisation of a 3B-param model fits in ~2 GB of GPU-accessible unified
  memory, leaving headroom for the OS and the ClickHouse process.
- "Grouped prompt" batching (4 papers per LLM call): same model load, same
  forward-pass cost, ~4× effective throughput vs single-paper prompts.
- Writes directly to ClickHouse `paper_tags` (tagger `mlx_qwen3b_v3`); killed
  runs lose at most one batch (50 groups ≈ 200 papers) via flush-every-50-groups
  pattern.

## Alternatives considered

- OpenAI API: cost, latency, privacy, no offline use.
- Ollama + server-mode MLX (`llm_tag.py`): HTTP round-trip overhead, MLX server
  ignores strict JSON schema (documented in `llm_tag.py` comment: "MLX server
  does not honor strict json_schema; use json_object mode").
- Qwen2.5-1.5B-4bit: 30% faster but 3× skip rate (documented in `mlx_tag_v3.py`
  comment: "Empirically the 1.5B handles short academic abstracts fine, just
  with slightly more uniform/less detailed tags").

## Trade-offs

- Cold-start: `load()` call takes several seconds the first time; model is kept
  resident for the duration of a sharded run.
- RAM throttle: MLX holds the model in unified memory; `_ram_throttle()`
  pauses the loop when free RAM drops below 3 GB so other processes (e.g. IDE,
  browser) stay responsive.
- Sharding: the CLI supports `--shards N` to partition by
  `cityHash64(paper_id) % N`, allowing parallel runs on the same or different
  machines without coordination.

## References

- [Learnings — MLX inference](../../knowledge/learnings.md#mlx-inference)
- [Retro: RAM-aware pipeline for 16 GB M1](../../archive/retros/2026-06-13-ram-aware-pipeline.md)
