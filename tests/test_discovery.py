import unittest

from collectors.catalog_discovery import fitment_scope_for_text
from collectors.vehicles import VehicleCollector
from pipeline.applications import derive_fitment_rules, expand_fitments, load_applications


class _Response:
    def __init__(self, payload):
        self.payload = payload

    def json(self):
        return self.payload


class DiscoveryTests(unittest.TestCase):
    def test_vehicle_collector_rejects_partial_make_matches_and_prunes_old_pollution(self):
        collector = VehicleCollector(timeout=1)
        urls = []
        payload = {
            "Results": [
                {"Make_ID": 460, "Make_Name": "Ford", "Model_ID": 1781, "Model_Name": "Mustang"},
                {"Make_ID": 6579, "Make_Name": "CRANFORD RADIATOR INC.", "Model_ID": 17910, "Model_Name": "CRANFORD RADIATOR INC."},
            ]
        }
        collector.get = lambda url: (urls.append(url) or _Response(payload))
        existing = [
            {
                "id": "manual",
                "year": 2017,
                "make": "Ford",
                "model": "Mustang",
                "metadata": {"source": "manual_curated"},
            },
            {
                "id": "polluted",
                "year": 2017,
                "make": "CRANFORD RADIATOR INC.",
                "model": "CRANFORD RADIATOR INC.",
                "metadata": {"source": "NHTSA vPIC"},
            },
        ]
        vehicles, _, meta = collector.run(existing, {"cursor": 0})
        self.assertIn("manual", {row["id"] for row in vehicles})
        self.assertNotIn("polluted", {row["id"] for row in vehicles})
        self.assertFalse(any(row.get("make") == "CRANFORD RADIATOR INC." for row in vehicles))
        self.assertGreater(meta["rejected_make_mismatch"], 0)
        self.assertGreaterEqual(meta["pruned_invalid_nhtsa"], 1)
        self.assertTrue(meta["passenger_car_only"])
        self.assertTrue(any("vehicletype/Passenger%20Car" in url for url in urls))
        for row in vehicles:
            if (row.get("metadata") or {}).get("source") == "NHTSA vPIC":
                self.assertEqual(row["make"], (row["metadata"] or {}).get("requested_make"))
                self.assertEqual((row["metadata"] or {}).get("vehicle_type"), "Passenger Car")

    def test_compact_year_ranges_are_intersected_with_family_generation(self):
        cfg = {
            "family_id": "mazda-nb",
            "year_from": 1999,
            "year_to": 2005,
            "family_scope_requires_title_range": True,
        }
        scope, compatible = fitment_scope_for_text(cfg, "Suspension kit 2001-05")
        self.assertTrue(compatible)
        self.assertEqual((scope["fitment_year_from"], scope["fitment_year_to"]), (2001, 2005))
        scope, compatible = fitment_scope_for_text(cfg, "Brake package 1994-02")
        self.assertTrue(compatible)
        self.assertEqual((scope["fitment_year_from"], scope["fitment_year_to"]), (1999, 2002))

    def test_explicit_wrong_generation_is_rejected(self):
        cfg = {
            "family_ids": ["subaru-brz-zc6", "scion-frs", "toyota-86"],
            "year_from": 2013,
            "year_to": 2020,
            "family_scope_requires_title_range": True,
        }
        scope, compatible = fitment_scope_for_text(cfg, "2022-2026 BRZ / GR86 intake")
        self.assertFalse(compatible)
        self.assertEqual(scope, {})
        scope, compatible = fitment_scope_for_text(cfg, "BRZ transmission mount")
        self.assertTrue(compatible)
        self.assertEqual(scope, {}, "collection membership alone must not establish exact family fitment")

    def test_multi_family_product_expands_to_every_matching_year(self):
        apps = load_applications()
        part = {
            "id": "future-86-family-part",
            "fitment_family_ids": ["subaru-brz-zc6", "scion-frs", "toyota-86"],
            "fitment_range": {"year_from": 2013, "year_to": 2020},
            "fitment_source_url": "https://manufacturer.example/product",
            "fitment_status": "probable",
            "fitment_confidence": 0.9,
        }
        rules = derive_fitment_rules([part], apps, [])
        self.assertEqual(len(rules), 1)
        expanded, _ = expand_fitments([part], apps, rules)
        by_id = {app["id"]: app for app in apps}
        by_family = {}
        for fit in expanded[0]["fitments"]:
            app = by_id[fit["vehicle_id"]]
            by_family.setdefault(app["family_id"], set()).add(app["year"])
        self.assertEqual(by_family["subaru-brz-zc6"], set(range(2013, 2021)))
        self.assertEqual(by_family["scion-frs"], set(range(2013, 2017)))
        self.assertEqual(by_family["toyota-86"], set(range(2017, 2021)))


if __name__ == "__main__":
    unittest.main()
