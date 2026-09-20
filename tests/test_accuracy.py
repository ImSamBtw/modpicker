import unittest
from tempfile import TemporaryDirectory
from pipeline.models import now_iso, OfferRecord
from pipeline.scoring import score_sources
from pipeline.store import JsonStore
from collectors.promotion import product_matches
from collectors.web_product import WebProductCollector

class AccuracyTests(unittest.TestCase):
    def record(self,count=20,rating=4,url='https://seller.com/product'):
        return {'url':url,'retrieved_at':now_iso(),'metadata':{'identity_matched':True,'aggregate_rating':{'ratingValue':rating,'bestRating':5,'reviewCount':count}}}
    def test_links_alone_cannot_create_rating(self):
        r=score_sources([{'url':'https://youtube.com/watch?v=x','confidence':1}]*100)
        self.assertIsNone(r['overall']);self.assertEqual(r['source_count'],0)
    def test_published_rating_and_missing_dimensions(self):
        r=score_sources([self.record()]);self.assertEqual(r['overall'],8);self.assertIsNone(r['reliability']);self.assertIsNone(r['performance'])
    def test_same_outlet_deduplicated(self):
        r=score_sources([self.record(),self.record(url='https://seller.com/another')]);self.assertEqual(r['metadata']['review_count'],20)
    def test_invalid_numbers_rejected(self):
        self.assertIsNone(score_sources([self.record(rating=float('nan'))])['overall'])
        self.assertIsNone(score_sources([self.record(count=0)])['overall'])
    def test_stale_review_hidden(self):
        r=self.record();r['retrieved_at']='2020-01-01T00:00:00Z';self.assertIsNone(score_sources([r])['overall'])
    def test_unknown_identity_rejected(self):
        r=self.record();r['metadata']['identity_matched']=False;self.assertIsNone(score_sources([r])['overall'])
    def test_sku_must_match(self):
        obj={'name':'Brake pad','sku':'AB-123','url':'https://seller.com/pad'}
        self.assertTrue(product_matches(obj,obj['url'],'AB123'));self.assertFalse(product_matches(obj,obj['url'],'AB124'));self.assertFalse(product_matches(obj,'https://seller.com/rotor'))
    def test_unknown_stock_remains_unknown(self):
        p,c,s=WebProductCollector().offer_data({'offers':{'price':12,'priceCurrency':'USD'}});self.assertIsNone(s)
    def test_variant_low_price_not_exact_quote(self):
        p,_,_=WebProductCollector().offer_data({'offers':{'lowPrice':12}});self.assertIsNone(p)
    def test_new_offer_survives_old_seed(self):
        with TemporaryDirectory() as tmp:
            store=JsonStore(tmp);old=OfferRecord.make(part_id='p',vendor='v',url='https://seller.com',price=100,retrieved_at='2020-01-01T00:00:00Z');new=OfferRecord.make(part_id='p',vendor='v',url=old.url,price=120,retrieved_at=now_iso());store.upsert('offers.json',[new]);self.assertEqual(store.upsert('offers.json',[old])[0]['price'],120)

class ProductVariantTests(unittest.TestCase):
    def test_single_offer_sku(self):
        obj={'name':'Spring','offers':[{'sku':'ABC-123'}],'url':'https://seller.com/spring'}
        self.assertTrue(product_matches(obj,obj['url'],'ABC123'))
    def test_multiple_offer_skus_ambiguous(self):
        obj={'name':'Spring','offers':[{'sku':'ABC'},{'sku':'DEF'}]}
        self.assertFalse(product_matches(obj,'https://seller.com/spring'))
    def test_refreshed_evidence_survives_seed_only_run(self):
        with TemporaryDirectory() as tmp:
            store=JsonStore(tmp)
            live={'id':'a','metadata':{'collector':'web_product','aggregate_rating':{'ratingValue':4}},'retrieved_at':'2026-09-19T00:00:00Z'}
            seed={'id':'a','metadata':{'catalog_seed':True},'retrieved_at':now_iso()}
            store.upsert('sources.json',[live]);self.assertEqual(store.upsert('sources.json',[seed])[0]['metadata']['collector'],'web_product')
