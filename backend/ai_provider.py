from __future__ import annotations

import json
import os
import urllib.error
import urllib.request


DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions"


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
            "id": "deepseek",
            "label": "DeepSeek",
            "available": True,
            "requires_key": True,
            "configured": bool(os.getenv("DEEPSEEK_API_KEY")),
            "description": "Prompt-based diagnosis using DeepSeek Chat Completions with a provided key or server environment key.",
        },
    ]


def build_deepseek_diagnosis(
    case: dict,
    rule_findings: list[dict],
    api_key: str | None = None,
) -> dict:
    api_key = (api_key or os.getenv("DEEPSEEK_API_KEY") or "").strip()
    if not api_key:
        raise AIProviderError("A DeepSeek API key is required for DeepSeek diagnosis mode.")

    model = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
    prompt = _prompt_for(case, rule_findings)
    payload = {
        "model": model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are NetSage AI, a Cisco-style lab troubleshooting assistant. "
                    "Return only valid JSON with the requested keys."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "response_format": {"type": "json_object"},
        "stream": False,
    }

    request = urllib.request.Request(
        DEEPSEEK_ENDPOINT,
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
        raise AIProviderError(f"DeepSeek request failed: {detail}") from exc
    except urllib.error.URLError as exc:
        raise AIProviderError(f"DeepSeek request failed: {exc.reason}") from exc

    parsed = _extract_response_json(body)
    return {
        "case_id": case["case_id"],
        "root_cause": parsed["root_cause"],
        "osi_layer": parsed["osi_layer"],
        "concept_tag": parsed["concept_tag"],
        "confidence": parsed["confidence"],
        "evidence": _join_text(parsed["evidence"]),
        "next_command": parsed["next_command"],
        "fix_steps": _join_text(parsed["fix_steps"]),
        "rule_findings": rule_findings,
        "requires_human_review": True,
        "diagnosis_mode": "deepseek",
        "model": model,
    }


def _prompt_for(case: dict, rule_findings: list[dict]) -> str:
    return f"""
You are NetSage AI, a Cisco-style lab troubleshooting assistant. Diagnose only from supplied evidence.
Return only valid JSON with these keys:
root_cause string, osi_layer string, concept_tag string, confidence Low|Medium|High,
evidence array of strings, next_command string, fix_steps array of strings.
A human reviewer must approve or correct the diagnosis.

Case ID: {case["case_id"]}
Symptom: {case["symptom"]}
Topology note: {case["topology_note"]}
Show outputs: {case["show_outputs"]}
Deterministic rule findings: {json.dumps(rule_findings)}
""".strip()


def _extract_response_json(body: dict) -> dict:
    choices = body.get("choices") or []
    if choices:
        content = choices[0].get("message", {}).get("content", "")
        if content:
            return json.loads(content)

    raise AIProviderError("DeepSeek response did not contain JSON message content.")


def _join_text(value: str | list[str]) -> str:
    if isinstance(value, list):
        return " ".join(str(item) for item in value)
    return str(value)
