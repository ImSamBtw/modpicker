from __future__ import annotations
import json, urllib.robotparser
from datetime import datetime, timezone, timedelta
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from .base import BaseCollector, CollectorResult
from pipeline.models import OfferRecord, SourceRecord

class WebProductCollector(BaseCollector):
    name='web_product'
    def __init__(self,timeout=10):
        super().__init__(timeout=timeout)
        self._robots_cache={}

    def allowed(self,url):
        u=urlparse(url); origin=f'{u.scheme}://{u.netloc}'; robots=f'{origin}/robots.txt'
        if origin in self._robots_cache:
            rp=self._robots_cache[origin]
            return bool(rp and rp.can_fetch('ModPickerBot',url))
        try:
            r=self.session.get(robots,timeout=15)
            if r.status_code>=400:
                self._robots_cache[origin]=None; return False
            rp=urllib.robotparser.RobotFileParser(); rp.set_url(robots); rp.parse(r.text.splitlines())
            self._robots_cache[origin]=rp
            return rp.can_fetch('ModPickerBot',url)
        except Exception:
            self._robots_cache[origin]=None; return False

    def products(self,data):
        if isinstance(data,list):
            for x in data: yield from self.products(x)
        elif isinstance(data,dict):
            typ=data.get('@type')
            if typ=='Product' or (isinstance(typ,list) and 'Product' in typ): yield data
            for key in ('@graph','mainEntity','itemListElement'):
                if key in data: yield from self.products(data[key])

    def offer_data(self,obj):
        raw=obj.get('offers') or {}
        offers=raw if isinstance(raw,list) else [raw]
        for off in offers:
            if not isinstance(off,dict): continue
            price=off.get('price')  # AggregateOffer.lowPrice can refer to a different variant
            if price is None and isinstance(off.get('priceSpecification'),dict):
                price=off['priceSpecification'].get('price')
            try: price=float(str(price).replace(',','')) if price is not None else None
            except (TypeError,ValueError): price=None
            if price is not None:
                return price,off.get('priceCurrency','USD'),(True if str(off.get('availability','')).endswith('/InStock') else False if str(off.get('availability','')).endswith(('/OutOfStock','/Discontinued','/SoldOut')) else None)
        return None,'USD',None

    def run(self, rows, existing_sources=None, refresh_hours=24):
        offers=[]; sources=[]; warnings=[]; checked=0; skipped=0
        cutoff=datetime.now(timezone.utc)-timedelta(hours=refresh_hours)
        fresh=set()
        for s in existing_sources or []:
            if s.get('metadata',{}).get('collector')!='web_product' or 'identity_matched' not in s.get('metadata',{}): continue
            try: dt=datetime.fromisoformat(str(s.get('retrieved_at','')).replace('Z','+00:00'))
            except Exception: continue
            if dt>=cutoff: fresh.add(s.get('url'))
        for x in rows:
            if not x.get('allow_scrape'): continue
            url=x['url']
            if url in fresh:
                skipped+=1; continue
            if not self.allowed(url):
                warnings.append(f'robots denied/unavailable: {url}'); continue
            try:
                soup=BeautifulSoup(self.get(url).text,'html.parser'); checked+=1; found=False; product_obj={}
                for node in soup.find_all('script',attrs={'type':'application/ld+json'}):
                    try: data=json.loads(node.string or '{}')
                    except Exception: continue
                    for obj in self.products(data):
                        from .promotion import product_matches
                        if not product_matches(obj,url,x.get('mpn')): continue
                        product_obj=obj
                        price,currency,in_stock=self.offer_data(obj)
                        if price is None: continue
                        offers.append(OfferRecord.make(
                            part_id=x['part_id'],vendor=x.get('vendor') or urlparse(url).netloc,url=url,
                            price=price,currency=currency,in_stock=in_stock,
                            metadata={'sku':obj.get('sku') or obj.get('mpn'),'name':obj.get('name'),'source':'json-ld','price_type':'structured_page','identity_matched':True}
                        )); found=True; break
                    if found: break
                sources.append(SourceRecord.make(
                    part_id=x['part_id'],source_type='retailer',url=url,title=x.get('title',url),outlet=x.get('vendor',''),
                    summary='Permitted product page checked for structured product and offer data.',confidence=.82,
                    metadata={'json_ld_product_found':found,'collector':'web_product','identity_matched':bool(product_obj),'aggregate_rating':product_obj.get('aggregateRating'), 'product_image':product_obj.get('image')}
                ))
            except Exception as e:
                warnings.append(f'{url}: {type(e).__name__}: {e}')
        return CollectorResult(self.name,sources,offers,warnings,{
            'enabled':True,'pages_checked':checked,'fresh_pages_skipped':skipped,'source_count':len(sources),
            'offer_count':len(offers),'refresh_hours':refresh_hours,'robots_origins_checked':len(self._robots_cache)
        })
