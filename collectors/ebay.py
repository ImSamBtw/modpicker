import os, base64
from .base import BaseCollector, CollectorResult
from pipeline.models import OfferRecord
class EbayCollector(BaseCollector):
    name='ebay'
    def token(self):
        cid=os.getenv('EBAY_CLIENT_ID'); secret=os.getenv('EBAY_CLIENT_SECRET')
        if not cid or not secret: return None
        basic=base64.b64encode(f'{cid}:{secret}'.encode()).decode()
        r=self.session.post('https://api.ebay.com/identity/v1/oauth2/token',headers={'Authorization':f'Basic {basic}','Content-Type':'application/x-www-form-urlencoded'},data={'grant_type':'client_credentials','scope':'https://api.ebay.com/oauth/api_scope'},timeout=self.timeout); r.raise_for_status(); return r.json()['access_token']
    def run(self, parts):
        token=self.token()
        if not token: return CollectorResult(self.name,[],[],['eBay credentials not configured'],{'enabled':False})
        offers=[]; warnings=[]; h={'Authorization':f'Bearer {token}','X-EBAY-C-MARKETPLACE-ID':'EBAY_US'}
        for p in parts[:30]:
            try:
                r=self.get('https://api.ebay.com/buy/browse/v1/item_summary/search',headers=h,params={'q':f"{p['brand']} {p['name']}",'limit':'5','filter':'buyingOptions:{FIXED_PRICE}'})
                for item in r.json().get('itemSummaries',[]):
                    price=item.get('price',{}).get('value')
                    offers.append(OfferRecord.make(part_id=p['id'],vendor='eBay',url=item.get('itemWebUrl','https://www.ebay.com'),price=float(price) if price else None,currency=item.get('price',{}).get('currency','USD'),condition=item.get('condition','unknown').lower(),metadata={'title':item.get('title'),'item_id':item.get('itemId'),'source':'Browse API','identity_matched':False}))
            except Exception as e: warnings.append(f"{p['id']}: {type(e).__name__}: {e}")
        return CollectorResult(self.name,[],offers,warnings,{'enabled':True,'count':len(offers)})
