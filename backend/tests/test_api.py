from __future__ import annotations

from fastapi.testclient import TestClient

from app import app


client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_cases_endpoint_returns_dataset():
    response = client.get("/cases")

    assert response.status_code == 200
    assert len(response.json()) == 30


def test_diagnosis_endpoint_supports_rules_mode():
    response = client.get("/diagnose/NS-001?mode=rules")

    assert response.status_code == 200
    body = response.json()
    assert body["case_id"] == "NS-001"
    assert body["diagnosis_mode"] == "rules"
    assert body["requires_human_review"] is True


def test_openai_mode_requires_api_key(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = client.get("/diagnose/NS-001?mode=openai")

    assert response.status_code == 400
    assert "OPENAI_API_KEY" in response.json()["detail"]


def test_settings_reports_diagnosis_modes():
    response = client.get("/settings")

    assert response.status_code == 200
    modes = response.json()["diagnosis_modes"]
    assert {mode["id"] for mode in modes} == {"rules", "openai"}
