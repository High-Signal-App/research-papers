"""Regression tests for privacy-safe, non-blocking activation analytics."""

import queue

from researchpapers import activation


def test_search_outcome_emits_bucket_only(monkeypatch):
    emitted = []
    monkeypatch.setattr(
        activation,
        "_emit",
        lambda event, properties: emitted.append((event, properties)),
    )

    activation.track_search_outcome(result_count=17, source="semantic")

    assert emitted == [
        (
            "search_outcome",
            {"surface": "semantic", "result_count_bucket": "6-20"},
        )
    ]


def test_emit_without_configured_key_is_a_noop(monkeypatch):
    events = queue.Queue()
    monkeypatch.delenv("FOUNDRY_POSTHOG_KEY", raising=False)
    monkeypatch.setattr(activation, "_EVENT_QUEUE", events)

    activation._emit("search_outcome", {"result_count_bucket": "zero"})

    assert events.empty()


def test_emit_queues_without_network_work_in_caller(monkeypatch):
    events = queue.Queue()
    monkeypatch.setenv("FOUNDRY_POSTHOG_KEY", "test-key")
    monkeypatch.setattr(activation, "_EVENT_QUEUE", events)
    monkeypatch.setattr(activation, "_worker_started", True)

    activation._emit("result_inspection", {"surface": "paper_detail"})

    assert events.get_nowait() == (
        "result_inspection",
        {"surface": "paper_detail"},
        "test-key",
    )
