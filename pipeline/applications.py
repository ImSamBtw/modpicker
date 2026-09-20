"""Reference applications and evidence-backed compatibility expansion.

The vehicle collector discovers model/year records, but it cannot safely infer
engines, body styles, or part fitment.  This module is the small, reviewable
layer that joins public application references to catalog rows.  Every expanded
fitment keeps the rule and source that caused it so the browser and database can
show the same evidence.
"""
from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
REFERENCE = ROOT / "data" / "reference"


def _read(name: str, default: Any) -> Any:
    path = REFERENCE / name
    if not path.exists():
        return deepcopy(default)
    return json.loads(path.read_text())


def _key(value: Any) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def load_applications() -> list[dict[str, Any]]:
    """Load normalized exact applications from the checked-in reference set."""
    rows = _read("vehicle_applications.json", []) + _read("epa_vehicles.json", [])
    out: list[dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict) or not row.get("id"):
            continue
        item = deepcopy(row)
        item["id"] = str(item["id"])
        item["year"] = int(item["year"])
        item.setdefault("trim", "Unspecified")
        item.setdefault("chassis", "Not specified")
        item.setdefault("engine", "Not specified")
        item.setdefault("drivetrain", "Not specified")
        item.setdefault("transmission", "Not specified")
        item.setdefault("tags", [])
        item.setdefault("metadata", {})
        source = item.get("source") or {}
        metadata = {**item.get("metadata", {}), "reference_source": source}
        if source.get("source_urls"):
            metadata.setdefault("source_urls", source["source_urls"])
        item["metadata"] = metadata
        item.pop("source", None)
        # Keep the display tags deterministic and useful to the selectors.
        tags = list(item.get("tags") or [])
        for value in (item.get("chassis"), item.get("engine"), item.get("engine_family_id"), item.get("body")):
            if value and value not in tags and value not in ("Not specified", "Unspecified"):
                tags.append(value)
        item["tags"] = tags
        out.append(item)
    return out


def load_fitment_rules() -> list[dict[str, Any]]:
    """Load explicit part-to-application range rules."""
    rows = _read("fitment_rules.json", [])
    return [deepcopy(x) for x in rows if isinstance(x, dict) and x.get("id")]


