import json
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


class MaintenanceSpecTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.vehicles = {
            row['id']: row
            for row in json.loads((ROOT / 'data' / 'manual' / 'vehicles.json').read_text())
        }
        cls.packs = json.loads((ROOT / 'data' / 'manual' / 'maintenance_specs.json').read_text())

    def test_packs_are_reviewable_and_vehicle_scoped(self):
        self.assertIsInstance(self.packs, list)
        self.assertTrue(self.packs)
        ids = [pack['id'] for pack in self.packs]
        self.assertEqual(len(ids), len(set(ids)))
        for pack in self.packs:
            self.assertTrue(pack.get('vehicle_ids'))
            for vehicle_id in pack['vehicle_ids']:
                self.assertIn(vehicle_id, self.vehicles)
            source = pack.get('source') or {}
            self.assertTrue(source.get('title'))
            self.assertTrue(source.get('publisher'))
            self.assertTrue(source.get('document_part_number'))
            parsed = urlparse(source.get('source_url', ''))
            self.assertEqual(parsed.scheme, 'https')
            self.assertTrue(parsed.netloc)
            self.assertTrue(source.get('retrieved_at'))
            self.assertTrue(pack.get('items'))

    def test_items_do_not_invent_intervals(self):
        for pack in self.packs:
            for item in pack['items']:
                self.assertTrue(item.get('name'))
                self.assertTrue(item.get('source_pages'))
                self.assertTrue(item.get('fluid_spec') or item.get('capacity'))
                if item.get('interval_miles') is not None or item.get('interval_months') is not None:
                    self.assertIn('interval_evidence', item)

    def test_z3_pilot_matches_owner_manual_values(self):
        pack = next(x for x in self.packs if x['id'] == 'bmw-z3-2000-28-owner-manual')
        items = {x['name']: x for x in pack['items']}
        self.assertEqual(items['Engine oil & filter']['capacity'], '6.9 US qt (6.5 L) with filter')
        self.assertEqual(items['Coolant']['capacity'], '11.1 US qt (10.5 L) including heater circuit')
        self.assertIsNone(items['Engine oil & filter']['interval_miles'])
        self.assertIsNone(items['Coolant']['interval_months'])


if __name__ == '__main__':
    unittest.main()
