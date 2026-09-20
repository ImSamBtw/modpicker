import json
import tempfile
import unittest
from pathlib import Path
from scripts.validate_catalog import validate
from pipeline.export_js import export_js

class CatalogInputTests(unittest.TestCase):
    def test_manual_inputs_are_valid(self):
        validate()

    def test_platforms_have_scoped_applications(self):
        rows=json.loads(Path('config/platforms.json').read_text())
        self.assertTrue(rows)
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

if __name__=='__main__': unittest.main()
