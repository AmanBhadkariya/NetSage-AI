from __future__ import annotations

import csv
from collections import Counter
from pathlib import Path

from ai_provider import AIProviderError, build_deepseek_diagnosis
from rule_checker import build_diagnosis, run_rule_checks


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data"
CASES_PATH = DATA_DIR / "cases.csv"
REVIEWS_PATH = DATA_DIR / "human_reviews.csv"

REVIEW_FIELDS = [
    "case_id",
    "status",
    "reviewer",
    "corrected_root_cause",
    "review_notes",
]


def load_cases() -> list[dict]:
    with CASES_PATH.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def get_case(case_id: str) -> dict:
    for case in load_cases():
        if case["case_id"] == case_id:
            return case
    raise KeyError(case_id)


def diagnose_case(case_id: str, mode: str = "rules", deepseek_api_key: str | None = None) -> dict:
    case = get_case(case_id)
    findings = run_rule_checks(case)
    if mode == "deepseek":
        return build_deepseek_diagnosis(case, findings, api_key=deepseek_api_key)
    if mode != "rules":
        raise ValueError("mode must be rules or deepseek")
    return build_diagnosis(case, findings)


def load_reviews() -> list[dict]:
    if not REVIEWS_PATH.exists():
        return []
    with REVIEWS_PATH.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def save_review(review: dict) -> dict:
    normalized = {field: str(review.get(field, "")).strip() for field in REVIEW_FIELDS}
    if normalized["status"] not in {"Accepted", "Edited", "Rejected"}:
        raise ValueError("status must be Accepted, Edited, or Rejected")
    if not normalized["reviewer"]:
        raise ValueError("reviewer is required")
    if not normalized["corrected_root_cause"]:
        raise ValueError("corrected_root_cause is required")
    if normalized["status"] in {"Edited", "Rejected"} and not normalized["review_notes"]:
        raise ValueError("review_notes are required when editing or rejecting a diagnosis")

    reviews = [item for item in load_reviews() if item["case_id"] != normalized["case_id"]]
    reviews.append(normalized)
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with REVIEWS_PATH.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=REVIEW_FIELDS)
        writer.writeheader()
        writer.writerows(reviews)
    return normalized


def dashboard_stats() -> dict:
    cases = load_cases()
    reviews = load_reviews()
    reviewed_ids = {review["case_id"] for review in reviews}
    status_counts = Counter(review["status"] for review in reviews)

    return {
        "total_cases": len(cases),
        "reviewed_cases": len(reviewed_ids),
        "pending_review": len(cases) - len(reviewed_ids),
        "agreement_rate": _agreement_rate(status_counts),
        "by_concept": _counter_rows(Counter(case["concept_tag"] for case in cases)),
        "by_severity": _counter_rows(Counter(case["severity"] for case in cases)),
        "by_osi_layer": _counter_rows(Counter(case["osi_layer"] for case in cases)),
        "review_status": _counter_rows(status_counts),
        "corrected_cases": [
            review for review in reviews if review["status"] in {"Edited", "Rejected"}
        ],
    }


def _counter_rows(counter: Counter) -> list[dict]:
    return [{"name": name, "value": value} for name, value in sorted(counter.items())]


def _agreement_rate(status_counts: Counter) -> float:
    total = sum(status_counts.values())
    if total == 0:
        return 0.0
    return round((status_counts.get("Accepted", 0) / total) * 100, 1)
