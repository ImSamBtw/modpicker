"""Promote identity-checked product pages; never turn collection membership into verified fitment."""
import json, re
from pathlib import Path
from urllib.parse import urlparse
from bs4 import BeautifulSoup
from .web_product import WebProductCollector
from pipeline.models import now_iso, stable_id
CATEGORY=[('Suspension',r'coilover|shock|spring|sway bar|damper'),('Brakes',r'brake|rotor|caliper'),('Cooling',r'radiator|coolant|water pump|thermostat'),('Exhaust',r'exhaust|header|muffler'),('Drivetrain',r'clutch|flywheel|differential|engine mount|shifter'),('Chassis',r'brace|bushing|roll bar'),('Maintenance',r'filter|gasket|seal|hose')]
def product_sku(obj):
    offers=obj.get('offers') or []
    offers=offers if isinstance(offers,list) else [offers]
    # A single offer SKU is unambiguous; multiple variants require a separate fitment mapping.
    return obj.get('mpn') or obj.get('sku') or (offers[0].get('sku') if len(offers)==1 else None)
def product_matches(obj, url, expected_mpn=None):
    ident=str(product_sku(obj) or '').strip()
    if not ident or not obj.get('name'): return False
    if expected_mpn and re.sub(r'\W','',ident).lower()!=re.sub(r'\W','',str(expected_mpn)).lower(): return False
    product_url=obj.get('url') or str(obj.get('@id','')).split('#')[0]
    if product_url and urlparse(product_url).path.rstrip('/')!=urlparse(url).path.rstrip('/'): return False
    return True
class PromotionCollector(WebProductCollector):
    def run(self,candidates,parts,state):
        known={(urlparse(p.get('official_url','')).hostname,urlparse(p.get('official_url','')).path.rstrip('/')) for p in parts if p.get('official_url')}
        allowed={x['domain'] for x in json.loads(Path('config/product_domains.json').read_text()) if x.get('allow_scrape')}
        todo=[c for c in candidates if (urlparse(c['url']).hostname,urlparse(c['url']).path.rstrip('/')) not in known]
        # Rotate by last attempt so one invalid page cannot starve the queue.
        todo.sort(key=lambda c:state.get(c['id'],'')); promoted=[]; warnings=[]
        for c in todo[:8]:
            state[c['id']]=now_iso(); url=c['url']
            if urlparse(url).hostname.removeprefix('www.') not in allowed: continue
            if not self.allowed(url):
                warnings.append(f'robots denied/unavailable: {url}'); continue
            try:
                soup=BeautifulSoup(self.get(url).text,'html.parser'); products=[]
                for node in soup.select('script[type="application/ld+json"]'):
                    try: products.extend(self.products(json.loads(node.string or '{}')))
                    except (ValueError,TypeError): continue
                # Ambiguous multi-product pages stay queued.
                matches=[p for p in products if product_matches(p,url)]
                if len(matches)!=1: continue
                p=matches[0]; brand=p.get('brand') or p.get('Brand') or {}; brand=brand.get('name') if isinstance(brand,dict) else brand
                if not brand: continue
                title=str(p['name']); category=next((cat for cat,pat in CATEGORY if re.search(pat,title,re.I)), 'Other')
                desc=BeautifulSoup(str(p.get('description') or ''),'html.parser').get_text(' ',strip=True)[:2000]
                price,currency,stock=self.offer_data(p)
                promoted.append({'id':'auto-'+stable_id(str(brand),str(product_sku(p)),c['vehicle_id']),'brand':str(brand),'name':title,'category':category,'vehicle_id':c['vehicle_id'],'vehicle_query':c['vehicle_id'],'manufacturer_part_number':str(product_sku(p)),'official_url':url,'fitment_source_url':c['source_url'],'fitment_status':'unknown','fitment_confidence':0,'description':desc,'status':'active','auto_discovered':True,'price_hint':{'vendor':c['vendor'],'url':url,'price':price,'currency':currency,'in_stock':stock,'observed_at':now_iso()}})
                c['status']='published_unverified'; c['metadata']['published_part_id']=promoted[-1]['id']
            except Exception as e: warnings.append(f"{url}: {type(e).__name__}")
        return promoted,state,{'enabled':True,'promoted':len(promoted),'attempted':min(8,len(todo)),'warnings':warnings}
