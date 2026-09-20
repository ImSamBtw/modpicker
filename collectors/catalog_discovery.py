from __future__ import annotations
import json, re, urllib.robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from .base import BaseCollector
from pipeline.models import stable_id, now_iso

PRICE_RE=re.compile(r'\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)')

class CatalogDiscoveryCollector(BaseCollector):
    name='catalog_discovery'
    def allowed(self,url):
        u=urlparse(url); robots=f'{u.scheme}://{u.netloc}/robots.txt'
        try:
            rp=urllib.robotparser.RobotFileParser(); rp.set_url(robots); rp.read()
            return rp.can_fetch(self.session.headers['User-Agent'],url)
        except Exception:
            return False

    def run(self, config='config/catalog_sources.json'):
        rows=json.loads(Path(config).read_text()) if Path(config).exists() else []
        found={}; warnings=[]; checked=0
        for cfg in rows:
            if not cfg.get('allow_scrape'): continue
            url=cfg['url']
            if not self.allowed(url):
                warnings.append(f'robots denied/unavailable: {url}'); continue
            try:
                r=self.get(url); checked+=1; soup=BeautifulSoup(r.text,'html.parser')
                needle=cfg.get('product_path_contains','/products/')
                for a in soup.find_all('a',href=True):
                    href=a.get('href','')
                    if needle not in href: continue
                    full=urljoin(url,href.split('#')[0])
                    title=' '.join(a.stripped_strings).strip()
                    if len(title)<4: title=(a.get('title') or a.get('aria-label') or '').strip()
                    if len(title)<4: continue
                    title=re.sub(r'\s+',' ',title)[:240]
                    text=' '.join((a.parent or a).stripped_strings)
                    m=PRICE_RE.search(text)
                    price=float(m.group(1).replace(',','')) if m else None
                    cid=stable_id(cfg['vehicle_id'],full)
                    found[cid]={
                        'id':cid,'vehicle_id':cfg['vehicle_id'],'vendor':cfg['vendor'],
                        'title':title,'url':full,'source_url':url,'observed_price':price,
                        'currency':'USD','fitment_confidence':float(cfg.get('fitment_confidence',.55)),
                        'status':'pending','metadata':{'discovered_by':'catalog_discovery','collection_url':url},
                        'discovered_at':now_iso(),'updated_at':now_iso()
                    }
            except Exception as e:
                warnings.append(f'{url}: {type(e).__name__}: {e}')
        return list(found.values()),warnings,{'enabled':True,'pages_checked':checked,'candidate_count':len(found)}
