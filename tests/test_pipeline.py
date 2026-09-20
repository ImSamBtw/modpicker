import unittest
from pipeline.models import stable_id, SourceRecord
from pipeline.curation import classify, source_weight
class PipelineTests(unittest.TestCase):
    def test_stable_ids(self): self.assertEqual(stable_id('A','B'),stable_id('a',' b '))
    def test_classification(self): self.assertIn('install',classify('How to install coilovers')); self.assertIn('comparison',classify('EL vs UEL header comparison'))
    def test_weights(self): self.assertGreater(source_weight('manufacturer'),source_weight('reddit'))
    def test_source_factory(self):
        s=SourceRecord.make(part_id='x',source_type='forum',url='https://example.com',title='test'); self.assertTrue(s.id); self.assertEqual(s.part_id,'x')
if __name__=='__main__': unittest.main()
