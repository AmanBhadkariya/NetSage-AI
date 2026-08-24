from __future__ import annotations

import csv
from pathlib import Path

import pytest

import data_store
from data_store import dashboard_stats, diagnose_case, load_cases, save_review


def test_cases_csv_has_required_coverage():
    rows = load_cases()
    required_fields = {
        "case_id",
        "symptom",
        "topology_note",
        "show_outputs",
        "expected_fault",
        "osi_layer",
        "concept_tag",
        "severity",
        "next_command",
        "fix_steps",
    }

    assert len(rows) == 30
    assert required_fields <= set(rows[0])
    assert all(row["case_id"].startswith("NS-") for row in rows)
    assert len({row["case_id"] for row in rows}) == 30
    assert {"VLAN", "DHCP", "DNS", "Routing", "ACL", "NAT", "Wireless"} <= {
        row["concept_tag"] for row in rows
    }


def test_rules_diagnosis_is_review_safe():
    diagnosis = diagnose_case("NS-008")

    assert diagnosis["diagnosis_mode"] == "rules"
    assert diagnosis["requires_human_review"] is True
    assert diagnosis["confidence"] == "High"
    assert "10.20.30.10" in diagnosis["evidence"]
    assert diagnosis["rule_findings"]


def test_unknown_diagnosis_mode_is_rejected():
    with pytest.raises(ValueError, match="mode must be rules or openai"):
        diagnose_case("NS-001", mode="experimental")


def test_dashboard_counts_reviews():
    stats = dashboard_stats()

    assert stats["total_cases"] == 30
    assert stats["reviewed_cases"] >= 5
    assert stats["pending_review"] == stats["total_cases"] - stats["reviewed_cases"]
    assert stats["agreement_rate"] > 0


def test_save_review_validates_corrected_cases(tmp_path, monkeypatch):
    reviews_path = tmp_path / "human_reviews.csv"
    monkeypatch.setattr(data_store, "REVIEWS_PATH", reviews_path)

    with pytest.raises(ValueError, match="review_notes are required"):
        save_review(
            {
                "case_id": "NS-001",
                "status": "Edited",
                "reviewer": "QA",
                "corrected_root_cause": "Corrected diagnosis",
                "review_notes": "",
            }
        )

    saved = save_review(
        {
            "case_id": "NS-001",
            "status": "Edited",
            "reviewer": "QA",
            "corrected_root_cause": "Corrected diagnosis",
            "review_notes": "Evidence supports the correction.",
        }
    )

    assert saved["status"] == "Edited"
    with reviews_path.open(newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1
