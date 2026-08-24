# NetSage AI

AI-assisted troubleshooting helper for Cisco-style Packet Tracer lab problems with deterministic checks and required human review.

## Stack

- Frontend: React + Vite + JavaScript
- Backend: FastAPI + Python
- Data: CSV files committed in `data/`
- Charts: Recharts

## Project Layout

```text
backend/
  app.py              FastAPI application
  data_store.py       CSV loading and review persistence
  rule_checker.py     Deterministic network troubleshooting checks
data/
  cases.csv           30 troubleshooting cases
  human_reviews.csv   Human review log
frontend/
  src/                React application
prompts/
  diagnose_prompt.md  AI diagnosis prompt template
```

## Run Locally

Backend:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Frontend:

```powershell
cd frontend
pnpm install
pnpm dev
```

Open the frontend URL shown by Vite. The app expects the API at `http://localhost:8000` by default.

If port 8000 is blocked, run the backend on another local port:

```powershell
uvicorn app:app --reload --port 8010
```

Then run the frontend with the matching API URL:

```powershell
$env:VITE_API_BASE_URL="http://localhost:8010"
pnpm dev
```

## Delivered Capabilities

- Browse 30 lab troubleshooting cases across VLAN, DHCP, DNS, routing, ACL, NAT, wireless, interface, gateway, mask, and trunking issues.
- Run deterministic checks for common configuration mistakes.
- View an evidence-backed diagnosis draft.
- Require human review before a diagnosis is counted as final.
- Track accepted, edited, and rejected AI outputs.
- Dashboard charts summarize issue type, severity, OSI layer, and review agreement.
