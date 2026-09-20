from __future__ import annotations
import json, re, urllib.robotparser
from pathlib import Path
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup
from .base import BaseCollector
from pipeline.models import stable_id, now_iso

PRICE_RE=re.compile(r'\$\s*([0-9][0-9,]*(?:\.[0-9]{2})?)')
GENERIC_TITLES={
    'accessories','aerodynamics','brakes','chassis','cooling','drivetrain','engine','exhaust',
    'interior','maintenance','suspension','wheels','coilovers','springs','sway bars','brake pads',
    'brake lines','brake fluid','radiators','oil coolers','headers','cat backs','intake / air filters',
    'big brake kits','control arms','bushings','limited slip differential','supercharger kits','turbocharger kits'
}

class CatalogDiscoveryCollector(BaseCollector):
    name='catalog_discovery'

    def __init__(self, timeout=8):
        super().__init__(timeout=timeout)
        self._robots_cache={}

    def allowed(self,url):
        u=urlparse(url)
        origin=f'{u.scheme}://{u.netloc}'
        robots=f'{origin}/robots.txt'
        if origin in self._robots_cache:
            rp=self._robots_cache[origin]
            return bool(rp and rp.can_fetch('ModPickerBot',url))
        try:
            r=self.session.get(robots,timeout=15)
            if r.status_code >= 400:
                self._robots_cache[origin]=None
                return False
            rp=urllib.robotparser.RobotFileParser(); rp.set_url(robots); rp.parse(r.text.splitlines())
            self._robots_cache[origin]=rp
            return rp.can_fetch('ModPickerBot',url)
        except Exception:
            self._robots_cache[origin]=None
            return False

    def candidate_allowed(self,cfg,title,full,price):
        low=title.strip().lower()
        if cfg.get('reject_generic_titles',True) and low in GENERIC_TITLES and price is None:
            return False
        any_terms=[str(x).lower() for x in cfg.get('title_any',[]) if str(x).strip()]
        if any_terms and not any(x in low for x in any_terms):
            return False
        none_terms=[str(x).lower() for x in cfg.get('title_none',[]) if str(x).strip()]
        if any(x in low for x in none_terms):
            return False
        require_url=cfg.get('url_regex')
        if require_url and not re.search(require_url,full,re.I):
            return False
        reject_url=cfg.get('reject_url_regex')
        if reject_url and re.search(reject_url,full,re.I):
            return False
        if cfg.get('require_price') and price is None:
            return False
        return True

    def run(self, config='config/catalog_sources.json'):
        rows=json.loads(Path(config).read_text()) if Path(config).exists() else []
        found={}; warnings=[]; checked=0; filtered=0
        for cfg in rows:
            if not cfg.get('allow_scrape'):
                continue
            url=cfg['url']
            if not self.allowed(url):
                warnings.append(f'robots denied/unavailable: {url}')
                continue
            try:
                r=self.get(url); checked+=1; soup=BeautifulSoup(r.text,'html.parser')
                needle=cfg.get('product_path_contains','/products/')
                source_limit=max(1,int(cfg.get('max_candidates',125)))
                source_count=0
                for a in soup.find_all('a',href=True):
                    if source_count >= source_limit:
                        break
                    href=a.get('href','')
                    if needle not in href:
                        continue
                    full=urljoin(url,href.split('#')[0])
                    title=' '.join(a.stripped_strings).strip()
                    if len(title)<4:
                        title=(a.get('title') or a.get('aria-label') or '').strip()
                    if len(title)<4:
                        continue
                    title=re.sub(r'\s+',' ',title)[:240]
                    text=' '.join((a.parent or a).stripped_strings)
                    m=PRICE_RE.search(text)
                    price=float(m.group(1).replace(',','')) if m else None
                    if not self.candidate_allowed(cfg,title,full,price):
                        filtered+=1
                        continue
                    cid=stable_id(cfg['vehicle_id'],full)
                    if cid in found:
                        continue
                    found[cid]={
                        'id':cid,'vehicle_id':cfg['vehicle_id'],'vendor':cfg['vendor'],
                        'title':title,'url':full,'source_url':url,'observed_price':price,
                        'currency':'USD','fitment_confidence':float(cfg.get('fitment_confidence',.55)),
                        'status':'pending','metadata':{
                            'discovered_by':'catalog_discovery','collection_url':url,
                            'discovery_policy':cfg.get('policy_name','default')
                        },
                        'discovered_at':now_iso(),'updated_at':now_iso()
                    }
                    source_count+=1
            except Exception as e:
                warnings.append(f'{url}: {type(e).__name__}: {e}')
        return list(found.values()),warnings,{
            'enabled':True,'pages_checked':checked,'candidate_count':len(found),'filtered_count':filtered,
            'robots_origins_checked':len(self._robots_cache),'timeout_seconds':self.timeout,
        }
