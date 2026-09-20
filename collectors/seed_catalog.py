from __future__ import annotations
from urllib.parse import urlparse
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord, OfferRecord
from pipeline.curation import classify

MANUFACTURER_DOMAINS={
    'perrin.com','jacksonracing.com','flyinmiata.com','apexwheels.com','continentaltire.com','koyorad.com'
}

def source_type(url:str)->str:
    host=urlparse(url).netloc.lower().removeprefix('www.')
    return 'manufacturer' if host in MANUFACTURER_DOMAINS else 'retailer'

def observed_timestamp(value):
    if not value:
        return None
    text=str(value).strip()
    if len(text)==10:
        return f'{text}T00:00:00Z'
    return text

class SeedCatalogCollector(BaseCollector):
    name='seed_catalog'
    def run(self, parts):
        sources=[]; offers=[]; warnings=[]
        for p in parts:
            url=p.get('fitment_source_url') or p.get('official_url')
            if url:
                st=source_type(url)
                confidence=float(p.get('fitment_confidence',.6))
                sources.append(SourceRecord.make(
                    part_id=p['id'], source_type=st, url=url,
                    title=f"{p.get('brand','')} {p.get('name','')} fitment/product source".strip(),
                    outlet=urlparse(url).netloc.lower().removeprefix('www.'),
                    summary=p.get('description',''), confidence=min(1,max(0,confidence)),
                    metadata={
                        'labels':classify(p.get('name',''),p.get('description','')),
                        'catalog_seed':True,'fitment_status':p.get('fitment_status','unknown'),
                        'vehicle_id':p.get('vehicle_id'),'manufacturer_part_number':p.get('manufacturer_part_number')
                    }
                ))
            ph=p.get('price_hint') or {}
            if ph.get('url') and ph.get('vendor'):
                try:
                    price=float(ph['price']) if ph.get('price') is not None else None
                except (TypeError,ValueError):
                    price=None; warnings.append(f"{p['id']}: invalid price_hint")
                kwargs={
                    'part_id':p['id'],'vendor':str(ph['vendor']),'url':str(ph['url']),'price':price,
                    'currency':ph.get('currency','USD'),'in_stock':ph.get('in_stock'),
                    'metadata':{'catalog_seed':True,'observed_at':ph.get('observed_at'),'price_type':'observed_snapshot'}
                }
                ts=observed_timestamp(ph.get('observed_at'))
                if ts:
                    kwargs['retrieved_at']=ts
                offers.append(OfferRecord.make(**kwargs))
        return CollectorResult(self.name,sources,offers,warnings,{'count':len(parts),'source_count':len(sources),'offer_count':len(offers)})
