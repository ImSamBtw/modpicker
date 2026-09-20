import json
import unittest
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]


class InterchangeDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.groups = json.loads((ROOT / 'data' / 'manual' / 'interchange_groups.json').read_text())
        cls.part_ids = set()
        for path in (ROOT / 'data' / 'seed').glob('*_parts.json'):
            for row in json.loads(path.read_text()):
                if isinstance(row, dict) and row.get('id'):
                    cls.part_ids.add(row['id'])
        for row in json.loads((ROOT / 'data' / 'manual' / 'parts.json').read_text()):
            if isinstance(row, dict) and row.get('id'):
                cls.part_ids.add(row['id'])

    def test_interchange_groups_are_reviewable_and_unique(self):
        self.assertIsInstance(self.groups, list)
        self.assertTrue(self.groups)
        ids = [g['id'] for g in self.groups]
        self.assertEqual(len(ids), len(set(ids)))
        for group in self.groups:
            self.assertTrue(group.get('canonical_name'))
            self.assertTrue(group.get('manufacturer_part_numbers'))
            self.assertIn(group.get('installation_class'), {'exact', 'direct', 'modification_required', 'unknown'})
            self.assertGreaterEqual(len(group.get('applications', [])), 2)
            self.assertTrue(group.get('evidence'))
            for application in group.get('applications', []):
                self.assertTrue(application.get('make'))
                self.assertTrue(application.get('model'))
                self.assertLessEqual(application['year_from'], application['year_to'])

    def test_interchange_links_to_known_parts_and_sources(self):
        for group in self.groups:
            for part_id in group.get('part_ids', []):
                self.assertIn(part_id, self.part_ids, f'unknown interchange part {part_id}')
            for evidence in group.get('evidence', []):
                parsed = urlparse(evidence.get('source_url', ''))
                self.assertIn(parsed.scheme, {'http', 'https'})
                self.assertTrue(parsed.netloc)
                self.assertTrue(evidence.get('retrieved_at'))

    def test_pilot_is_cross_make_without_mutating_fitment_rules(self):
        group = next(g for g in self.groups if g['id'] == 'perrin-psp-brk-406bk')
        makes = {a['make'] for a in group['applications']}
        self.assertGreaterEqual(len(makes), 3)
        fitment_rules = json.loads((ROOT / 'data' / 'reference' / 'fitment_rules.json').read_text())
        self.assertFalse(any(r.get('id') == group['id'] for r in fitment_rules), 'interchange must stay separate from exact fitment rules')

    def test_pilot_preserves_manufacturer_model_year_gap(self):
        group = next(g for g in self.groups if g['id'] == 'perrin-psp-brk-406bk')
        brz_ranges = [(a['year_from'], a['year_to']) for a in group['applications'] if a['make'] == 'Subaru' and a['model'] == 'BRZ']
        self.assertEqual(brz_ranges, [(2013, 2020), (2022, 2026)])
        self.assertFalse(any(start <= 2021 <= end for start, end in brz_ranges))


if __name__ == '__main__':
    unittest.main()
