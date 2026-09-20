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
    def test_multi_trim_selector_matches_future_configurations(self):
        selector={'family_id':'bmw-z3','year_from':1999,'year_to':2002,'trim_contains_any':['2.5','2.8','3.0']}
        self.assertTrue(application_matches({'id':'future-z3','family_id':'bmw-z3','year':2002,'trim':'Z3 Roadster · 3.0L · Manual 5-spd'},selector))
        self.assertFalse(application_matches({'id':'future-z3-19','family_id':'bmw-z3','year':2002,'trim':'Z3 Roadster · 1.9L · Manual 5-spd'},selector))
        self.assertTrue(application_matches({'id':'future-z3-manual','family_id':'bmw-z3','year':2000,'trim':'2.8 Roadster','transmission':'5-speed manual'}, {'family_id':'bmw-z3','trim_contains':'2.8','transmissions':['Manual 5-spd','5-speed manual']}))
    def test_z3_ranges_expand_across_imported_years(self):
        apps=load_applications()
        parts,stats=expand_fitments([{'id':'z3-turner-monoball-fcab'},{'id':'z3-turner-brake-lines'},{'id':'z3-missing'}],apps,load_fitment_rules())
        by_id={a['id']:a for a in apps}
        monoball={by_id[a['vehicle_id']]['year'] for a in parts[0]['fitments']}
        self.assertEqual(monoball,{1997,1998,1999,2000})
        self.assertTrue(all(f['fitment_status']=='probable' for f in parts[0]['fitments']))
        brake_years={by_id[a['vehicle_id']]['year'] for a in parts[1]['fitments']}
        self.assertEqual(brake_years,{1997,1998,1999,2000,2001,2002})
        self.assertGreater(stats['expanded_fitment_count'], 20)
        future={"id":"epa-future-z3-28","family_id":"bmw-z3","year":2002,"trim":"Z3 Roadster · 2.8L · Manual 5-spd","transmission":"Manual 5-spd"}
        future_parts,_=expand_fitments([{'id':'z3-turner-monoball-fcab'}],apps+[future],load_fitment_rules())
        self.assertIn('epa-future-z3-28',{f['vehicle_id'] for f in future_parts[0]['fitments']})
    def test_engine_rules_only_match_explicit_engine_family(self):
        apps=load_applications()
        parts,_=expand_fitments([{'id':'z3-ngk-plugs'},{'id':'z3-bosch-coils'}],apps,load_fitment_rules())
        self.assertEqual([f['vehicle_id'] for f in parts[0]['fitments']],['z3-2000-28'])
        self.assertEqual([f['vehicle_id'] for f in parts[1]['fitments']],['z3-2000-28'])
    def test_fitments_deduplicated_without_confidence_inflation(self):
        p={'id':'x','fitments':[{'vehicle_id':'v','fitment_status':'verified','confidence':.7,'source_url':'https://a.test'},{'vehicle_id':'v','fitment_status':'probable','confidence':.99,'source_url':'https://b.test'}]}
        parts,_=expand_fitments([p],[],[])
        self.assertEqual(len(parts[0]['fitments']),1)
        self.assertEqual(parts[0]['fitments'][0]['confidence'],.7)
    def test_import_fails_on_empty_scope(self):
        with self.assertRaises(ValueError):normalize([])