def merge_reference_vehicles(existing: list[dict[str, Any]], applications: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Merge exact reference applications into discovered/manual vehicles.

    Existing manual records win on user-facing fields.  Reference provenance is
    retained in metadata so an application never silently loses its source.
    """
    by_id = {str(row.get("id")): deepcopy(row) for row in existing if isinstance(row, dict) and row.get("id")}
    for app in applications:
        ref = deepcopy(app)
        source = (ref.get("metadata") or {}).get("reference_source", {})
        ref_meta = {
            **(ref.get("metadata") or {}),
            "source": (ref.get("metadata") or {}).get("source", "public_reference"),
            "source_urls": source.get("source_urls", []),
            "source_kind": source.get("source_kind", "public_reference"),
            "source_confidence": source.get("source_confidence"),
            "reference_application_id": ref["id"],
        }
        ref["metadata"] = ref_meta
        current = by_id.get(ref["id"])
        if not current:
            by_id[ref["id"]] = ref
            continue
        merged = {**ref, **current}
        merged["metadata"] = {**ref_meta, **(current.get("metadata") or {})}
        merged["tags"] = sorted(set((ref.get("tags") or []) + (current.get("tags") or [])))
        by_id[ref["id"]] = merged
    return list(by_id.values())


def _list_values(selector: dict[str, Any], key: str) -> list[str]:
    values = selector.get(key)
    if values is None:
        return []
    if not isinstance(values, list):
        values = [values]
    return [_key(x) for x in values if str(x or "").strip()]


def application_matches(application: dict[str, Any], selector: dict[str, Any] | None) -> bool:
    """Return whether one exact application satisfies a rule selector."""
    selector = selector or {}
    allowed = {"application_ids", "family_id", "family_ids", "engine_family_id", "engine_family_ids", "make", "model", "chassis", "body", "drivetrain", "transmission", "makes", "models", "chassiss", "bodys", "drivetrains", "transmissions", "year_from", "year_to", "trim_contains", "trim_prefix", "tags_all", "exclude_application_ids"}
    if not selector or set(selector) - allowed:
        raise ValueError("Empty or unsupported application selector")
    app_id = str(application.get("id", ""))
    exact_ids = {str(x) for x in selector.get("application_ids", [])}
    if exact_ids and app_id not in exact_ids:
        return False
    family_id = selector.get("family_id")
    family_ids = {str(x) for x in selector.get("family_ids", [])}
    if family_id and str(application.get("family_id")) != str(family_id):
        return False
    if family_ids and str(application.get("family_id")) not in family_ids:
        return False
    engine_family = selector.get("engine_family_id")
    engine_families = set(_list_values(selector, "engine_family_ids"))
    if engine_family and str(application.get("engine_family_id")) != str(engine_family):
        return False
    if engine_families and _key(application.get("engine_family_id")) not in engine_families:
        return False
    for field in ("make", "model", "chassis", "body", "drivetrain", "transmission"):
        expected = selector.get(field)
        if expected is not None and _key(application.get(field)) != _key(expected):
            return False
    for field in ("make", "model", "chassis", "body", "drivetrain", "transmission"):
        values = _list_values(selector, f"{field}s")
        if values and _key(application.get(field)) not in values:
            return False
    year = int(application.get("year", 0) or 0)
    if selector.get("year_from") is not None and year < int(selector["year_from"]):
        return False
    if selector.get("year_to") is not None and year > int(selector["year_to"]):
        return False
    trim = _key(application.get("trim"))
    if selector.get("trim_contains") and _key(selector["trim_contains"]) not in trim:
        return False
    if selector.get("trim_prefix") and not trim.startswith(_key(selector["trim_prefix"])):
        return False
    tags = {_key(x) for x in application.get("tags", [])}
    required_tags = {_key(x) for x in selector.get("tags_all", [])}
    if required_tags and not required_tags.issubset(tags):
        return False
    excluded_ids = {str(x) for x in selector.get("exclude_application_ids", [])}
    return app_id not in excluded_ids


_STATUS_RANK = {"not_fitment": 0, "unknown": 1, "probable": 2, "verified": 3}


def _fitment_rank(row: dict[str, Any]) -> tuple[int, float, int]:
    status = str(row.get("fitment_status", "unknown"))
    return (_STATUS_RANK.get(status, 1), float(row.get("confidence", 0) or 0), bool(row.get("source_url")))


def expand_fitments(parts: list[dict[str, Any]], applications: list[dict[str, Any]], rules: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """Attach exact and rule-expanded fitments to every catalog part.

    Rules only match rows in the reference application table.  A year range
    therefore cannot create a phantom vehicle or apply to an unrelated engine.
    """
    app_rows = [x for x in applications if isinstance(x, dict) and x.get("id")]
    app_ids = {str(a["id"]) for a in app_rows}
    rules_by_part: dict[str, list[dict[str, Any]]] = {}
    for rule in rules:
        part_ids = rule.get("part_ids") or ([rule.get("part_id")] if rule.get("part_id") else [])
        for part_id in part_ids:
            rules_by_part.setdefault(str(part_id), []).append(rule)
    total_expanded = 0
    matched_rules = 0
    warnings: list[str] = []
    out: list[dict[str, Any]] = []
    for original in parts:
        part = deepcopy(original)
        by_vehicle: dict[str, dict[str, Any]] = {}

        def add_fitment(row: dict[str, Any], source: str) -> None:
            nonlocal total_expanded
            vehicle_id = str(row.get("vehicle_id") or "")
            if not vehicle_id or (source == "rule" and vehicle_id not in app_ids):
                return
            clean = {
                "vehicle_id": vehicle_id,
                "fitment_status": str(row.get("fitment_status") or "unknown"),
                "confidence": max(0, min(1, float(row.get("confidence", row.get("fitment_confidence", 0.5)) or 0.5))),
                "source_url": row.get("source_url") or row.get("fitment_source_url"),
                "source_kind": row.get("source_kind") or row.get("metadata", {}).get("source_kind"),
                "rule_id": row.get("rule_id"),
                "notes": row.get("notes") or row.get("description"),
            }
            if not clean["vehicle_id"]:
                return
            # Collection/category pages cannot prove SKU-level compatibility.
            evidence_url = str(clean.get("source_url") or "")
            if clean["fitment_status"] == "verified" and ("/collections/" in evidence_url or "/c-" in evidence_url or evidence_url.rstrip('/').endswith('BMW-Z3')):
                clean["fitment_status"] = "probable"
                clean["notes"] = (clean.get("notes") or "") + " Category source only; exact SKU fitment requires confirmation."
            old = by_vehicle.get(vehicle_id)
            if old is None or _fitment_rank(clean) > _fitment_rank(old):
                by_vehicle[vehicle_id] = clean
            elif old:
                # Do not combine confidence from a different evidence claim.
                pass
                if not old.get("source_url") and clean.get("source_url"):
                    old["source_url"] = clean["source_url"]

        legacy_id = part.get("vehicle_id")
        if legacy_id:
            add_fitment({
                "vehicle_id": legacy_id,
                "fitment_status": part.get("fitment_status", "unknown"),
                "confidence": part.get("fitment_confidence", 0.5),
                "source_url": part.get("fitment_source_url") or part.get("official_url"),
                "source_kind": "part_record",
                "description": part.get("description"),
            }, "part")
        for fitment in part.get("fitments", []) or []:
            if isinstance(fitment, dict):
                add_fitment(fitment, "part")

        for rule in rules_by_part.get(str(part.get("id")), []):
            matched = [app for app in app_rows if application_matches(app, rule.get("selector"))]
            if not matched:
                warnings.append(f"{rule.get('id')}: selector matched no reference applications")
                continue
            matched_rules += 1
            for app in matched:
                add_fitment({
                    "vehicle_id": app["id"],
                    "fitment_status": rule.get("fitment_status", "probable"),
                    "confidence": rule.get("confidence", part.get("fitment_confidence", 0.5)),
                    "source_url": rule.get("source_url") or ((rule.get("source_urls") or [None])[0]),
                    "source_kind": rule.get("source_kind", "reference_range"),
                    "rule_id": rule.get("id"),
                    "notes": rule.get("notes"),
                }, "rule")
                total_expanded += 1
        fitments = sorted(by_vehicle.values(), key=lambda x: x["vehicle_id"])
        part["fitments"] = fitments
        part["vehicles"] = [x["vehicle_id"] for x in fitments]
        if fitments:
            part.setdefault("vehicle_id", fitments[0]["vehicle_id"])
            part["fitment_summary"] = {
                "application_count": len(fitments),
                "verified_count": sum(x["fitment_status"] == "verified" for x in fitments),
                "probable_count": sum(x["fitment_status"] == "probable" for x in fitments),
                "rule_ids": sorted({x["rule_id"] for x in fitments if x.get("rule_id")}),
            }
        else:
            part["vehicles"] = []
            part["fitment_summary"] = {"application_count": 0, "verified_count": 0, "probable_count": 0, "rule_ids": []}
        out.append(part)
    return out, {
        "rule_count": len(rules),
        "matched_rule_count": matched_rules,
        "expanded_fitment_count": total_expanded,
        "warnings": sorted(set(warnings)),
    }


def resolve_platforms(platforms: list[dict[str, Any]], applications: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Expand platform selectors into exact application IDs for the browser."""
    out = []
    for original in platforms:
        platform = deepcopy(original)
        ids = {str(x) for x in platform.get("vehicle_ids", []) if x}
        selector = platform.get("application_selector")
        if selector:
            ids.update(str(app["id"]) for app in applications if application_matches(app, selector))
        platform["vehicle_ids"] = sorted(ids, key=lambda x: (int(next((a["year"] for a in applications if str(a["id"]) == x), 9999)), x))
        platform["application_count"] = len(platform["vehicle_ids"])
        out.append(platform)
    return out
