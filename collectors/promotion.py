"""Promote identity-checked product pages without inventing fitment."""
from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from bs4 import BeautifulSoup

from .catalog_discovery import scope_from_candidate
from .web_product import WebProductCollector
from pipeline.models import now_iso, stable_id

CATEGORY = [
    ("Suspension", r"coilover|shock|spring|sway bar|damper|control arm"),
    ("Brakes", r"brake|rotor|caliper|master cylinder"),
    ("Cooling", r"radiator|coolant|water pump|thermostat|oil cooler"),
    ("Intake", r"intake|air box|airbox|air filter|inlet"),
    ("Exhaust", r"exhaust|header|muffler|cat.?back|downpipe"),
    ("Drivetrain", r"clutch|flywheel|differential|engine mount|trans mount|shifter"),
    ("Chassis", r"brace|bushing|roll bar|strut bar|chassis"),
    ("Wheels", r"wheel|lug nut|spacer"),
    ("Tuning", r"tune|tuner|accessport|calibration"),
    ("Maintenance", r"filter|gasket|seal|hose|service kit|spark plug|coil"),
]


def product_sku(obj):
    offers = obj.get("offers") or []
    offers = offers if isinstance(offers, list) else [offers]
    # A single offer SKU is unambiguous; multiple variants require a separate mapping.
    return obj.get("mpn") or obj.get("sku") or (offers[0].get("sku") if len(offers) == 1 else None)


def product_matches(obj, url, expected_mpn=None):
    ident = str(product_sku(obj) or "").strip()
    if not ident or not obj.get("name"):
        return False
    if expected_mpn and re.sub(r"\W", "", ident).lower() != re.sub(r"\W", "", str(expected_mpn)).lower():
        return False
    product_url = obj.get("url") or str(obj.get("@id", "")).split("#")[0]
    if product_url and urlparse(product_url).path.rstrip("/") != urlparse(url).path.rstrip("/"):
        return False
    return True


def _scope_key(candidate, scope):
    families = []
    if scope.get("fitment_family_id"):
        families.append(str(scope["fitment_family_id"]))
    families.extend(str(x) for x in scope.get("fitment_family_ids", []) if x)
    return candidate.get("vehicle_id") or "|".join(sorted(families)) or candidate.get("source_url") or "unscoped"


class PromotionCollector(WebProductCollector):
    def run(self, candidates, parts, state, max_promotions=24):
        known = {
            (urlparse(p.get("official_url", "")).hostname, urlparse(p.get("official_url", "")).path.rstrip("/"))
            for p in parts
            if p.get("official_url")
        }
        allowed = {
            x["domain"]
            for x in json.loads(Path("config/product_domains.json").read_text())
            if x.get("allow_scrape")
        }
        todo = [
            candidate
            for candidate in candidates
            if (urlparse(candidate["url"]).hostname, urlparse(candidate["url"]).path.rstrip("/")) not in known
        ]
        # Rotate by last attempt so an invalid product page cannot starve the queue.
        todo.sort(key=lambda candidate: state.get(candidate["id"], ""))
        promoted = []
        warnings = []
        attempted = min(max(1, int(max_promotions)), len(todo))
        for candidate in todo[:attempted]:
            state[candidate["id"]] = now_iso()
            url = candidate["url"]
            host = (urlparse(url).hostname or "").removeprefix("www.")
            if host not in allowed:
                continue
            if not self.allowed(url):
                warnings.append(f"robots denied/unavailable: {url}")
                continue
            try:
                soup = BeautifulSoup(self.get(url).text, "html.parser")
                products = []
                for node in soup.select('script[type="application/ld+json"]'):
                    try:
                        products.extend(self.products(json.loads(node.string or "{}")))
                    except (ValueError, TypeError):
                        continue
                matches = [product for product in products if product_matches(product, url)]
                if len(matches) != 1:
                    continue
                product = matches[0]
                brand = product.get("brand") or product.get("Brand") or {}
                brand = brand.get("name") if isinstance(brand, dict) else brand
                if not brand:
                    continue
                title = str(product["name"])
                description = BeautifulSoup(str(product.get("description") or ""), "html.parser").get_text(" ", strip=True)[:4000]
                scope, compatible = scope_from_candidate(candidate, f"{title} {description}")
                if not compatible:
                    # Product-page evidence contradicts the configured generation.
                    continue
                category = next((cat for cat, pattern in CATEGORY if re.search(pattern, title, re.I)), "Other")
                price, currency, stock = self.offer_data(product)
                sku = str(product_sku(product))
                part = {
                    "id": "auto-" + stable_id(str(brand), sku, str(_scope_key(candidate, scope))),
                    "brand": str(brand),
                    "name": title,
                    "category": category,
                    "manufacturer_part_number": sku,
                    "official_url": url,
                    "fitment_source_url": url,
                    "fitment_status": "probable" if scope else "unknown",
                    "fitment_confidence": float(candidate.get("fitment_confidence", 0.7)) if scope else 0,
                    "description": description,
                    "status": "active",
                    "auto_discovered": True,
                    "discovery_metadata": {
                        "collection_url": candidate.get("source_url"),
                        "candidate_id": candidate.get("id"),
                        "fitment_scope_source": "explicit product/collection year evidence" if scope else "not established",
                    },
                    "price_hint": {
                        "vendor": candidate["vendor"],
                        "url": url,
                        "price": price if price is not None else candidate.get("observed_price"),
                        "currency": currency or candidate.get("currency", "USD"),
                        "in_stock": stock,
                        "observed_at": now_iso(),
                    },
                }
                if candidate.get("vehicle_id"):
                    part["vehicle_id"] = candidate["vehicle_id"]
                if scope:
                    part.update({key: value for key, value in scope.items() if key.startswith("fitment_family")})
                    part["fitment_range"] = {
                        "year_from": int(scope["fitment_year_from"]),
                        "year_to": int(scope["fitment_year_to"]),
                    }
                image = product.get("image")
                if image:
                    part["image_url"] = image[0] if isinstance(image, list) and image else image
                promoted.append(part)
                candidate["status"] = "published_unverified"
                candidate.setdefault("metadata", {})["published_part_id"] = part["id"]
            except Exception as exc:
                warnings.append(f"{url}: {type(exc).__name__}: {exc}")
        return promoted, state, {
            "enabled": True,
            "promoted": len(promoted),
            "attempted": attempted,
            "promotion_limit": max_promotions,
            "warnings": warnings,
        }
