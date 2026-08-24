from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


OPENAI_ENDPOINT = "https://api.openai.com/v1/responses"


class AIProviderError(RuntimeError):
    pass


def available_modes() -> list[dict]:
    return [
        {
            "id": "rules",
            "label": "Rules",
            "available": True,
            "description": "Deterministic diagnosis using the local rule checker and known lab answer.",
        },
        {
            "id": "openai",
            "label": "OpenAI",
            "available": bool(os.getenv("OPENAI_API_KEY")),
            "description": "Prompt-based diagnosis using OpenAI Responses API when OPENAI_API_KEY is configured.",
        },
    ]


def build_openai_diagnosis(case: dict, rule_findings: list[dict]) -> dict:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AIProviderError("OPENAI_API_KEY is required for OpenAI diagnosis mode.")

    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
    prompt = _prompt_for(case, rule_findings)
    payload = {
        "model": model,
        "input": prompt,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "netsage_diagnosis",
                "strict": True,
                "schema": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": [
                        "root_cause",
                        "osi_layer",
                        "concept_tag",
                        "confidence",
                        "evidence",
                        "next_command",
                        "fix_steps",
                    ],
                    "properties": {
                        "root_cause": {"type": "string"},
                        "osi_layer": {"type": "string"},
                        "concept_tag": {"type": "string"},
                        "confidence": {"type": "string", "enum": ["Low", "Medium", "High"]},
                        "evidence": {"type": "array", "items": {"type": "string"}},
                        "next_command": {"type": "string"},
                        "fix_steps": {"type": "array", "items": {"type": "string"}},
                    },
                },
            }
        },
    }

    request = urllib.request.Request(
        OPENAI_ENDPOINT,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")
        raise AIProviderError(f"OpenAI request failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise AIProviderError(f"OpenAI request failed: {exc.reason}") from exc

    parsed = _extract_response_json(body)
    return {
        "case_id": case["case_id"],
        "root_cause": parsed["root_cause"],
        "osi_layer": parsed["osi_layer"],
        "concept_tag": parsed["concept_tag"],
        "confidence": parsed["confidence"],
        "evidence": " ".join(parsed["evidence"]),
        "next_command": parsed["next_command"],
        "fix_steps": " ".join(parsed["fix_steps"]),
        "rule_findings": rule_findings,
        "requires_human_review": True,
        "diagnosis_mode": "openai",
        "model": model,
    }


def _prompt_for(case: dict, rule_findings: list[dict]) -> str:
    return f"""
You are NetSage AI, a Cisco-style lab troubleshooting assistant. Diagnose only from supplied evidence.
Return only JSON matching the requested schema. A human reviewer must approve or correct the diagnosis.

Case ID: {case["case_id"]}
Symptom: {case["symptom"]}
Topology note: {case["topology_note"]}
Show outputs: {case["show_outputs"]}
Deterministic rule findings: {json.dumps(rule_findings)}
""".strip()


def _extract_response_json(body: dict) -> dict:
    if "output_text" in body:
        return json.loads(body["output_text"])

    for item in body.get("output", []):
        for content in item.get("content", []):
            if content.get("type") == "output_text":
                return json.loads(content.get("text", "{}"))

    raise AIProviderError("OpenAI response did not contain JSON output text.")
