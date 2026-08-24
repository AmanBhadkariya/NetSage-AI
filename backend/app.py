from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from ai_provider import AIProviderError, available_modes
from data_store import dashboard_stats, diagnose_case, get_case, load_cases, load_reviews, save_review


app = FastAPI(title="NetSage AI API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ReviewInput(BaseModel):
    case_id: str
    status: str
    reviewer: str = "Human Reviewer"
    corrected_root_cause: str = ""
    review_notes: str = ""


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/cases")
def cases() -> list[dict]:
    return load_cases()


@app.get("/cases/{case_id}")
def case_detail(case_id: str) -> dict:
    try:
        return get_case(case_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc


@app.get("/settings")
def settings() -> dict:
    return {"diagnosis_modes": available_modes()}


@app.get("/diagnose/{case_id}")
def diagnosis(case_id: str, mode: str = "rules") -> dict:
    try:
        return diagnose_case(case_id, mode=mode)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    except AIProviderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/reviews")
def reviews() -> list[dict]:
    return load_reviews()


@app.post("/reviews")
def review(payload: ReviewInput) -> dict:
    try:
        get_case(payload.case_id)
        return save_review(payload.model_dump())
    except KeyError as exc:
        raise HTTPException(status_code=404, detail="Case not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/dashboard")
def dashboard() -> dict:
    return dashboard_stats()
