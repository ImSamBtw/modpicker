"""Deterministic official FuelEconomy.gov import; no inferred part fitment.

The family definitions are data-driven in ``config/vehicle_families.json``.
They identify stable chassis/application families and normalize engine
configuration labels for selectors. They do not claim a factory engine code
or prove that a part fits; those claims remain in source-backed fitment rules.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
URL = "https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip"
FAMILY_CONFIG = ROOT / "config" / "vehicle_families.json"


def _key(value: object) -> str:
    return " ".join(str(value or "").strip().casefold().split())


def _matches_alias(model: str, alias: str) -> bool:
    model_key = _key(model)
    alias_key = _key(alias)
    return model_key == alias_key or model_key.startswith(alias_key + " ")


def _matches_family(row: dict[str, str], family: dict[str, object]) -> bool:
    if _key(row.get("make")) != _key(family.get("make")):
        return False
    year = int(row["year"])
    if year < int(family.get("year_from", 0)) or year > int(family.get("year_to", 9999)):
        return False
    model = _key(row.get("model"))
    excluded = family.get("exclude_model_aliases") or []
    if any(_matches_alias(model, str(alias)) for alias in excluded):
        return False
    aliases = family.get("model_aliases") or []
    return any(_matches_alias(model, str(alias)) for alias in aliases)


def _engine_family(row: dict[str, str], family: dict[str, object]) -> str | None:
    displacement = str(row.get("displ") or "").strip()
    cylinders = str(row.get("cylinders") or "").strip()
    turbo = str(row.get("tCharger") or "").strip().upper()
    for rule in family.get("engine_rules") or []:
        if rule.get("displacement_l") and displacement not in {str(x) for x in rule["displacement_l"]}:
            continue
        if rule.get("cylinders") and cylinders not in {str(x) for x in rule["cylinders"]}:
            continue
        if rule.get("turbo") and turbo not in {str(x).upper() for x in rule["turbo"]}:
            continue
        return str(rule["id"])
    return None


def _body(model: str) -> str:
    text = _key(model)
    if "convertible" in text:
        return "Convertible"
    if "coupe" in text or "mustang" in text or "z3" in text:
        return "Coupe/roadster"
    return "Not specified"


def load_families() -> list[dict[str, object]]:
    rows = json.loads(FAMILY_CONFIG.read_text())
    if not isinstance(rows, list) or not rows:
        raise ValueError("vehicle family configuration is empty")
    return [row for row in rows if isinstance(row, dict) and row.get("id")]


def normalize(rows: list[dict[str, str]], families: list[dict[str, object]] | None = None) -> list[dict[str, object]]:
    families = families or load_families()
    result: list[dict[str, object]] = []
    for raw in rows:
        year = int(raw["year"])
        family = next((candidate for candidate in families if _matches_family(raw, candidate)), None)
        if family is None:
            continue
        family_id = str(family["id"])
        model = str(family.get("display_model") or raw["model"])
        engine_family_id = _engine_family(raw, family)
        source_url = f"https://www.fueleconomy.gov/ws/rest/vehicle/{raw['id']}"
        tags = ["EPA configuration", "Engine code not established"]
        if engine_family_id:
            tags.append(f"EPA configuration family: {engine_family_id}")
        result.append(
            {
                "id": f"epa-{raw['id']}",
                "family_id": family_id,
                "year": year,
                "make": raw["make"],
                "model": model,
                "trim": f"{raw['model']} · {raw['displ'] or 'EV'}L · {raw['trany']}",
                "engine": f"{raw['displ'] or 'EV'}L / {raw['cylinders'] or 'unknown'} cylinders",
                "engine_family_id": engine_family_id,
                "chassis": "Not specified",
                "body": _body(raw["model"]),
                "transmission": raw["trany"],
                "drivetrain": raw["drive"],
                "market": "US",
                "tags": tags,
                "metadata": {
                    "source": "FuelEconomy.gov",
                    "source_url": source_url,
                    "source_id": raw["id"],
                    "source_model": raw["model"],
                    "family_definition_id": family_id,
                    "displacement_l": raw["displ"],
                    "cylinders": raw["cylinders"],
                    "turbo": raw.get("tCharger", ""),
                    "engine_descriptor": raw.get("eng_dscr", ""),
                    "fitment_status": "not_established",
                },
            }
        )
    labels: dict[tuple[str, str, int, str], list[dict[str, object]]] = {}
    for vehicle in result:
        key = (str(vehicle["make"]), str(vehicle["model"]), int(vehicle["year"]), str(vehicle["trim"]))
        labels.setdefault(key, []).append(vehicle)
    for group in labels.values():
        if len(group) > 1:
            for vehicle in group:
                source_id = (vehicle.get("metadata") or {}).get("source_id")
                vehicle["trim"] = f"{vehicle['trim']} · EPA {source_id}"
    ids = [str(vehicle["id"]) for vehicle in result]
    if len(set(ids)) != len(ids):
        raise ValueError("Duplicate EPA IDs")
    if not result:
        raise ValueError("No configured applications found; retaining previous data")
    return sorted(result, key=lambda item: (str(item["make"]), str(item["model"]), int(item["year"]), str(item["id"])))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", type=Path)
    args = parser.parse_args()
    raw = args.archive.read_bytes() if args.archive else urlopen(URL, timeout=45).read()
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        with archive.open("vehicles.csv") as stream:
            records = list(csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig")))
    vehicles = normalize(records)
    target = ROOT / "data" / "reference"
    target.mkdir(exist_ok=True)
    payloads = {
        "epa_vehicles.json": vehicles,
        "epa_import.json": {
            "source_url": URL,
            "documentation_url": "https://www.fueleconomy.gov/feg/ws/index.shtml",
            "retrieved_at": datetime.now(timezone.utc).isoformat(),
            "sha256": hashlib.sha256(raw).hexdigest(),
            "upstream_rows": len(records),
            "imported_rows": len(vehicles),
            "scope": "Configured vehicle families in config/vehicle_families.json",
            "limits": "EPA configurations are not trim, engine-code, production-month or part-fitment evidence.",
        },
    }
    for name, payload in payloads.items():
        temp = target / f"{name}.tmp"
        temp.write_text(json.dumps(payload, indent=2) + "\n")
        temp.replace(target / name)
    print(f"Imported {len(vehicles)} configurations from {len(records)} official records")


if __name__ == "__main__":
    main()
