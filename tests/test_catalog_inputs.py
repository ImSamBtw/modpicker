import json
import tempfile
import unittest
from pathlib import Path
from scripts.validate_catalog import validate
from pipeline.export_js import export_js
from pipeline.applications import load_applications, load_fitment_rules, resolve_platforms

class CatalogInputTests(unittest.TestCase):
    def test_manual_inputs_are_valid(self):
        validate()

    def test_platforms_have_scoped_applications(self):
        rows=json.loads(Path('config/platforms.json').read_text())
        self.assertTrue(rows)
        rows=resolve_platforms(rows,load_applications())
        for row in rows:
            self.assertTrue(row['vehicle_ids'])
            self.assertTrue(row['categories'])
            self.assertTrue(row['aliases'])

    def test_platform_ids_are_unique(self):
        rows=json.loads(Path('config/platforms.json').read_text())
        self.assertEqual(len(rows),len({x['id'] for x in rows}))

    def test_browser_export_carries_platforms_and_vehicles(self):
        platforms=json.loads(Path('config/platforms.json').read_text())
        vehicles=json.loads(Path('data/manual/vehicles.json').read_text())
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'pipeline-data.js'
            export_js([],[],[],{},path=target,vehicles=vehicles,platforms=platforms)
            payload=json.loads(target.read_text().split('=',1)[1].rstrip(' ;\n'))
        self.assertEqual(payload['platforms'],platforms)
        self.assertEqual(payload['vehicles'],vehicles)

    def test_reference_applications_are_exportable(self):
        applications=load_applications()
        platforms=json.loads(Path('config/platforms.json').read_text())
        resolved=resolve_platforms(platforms,applications)
        self.assertGreaterEqual(len(applications),40)
        self.assertTrue(any(x['id']=='z3-2000-28' for x in applications))
        self.assertTrue(any(x['id'].startswith('epa-') for x in applications))
        self.assertGreater(len(next(x for x in resolved if x['id']=='bmw-z3')['vehicle_ids']),1)
        rules=load_fitment_rules()
        self.assertTrue(all(r['source_url'].startswith('https://') for r in rules))

if __name__=='__main__': unittest.main()
