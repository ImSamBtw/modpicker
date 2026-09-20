from __future__ import annotations

import json
import re
import urllib.robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse

from bs4 import BeautifulSoup

from .base import BaseCollector
from pipeline.models import now_iso, stable_id

PRICE_RE = re.compile(r"\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)")
YEAR_RANGE_RE = re.compile(
    r"(?<!\d)((?:19|20)\d{2})\s*(?:-|–|—|to|through)\s*((?:19|20)\d{2}|\d{2})(?!\d)",
    re.I,
)
GENERIC_TITLES = {
    "accessories", "aerodynamics", "brakes", "chassis", "cooling", "drivetrain", "engine", "exhaust",
    "interior", "maintenance", "suspension", "wheels", "coilovers", "springs", "sway bars", "brake pads",
    "brake lines", "brake fluid", "radiators", "oil coolers", "headers", "cat backs", "intake / air filters",
    "big brake kits", "control arms", "bushings", "limited slip differential", "supercharger kits", "turbocharger kits",
}


def extract_year_ranges(text):
    """Extract explicit automotive year ranges, including compact 1999-05 form."""
    out = []
    for start_text, end_text in YEAR_RANGE_RE.findall(str(text or "")):
        start = int(start_text)
        if len(end_text) == 2:
            end = (start // 100) * 100 + int(end_text)
            if end < start:
                end += 100
        else:
            end = int(end_text)
        if start <= end <= start + 40 and 1980 <= start <= 2100:
            out.append((start, end))
    return out


def fitment_scope_for_text(cfg, text):
    """Return evidence-backed family/year scope plus whether the candidate is compatible.

    A collection can identify the family being researched, but that membership
    alone is not exact fitment.  By default an explicit product title/description
    year range is required before family-wide compatibility is published.
    """
    family_ids = [str(x) for x in cfg.get("family_ids", []) if x]
    if cfg.get("family_id"):
        family_ids.append(str(cfg["family_id"]))
    family_ids = list(dict.fromkeys(family_ids))
    if not family_ids:
        return {}, True
    if cfg.get("year_from") is None or cfg.get("year_to") is None:
        return {}, True
    source_start, source_end = int(cfg["year_from"]), int(cfg["year_to"])
    explicit = extract_year_ranges(text)
    if explicit:
        overlaps = []
        for start, end in explicit:
            lo, hi = max(start, source_start), min(end, source_end)
            if lo <= hi:
                overlaps.append((lo, hi))
        if not overlaps:
            # An explicit non-overlapping range is stronger than collection membership.
            return {}, False
        # Prefer the widest compatible interval if a title mentions multiple generations.
        year_from, year_to = max(overlaps, key=lambda item: (item[1] - item[0], -item[0]))
    elif cfg.get("family_scope_requires_title_range", True):
        return {}, True
    else:
        year_from, year_to = source_start, source_end

    scope = {"fitment_year_from": year_from, "fitment_year_to": year_to}
    if len(family_ids) == 1:
        scope["fitment_family_id"] = family_ids[0]
    else:
        scope["fitment_family_ids"] = family_ids
    return scope, True


def scope_from_candidate(candidate, text):
    """Re-evaluate scope with product-page text during promotion."""
    if candidate.get("fitment_year_from") is not None and candidate.get("fitment_year_to") is not None:
        scope = {
            "fitment_year_from": int(candidate["fitment_year_from"]),
            "fitment_year_to": int(candidate["fitment_year_to"]),
        }
        if candidate.get("fitment_family_id"):
            scope["fitment_family_id"] = candidate["fitment_family_id"]
        if candidate.get("fitment_family_ids"):
            scope["fitment_family_ids"] = list(candidate["fitment_family_ids"])
        return scope, True
    metadata = candidate.get("metadata") or {}
    cfg = {
        "family_id": metadata.get("source_family_id"),
        "family_ids": metadata.get("source_family_ids") or [],
        "year_from": metadata.get("source_year_from"),
        "year_to": metadata.get("source_year_to"),
        "family_scope_requires_title_range": metadata.get("family_scope_requires_title_range", True),
    }
    return fitment_scope_for_text(cfg, text)


class CatalogDiscoveryCollector(BaseCollector):
    name = "catalog_discovery"

    def __init__(self, timeout=8):
        super().__init__(timeout=timeout)
        self._robots_cache = {}

    def allowed(self, url):
        parsed = urlparse(url)
        origin = f"{parsed.scheme}://{parsed.netloc}"
        robots = f"{origin}/robots.txt"
        if origin in self._robots_cache:
            parser = self._robots_cache[origin]
            return bool(parser and parser.can_fetch("ModPickerBot", url))
        try:
            response = self.session.get(robots, timeout=15)
            if response.status_code >= 400:
                self._robots_cache[origin] = None
                return False
            parser = urllib.robotparser.RobotFileParser()
            parser.set_url(robots)
            parser.parse(response.text.splitlines())
            self._robots_cache[origin] = parser
            return parser.can_fetch("ModPickerBot", url)
        except Exception:
            self._robots_cache[origin] = None
            return False

    def candidate_allowed(self, cfg, title, full, price):
        low = title.strip().lower()
        if cfg.get("reject_generic_titles", True) and low in GENERIC_TITLES and price is None:
            return False
        any_terms = [str(x).lower() for x in cfg.get("title_any", []) if str(x).strip()]
        if any_terms and not any(term in low for term in any_terms):
            return False
        none_terms = [str(x).lower() for x in cfg.get("title_none", []) if str(x).strip()]
        if any(term in low for term in none_terms):
            return False
        require_url = cfg.get("url_regex")
        if require_url and not re.search(require_url, full, re.I):
            return False
        reject_url = cfg.get("reject_url_regex")
        if reject_url and re.search(reject_url, full, re.I):
            return False
        if cfg.get("require_price") and price is None:
            return False
        return True

    def run(self, config="config/catalog_sources.json"):
        configs = json.loads(Path(config).read_text()) if Path(config).exists() else []
        found = {}
        warnings = []
        checked = 0
        filtered = 0
        scoped = 0
        for cfg in configs:
            if not cfg.get("allow_scrape"):
                continue
            url = cfg["url"]
            if not self.allowed(url):
                warnings.append(f"robots denied/unavailable: {url}")
                continue
            try:
                response = self.get(url)
                checked += 1
                soup = BeautifulSoup(response.text, "html.parser")
                needle = cfg.get("product_path_contains")
                path_regex = cfg.get("product_path_regex")
                if not needle and not path_regex:
                    needle = "/products/"
                source_limit = max(1, int(cfg.get("max_candidates", 125)))
                source_count = 0
                for anchor in soup.find_all("a", href=True):
                    if source_count >= source_limit:
                        break
                    href = anchor.get("href", "")
                    full = urljoin(url, href.split("#")[0])
                    if needle and needle not in href and needle not in full:
                        continue
                    if path_regex and not re.search(path_regex, full, re.I):
                        continue
                    title = " ".join(anchor.stripped_strings).strip()
                    if len(title) < 4:
                        title = (anchor.get("title") or anchor.get("aria-label") or "").strip()
                    if len(title) < 4:
                        continue
                    title = re.sub(r"\s+", " ", title)[:240]
                    text = " ".join((anchor.parent or anchor).stripped_strings)
                    match = PRICE_RE.search(text)
                    price = float(match.group(1).replace(",", "")) if match else None
                    if not self.candidate_allowed(cfg, title, full, price):
                        filtered += 1
                        continue
                    scope, compatible = fitment_scope_for_text(cfg, title)
                    if not compatible:
                        filtered += 1
                        continue
                    if scope:
                        scoped += 1
                    family_ids = list(cfg.get("family_ids") or [])
                    if cfg.get("family_id"):
                        family_ids.append(cfg["family_id"])
                    scope_key = cfg.get("vehicle_id") or "|".join(sorted(str(x) for x in family_ids)) or url
                    candidate_id = stable_id(str(scope_key), full)
                    if candidate_id in found:
                        continue
                    metadata = {
                        "discovered_by": "catalog_discovery",
                        "collection_url": url,
                        "discovery_policy": cfg.get("policy_name", "default"),
                        "source_family_id": cfg.get("family_id"),
                        "source_family_ids": family_ids,
                        "source_year_from": cfg.get("year_from"),
                        "source_year_to": cfg.get("year_to"),
                        "family_scope_requires_title_range": cfg.get("family_scope_requires_title_range", True),
                    }
                    candidate = {
                        "id": candidate_id,
                        "vendor": cfg["vendor"],
                        "title": title,
                        "url": full,
                        "source_url": url,
                        "observed_price": price,
                        "currency": "USD",
                        "fitment_confidence": float(cfg.get("fitment_confidence", 0.7 if scope else 0.0)),
                        "status": "pending",
                        "metadata": metadata,
                        "discovered_at": now_iso(),
                        "updated_at": now_iso(),
                        **scope,
                    }
                    if cfg.get("vehicle_id"):
                        candidate["vehicle_id"] = cfg["vehicle_id"]
                    found[candidate_id] = candidate
                    source_count += 1
            except Exception as exc:
                warnings.append(f"{url}: {type(exc).__name__}: {exc}")
        return list(found.values()), warnings, {
            "enabled": True,
            "pages_checked": checked,
            "candidate_count": len(found),
            "scoped_candidate_count": scoped,
            "filtered_count": filtered,
            "robots_origins_checked": len(self._robots_cache),
            "timeout_seconds": self.timeout,
        }
