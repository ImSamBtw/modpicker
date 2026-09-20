import json, urllib.robotparser
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from .base import BaseCollector, CollectorResult
from pipeline.models import OfferRecord, SourceRecord
class WebProductCollector(BaseCollector):
    name='web_product'
    def allowed(self,url):
        u=urlparse(url); robots=f'{u.scheme}://{u.netloc}/robots.txt'
        try:
            rp=urllib.robotparser.RobotFileParser(); rp.set_url(robots); rp.read(); return rp.can_fetch(self.session.headers['User-Agent'],url)
        except Exception: return False
    def run(self, rows):
        offers=[]; sources=[]; warnings=[]
        for x in rows:
            if not x.get('allow_scrape'): continue
            url=x['url']
            if not self.allowed(url): warnings.append(f'robots denied/unavailable: {url}'); continue
            try:
                soup=BeautifulSoup(self.get(url).text,'html.parser'); found=False
                for node in soup.find_all('script',attrs={'type':'application/ld+json'}):
                    try: data=json.loads(node.string or '{}')
                    except Exception: continue
                    for obj in (data if isinstance(data,list) else [data]):
                        if not isinstance(obj,dict) or obj.get('@type')!='Product': continue
                        off=obj.get('offers') or {}; off=off[0] if isinstance(off,list) and off else off; price=off.get('price') or off.get('lowPrice')
                        offers.append(OfferRecord.make(part_id=x['part_id'],vendor=x.get('vendor') or urlparse(url).netloc,url=url,price=float(price) if price else None,currency=off.get('priceCurrency','USD'),in_stock='InStock' in str(off.get('availability','')),metadata={'sku':obj.get('sku'),'name':obj.get('name'),'source':'json-ld'})); found=True
                sources.append(SourceRecord.make(part_id=x['part_id'],source_type='retailer',url=url,title=x.get('title',url),outlet=x.get('vendor',''),summary='Allowed product page checked by ModPicker.',confidence=.78,metadata={'json_ld_product_found':found}))
            except Exception as e: warnings.append(f'{url}: {type(e).__name__}: {e}')
        return CollectorResult(self.name,sources,offers,warnings,{'count':len(sources)})
