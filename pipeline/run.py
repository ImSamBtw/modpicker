from __future__ import annotations
import json, os
from pathlib import Path
from pipeline.store import JsonStore
from pipeline.models import ReviewItem, now_iso
from collectors.curated import CuratedCollector
from collectors.seed_catalog import SeedCatalogCollector
from collectors.youtube import YouTubeCollector
from collectors.reddit import RedditCollector
from collectors.ebay import EbayCollector
from collectors.web_product import WebProductCollector
from collectors.catalog_discovery import CatalogDiscoveryCollector
from curators.cloudflare_ai import CloudflareCurator

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)

def load(path, default):
    p=Path(path); return json.loads(p.read_text()) if p.exists() else default

def load_catalog():
    rows=[]
    for path in [Path('data/seed/parts.json'),*sorted(Path('data/seed').glob('*_parts.json'))]:
        rows.extend(load(path,[]))
    by_id={}
    for row in rows:
        if isinstance(row,dict) and row.get('id'): by_id[row['id']]=row
    return list(by_id.values())

def dedupe(records):
    seen={}
    for r in records: seen[r.id]=r
    return list(seen.values())

def validate_records(sources, offers):
    reviews=[]
    for r in sources:
        if not r.url.startswith(('http://','https://')):
            reviews.append(ReviewItem.make('source',r.id,'invalid URL',{'url':r.url},'high'))
        if not 0 <= r.confidence <= 1:
            reviews.append(ReviewItem.make('source',r.id,'confidence outside 0..1',{'confidence':r.confidence},'high'))
        if r.confidence < .45:
            reviews.append(ReviewItem.make('source',r.id,'low source confidence',{'title':r.title,'confidence':r.confidence},'low'))
    for o in offers:
        if not o.url.startswith(('http://','https://')):
            reviews.append(ReviewItem.make('offer',o.id,'invalid URL',{'url':o.url},'high'))
        if o.price is not None and (o.price <= 0 or o.price > 100000):
            reviews.append(ReviewItem.make('offer',o.id,'implausible price',{'price':o.price},'medium'))
    return reviews

def build_status(results, sources, offers, reviews, history, candidates, parts):
    return {
      'ok': True,
      'generated_at': now_iso(),
      'catalog_part_count':len(parts),'candidate_count':len(candidates),
      'source_count': len(sources), 'offer_count':len(offers), 'price_history_count':len(history), 'review_queue_count':len(reviews),
      'collectors': {r.name:{**r.metadata,'warnings':r.warnings} for r in results},
      'credentials': {k:bool(os.getenv(k)) for k in ['YOUTUBE_API_KEY','REDDIT_CLIENT_ID','REDDIT_CLIENT_SECRET','EBAY_CLIENT_ID','EBAY_CLIENT_SECRET','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']}
    }

def main():
    parts=load_catalog()
    retailer_rows=load('config/product_pages.json',[])
    store=JsonStore()
    existing_sources=store.read('sources.json',[])
    results=[
        CuratedCollector().run(),
        SeedCatalogCollector().run(parts),
        YouTubeCollector().run(parts,existing_sources=existing_sources),
        RedditCollector().run(parts),
        EbayCollector().run(parts),
        WebProductCollector().run(retailer_rows)
    ]
    candidates,candidate_warnings,candidate_meta=CatalogDiscoveryCollector().run()
    results.append(type('CatalogResult',(),{'name':'catalog_discovery','metadata':candidate_meta,'warnings':candidate_warnings})())
    sources=dedupe([x for r in results if hasattr(r,'sources') for x in r.sources])
    offers=dedupe([x for r in results if hasattr(r,'offers') for x in r.offers])

    ai=CloudflareCurator(); ai_warnings=[]; ai_count=0
    if ai.enabled:
        for record in sources[:50]:
            try:
                annotation=ai.curate(record)
                if annotation:
                    record.metadata['ai']=annotation; ai_count+=1
            except Exception as e:
                ai_warnings.append(f'{record.id}: {type(e).__name__}: {e}')
    results.append(type('AIResult',(),{'name':'cloudflare_ai','metadata':{'enabled':ai.enabled,'count':ai_count},'warnings':ai_warnings})())

    reviews=validate_records(sources,offers)
    sources_json=store.upsert('sources.json',sources)
    offers_json=store.upsert('offers.json',offers)
    review_json=store.upsert('review_queue.json',reviews)
    candidates_json=store.upsert('catalog_candidates.json',candidates)

    history=store.read('price_history.json',[])
    day=now_iso()[:10]
    existing={(x.get('offer_id'),x.get('captured_at','')[:10]) for x in history}
    for o in offers_json:
        if o.get('price') is not None and (o.get('id'),day) not in existing:
            history.append({'id':f"{o['id']}:{day}",'offer_id':o['id'],'part_id':o.get('part_id'),'vendor':o.get('vendor'),'price':o.get('price'),'shipping':o.get('shipping'),'in_stock':o.get('in_stock'),'captured_at':now_iso()})
    history=history[-20000:]
    store.write('price_history.json',history)
    store.write('catalog.json',parts)

    status=build_status(results,sources_json,offers_json,review_json,history,candidates_json,parts)
    store.write('status.json',status)
    from pipeline.export_js import export_js
    export_js(parts,sources_json,offers_json,status)
    print(json.dumps(status,indent=2))

if __name__=='__main__': main()
