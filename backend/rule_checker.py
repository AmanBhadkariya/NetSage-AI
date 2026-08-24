from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


@dataclass(frozen=True)
class RuleFinding:
    check_id: str
    title: str
    severity: str
    evidence: str
    recommendation: str


CHECKS = {
    "duplicate_ip": {
        "title": "Duplicate IP address",
        "recommendation": "Assign unique addresses and clear stale DHCP bindings before retesting.",
    },
    "wrong_mask": {
        "title": "Incorrect subnet mask",
        "recommendation": "Correct the host or interface mask so peers are in the intended subnet.",
    },
    "gateway_mismatch": {
        "title": "Default gateway mismatch",
        "recommendation": "Set the client default gateway to the SVI or router interface for its VLAN.",
    },
    "interface_down": {
        "title": "Interface is down",
        "recommendation": "Enable the interface and verify cabling, speed, duplex, and link state.",
    },
    "missing_vlan": {
        "title": "Missing VLAN",
        "recommendation": "Create the VLAN and assign the correct access or trunk ports.",
    },
    "missing_route": {
        "title": "Missing route",
        "recommendation": "Add the connected, static, or dynamic route needed for return traffic.",
    },
    "dhcp_pool": {
        "title": "DHCP pool mismatch",
        "recommendation": "Align the DHCP network, default router, excluded addresses, and pool scope.",
    },
    "dns_failure": {
        "title": "DNS resolution failure",
        "recommendation": "Fix the DNS server address or zone record, then test by name and by IP.",
    },
    "acl_block": {
        "title": "ACL blocks expected traffic",
        "recommendation": "Adjust ACL order or permit statements and confirm the ACL is applied correctly.",
    },
    "nat_missing": {
        "title": "NAT translation missing",
        "recommendation": "Configure inside/outside interfaces and a matching NAT rule for the source network.",
    },
    "wireless_isolation": {
        "title": "Wireless segmentation issue",
        "recommendation": "Verify SSID-to-VLAN mapping, guest isolation, and wireless ACL policy.",
    },
    "trunk_vlan": {
        "title": "Trunk VLAN not allowed",
        "recommendation": "Allow the required VLAN on the trunk and verify native VLAN consistency.",
    },
}


def _contains_any(text: str, needles: Iterable[str]) -> bool:
    lowered = text.lower()
    return any(needle in lowered for needle in needles)


def run_rule_checks(case: dict) -> list[dict]:
    """Return deterministic findings based on case metadata and show-output evidence."""
    text = " ".join(
        str(case.get(field, ""))
        for field in ("symptom", "topology_note", "show_outputs", "expected_fault", "concept_tag")
    )
    findings: list[RuleFinding] = []

    rule_map = [
        ("duplicate_ip", ("duplicate address", "ip conflict", "duplicate ip", "%duplicate")),
        ("wrong_mask", ("wrong mask", "incorrect mask", "/24 configured as /25", "subnet mask")),
        ("gateway_mismatch", ("gateway mismatch", "wrong default gateway", "default gateway unreachable")),
        ("interface_down", ("administratively down", "line protocol is down", "status down", "shutdown")),
        ("missing_vlan", ("vlan missing", "vlan not found", "inactive vlan", "access vlan does not exist")),
        ("missing_route", ("gateway of last resort is not set", "no route", "missing route", "network not in table")),
        ("dhcp_pool", ("dhcp pool", "excluded-address", "default-router", "apipa", "169.254")),
        ("dns_failure", ("dns", "server can't find", "unknown host", "name resolution")),
        ("acl_block", ("access-list", "deny", "implicit deny", "matches deny")),
        ("nat_missing", ("nat", "translations empty", "no ip nat", "inside source")),
        ("wireless_isolation", ("guest", "ssid", "wireless", "wlan")),
        ("trunk_vlan", ("trunk", "allowed vlans", "not allowed on trunk", "native vlan mismatch")),
    ]

    for check_id, needles in rule_map:
        if _contains_any(text, needles):
            metadata = CHECKS[check_id]
            findings.append(
                RuleFinding(
                    check_id=check_id,
                    title=metadata["title"],
                    severity=case.get("severity", "Medium"),
                    evidence=_evidence_for(case, needles),
                    recommendation=metadata["recommendation"],
                )
            )

    if not findings:
        findings.append(
            RuleFinding(
                check_id="manual_review",
                title="Needs manual correlation",
                severity=case.get("severity", "Medium"),
                evidence="No deterministic rule matched strongly enough.",
                recommendation="Compare the symptom with routing, switching, addressing, and policy evidence.",
            )
        )

    return [finding.__dict__ for finding in findings]


def build_diagnosis(case: dict, findings: list[dict]) -> dict:
    primary = findings[0]
    evidence = _sentence(case.get("show_outputs", "")) or primary["evidence"]
    confidence = "High" if primary["check_id"] != "manual_review" else "Medium"

    return {
        "case_id": case["case_id"],
        "root_cause": case["expected_fault"],
        "osi_layer": case["osi_layer"],
        "concept_tag": case["concept_tag"],
        "confidence": confidence,
        "evidence": evidence,
        "next_command": case["next_command"],
        "fix_steps": case["fix_steps"],
        "rule_findings": findings,
        "requires_human_review": True,
        "diagnosis_mode": "rules",
        "model": "deterministic-rule-checker",
    }


def _evidence_for(case: dict, needles: Iterable[str]) -> str:
    outputs = case.get("show_outputs", "")
    cleaned = " ".join(outputs.split())
    if _contains_any(cleaned, needles):
        return cleaned[:260]
    return _sentence(cleaned) or case.get("symptom", "Case evidence requires review.")


def _sentence(text: str) -> str:
    cleaned = " ".join(str(text).split())
    if not cleaned:
        return ""
    return cleaned[:220]
