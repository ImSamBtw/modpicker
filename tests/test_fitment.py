import unittest
from pipeline.applications import application_matches, expand_fitments, load_applications, load_fitment_rules
from scripts.import_vehicle_database import normalize

class FitmentTests(unittest.TestCase):
    def test_official_records_keep_transmissions_separate(self):
        apps=load_applications()
        z3=[a for a in apps if a['make']=='BMW' and a['year']==2000 and a['id'].startswith('epa-')]
        self.assertGreater(len(z3),1)
        self.assertTrue(any('Manual' in a['transmission'] for a in z3))
        self.assertTrue(any('Automatic' in a['transmission'] for a in z3))
        self.assertTrue(all(not a.get('engine_family_id') for a in z3))
    def test_range_qualifications_remain_visible(self):
        parts,stats=expand_fitments([{'id':'miata-koni-active'}],load_applications(),load_fitment_rules())
        fits=parts[0]['fitments'];self.assertGreater(len(fits),7)
        self.assertTrue(all(f['fitment_status']=='probable' for f in fits))
        self.assertTrue(all('Mazdaspeed' in f['notes'] for f in fits))
        self.assertFalse(any(f['vehicle_id']=='brz-2017' for f in fits))
    def test_unknown_or_empty_selector_fails_closed(self):
        for selector in ({},{'transmision':'manual'}):
            with self.assertRaises(ValueError):application_matches({'id':'x'},selector)
    def test_manual_rule_excludes_automatic_and_unknown(self):
        selector={'transmission':'Manual 5-spd'}
        self.assertTrue(application_matches({'transmission':'Manual 5-spd'},selector))
        self.assertFalse(application_matches({'transmission':'Automatic 4-spd'},selector))
        self.assertFalse(application_matches({},selector))
    def test_fitments_deduplicated_without_confidence_inflation(self):
        p={'id':'x','fitments':[{'vehicle_id':'v','fitment_status':'verified','confidence':.7,'source_url':'https://a.test'},{'vehicle_id':'v','fitment_status':'probable','confidence':.99,'source_url':'https://b.test'}]}
        parts,_=expand_fitments([p],[],[])
        self.assertEqual(len(parts[0]['fitments']),1)
        self.assertEqual(parts[0]['fitments'][0]['confidence'],.7)
    def test_import_fails_on_empty_scope(self):
        with self.assertRaises(ValueError):normalize([])
