"""Bounded official NHTSA vehicle discovery with exact make/type validation.

vPIC's make-name endpoint performs partial-name matching, so a request for
``Ford`` can also return manufacturers such as ``CRANFORD RADIATOR INC.``.
Never publish those raw matches.  We validate the returned make against the
configured canonical make and constrain discovery to passenger cars.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from .base import BaseCollector


def _key(value):
    return " ".join(str(value or "").strip().casefold().split())


def _is_nhtsa(row):
    return (row.get("metadata") or {}).get("source") == "NHTSA vPIC"


def _validated_existing(row, allowed_makes, vehicle_type):
    """Keep curated/reference rows and only NHTSA rows produced by this gate."""
    if not _is_nhtsa(row):
        return True
    metadata = row.get("metadata") or {}
    requested = metadata.get("requested_make")
    if not requested or _key(requested) not in allowed_makes:
        return False
    if _key(row.get("make")) != _key(requested):
        return False
    return _key(metadata.get("vehicle_type")) == _key(vehicle_type)


class VehicleCollector(BaseCollector):
    name = "vehicles"

    def run(self, existing, state):
        cfg = json.loads(Path("config/vehicle_discovery.json").read_text())
        makes = [str(make).strip() for make in cfg.get("makes", []) if str(make).strip()]
        years = [int(year) for year in cfg.get("years", [])]
        vehicle_type = str(cfg.get("vehicle_type") or "Passenger Car").strip()
        allowed_makes = {_key(make): make for make in makes}
        jobs = [(make, year) for make in makes for year in years]

        rows = {
            row["id"]: row
            for row in existing
            if row.get("id") and _validated_existing(row, allowed_makes, vehicle_type)
        }
        pruned = len(existing) - len(rows)
        valid_nhtsa = sum(1 for row in rows.values() if _is_nhtsa(row))
        bootstrap = valid_nhtsa == 0
        configured_budget = int(cfg.get("requests_per_run", 12))
        bootstrap_budget = int(cfg.get("bootstrap_requests", len(jobs) or configured_budget))
        budget = min(len(jobs), bootstrap_budget if bootstrap else configured_budget)
        cursor = int(state.get("cursor", 0)) % max(1, len(jobs))

        warnings = []
        checked = 0
        rejected_make_mismatch = 0
        added = 0
        for i in range(budget):
            make, year = jobs[(cursor + i) % len(jobs)]
            make_path = quote(make, safe="")
            type_path = quote(vehicle_type, safe="")
            url = (
                "https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/"
                f"make/{make_path}/modelyear/{year}/vehicletype/{type_path}?format=json"
            )
            try:
                payload = self.get(url).json()
                for item in payload.get("Results", []):
                    # The endpoint is deliberately treated as untrusted for make identity.
                    if _key(item.get("Make_Name")) != _key(make):
                        rejected_make_mismatch += 1
                        continue
                    model = str(item.get("Model_Name") or "").strip()
                    if not model:
                        continue
                    key = f"nhtsa-{year}-{item['Make_ID']}-{item['Model_ID']}"
                    rows[key] = {
                        "id": key,
                        "year": year,
                        "make": allowed_makes[_key(make)],
                        "model": model,
                        "trim": "Unspecified",
                        "chassis": "Not specified",
                        "engine": "Not specified",
                        "tags": ["Passenger-car model record · fitment not established"],
                        "metadata": {
                            "source": "NHTSA vPIC",
                            "source_url": url,
                            "requested_make": allowed_makes[_key(make)],
                            "vehicle_type": vehicle_type,
                            "make_id": item.get("Make_ID"),
                            "model_id": item.get("Model_ID"),
                            "retrieved_at": datetime.now(timezone.utc).isoformat(),
                        },
                    }
                    added += 1
                checked += 1
            except Exception as exc:
                warnings.append(f"{make} {year}: {type(exc).__name__}")

        next_cursor = (cursor + budget) % max(1, len(jobs))
        ordered = sorted(
            rows.values(),
            key=lambda row: (_key(row.get("make")), _key(row.get("model")), int(row.get("year", 0)), str(row.get("id"))),
        )
        return ordered, {"cursor": next_cursor}, {
            "enabled": True,
            "requests": checked,
            "vehicle_count": len(ordered),
            "passenger_car_only": True,
            "bootstrap": bootstrap,
            "pruned_invalid_nhtsa": pruned,
            "rejected_make_mismatch": rejected_make_mismatch,
            "rows_seen": added,
            "warnings": warnings,
        }
