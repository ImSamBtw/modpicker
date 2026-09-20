import unittest
from pipeline.models import stable_id, SourceRecord
from pipeline.curation import classify, source_weight
from pipeline.run import dedupe_sources, load_catalog
from collectors.catalog_discovery import CatalogDiscoveryCollector

class PipelineTests(unittest.TestCase):
    def test_stable_ids(self):
        self.assertEqual(stable_id('A','B'),stable_id('a',' b '))

    def test_classification(self):
        self.assertIn('install',classify('How to install coilovers'))
        self.assertIn('comparison',classify('EL vs UEL header comparison'))

    def test_weights(self):
        self.assertGreater(source_weight('manufacturer'),source_weight('reddit'))

    def test_source_factory(self):
        s=SourceRecord.make(part_id='x',source_type='forum',url='https://example.com',title='test')
        self.assertTrue(s.id)
        self.assertEqual(s.part_id,'x')

    def test_source_url_canonicalization(self):
        primary=SourceRecord.make(part_id='p',source_type='manufacturer',url='https://example.com/product',title='Primary',confidence=.95,metadata={'catalog_seed':True})
        live=SourceRecord.make(part_id='p',source_type='retailer',url='https://example.com/product',title='Live check',confidence=.82,metadata={'collector':'web_product','json_ld_product_found':True})
        result=dedupe_sources([primary,live])
        self.assertEqual(len(result),1)
        self.assertEqual(result[0].source_type,'manufacturer')
        self.assertEqual(result[0].id,primary.id)
        self.assertTrue(result[0].metadata['json_ld_product_found'])
        self.assertEqual(result[0].metadata['merged_source_types'],['manufacturer','retailer'])

    def test_discovery_rejects_generic_navigation(self):
        c=CatalogDiscoveryCollector()
        self.assertFalse(c.candidate_allowed({},'Brakes','https://example.com/products/brakes',None))
        self.assertTrue(c.candidate_allowed({},'PERRIN Front Endlinks for BRZ','https://example.com/products/endlinks',126.65))

    def test_discovery_title_fitment_policy(self):
        c=CatalogDiscoveryCollector()
        cfg={'title_any':['BRZ','FR-S','86','GR86']}
        self.assertTrue(c.candidate_allowed(cfg,'Engine Mount Kit for WRX, STI, BRZ, FR-S, 86','https://example.com/p',339.15))
        self.assertFalse(c.candidate_allowed(cfg,'Rear Differential Lockdown for 2002-2007 WRX','https://example.com/p2',39.95))

    def test_discovery_excludes_wrong_year_variant(self):
        c=CatalogDiscoveryCollector()
        cfg={'title_none':['2001-05','Mazdaspeed']}
        self.assertFalse(c.candidate_allowed(cfg,'2001-05 Sport Stage 1 Performance Brake Kit','https://example.com/p',600))
        self.assertTrue(c.candidate_allowed(cfg,'1994-02 Stage 1 Performance Brake Kit','https://example.com/p2',600))

    def test_catalog_assigns_explicit_unknown_category(self):
        parts=load_catalog()
        self.assertTrue(parts)
        self.assertTrue(all(p.get('category') for p in parts))
        self.assertIn('Uncategorized',{p['category'] for p in parts})

    def test_catalog_drops_legacy_seed_rankings_before_scoring(self):
        parts=load_catalog()
        self.assertTrue(parts)
        self.assertTrue(all('ranking' not in p for p in parts))

if __name__=='__main__':
    unittest.main()
