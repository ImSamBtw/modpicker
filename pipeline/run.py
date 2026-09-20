import json, os
from pathlib import Path
from pipeline.store import JsonStore
from pipeline.models import ReviewItem, now_iso
from collectors.curated import CuratedCollector
from collectors.youtube import YouTubeCollector
from collectors.reddit import RedditCollector
from collectors.ebay import EbayCollector
from collectors.web_product import WebProductCollector
from curators.cloudflare_ai import CloudflareCurator
ROOT=Path(__file__).resolve().parents[1]; os.chdir(ROOT)
def load(path,default):
    p=Path(path); return json.loads(p.read_text()) if p.exists() else default
def dedupe(records):
    seen={}
    for r in records: seen[r.id]=r
    return list(seen.values())
def validate_sources(records):
    reviews=[]
    for r in records:
        if not r.url.startswith('http'): reviews.append(ReviewItem.make('source',r.id,'invalid URL',{'url':r.url},'high'))
        if not 0<=r.confidence<=1: reviews.append(ReviewItem.make('source',r.id,'confidence outside 0..1',{'confidence':r.confidence},'high'))
    return reviews
def main():
    parts=load('data/seed/parts.json',[]); retailer_rows=load('config/product_pages.json',[])
    results=[CuratedCollector().run(),YouTubeCollector().run(parts),RedditCollector().run(parts),EbayCollector().run(parts),WebProductCollector().run(retailer_rows)]
    sources=dedupe([x for r in results for x in r.sources]); offers=dedupe([x for r in results for x in r.offers])
    ai=CloudflareCurator(); ai_warnings=[]; ai_count=0
    if ai.enabled:
        for record in sources[:30]:
            try:
                annotation=ai.curate(record)
                if annotation: record.metadata['ai']=annotation; ai_count+=1
            except Exception as e: ai_warnings.append(f'{record.id}: {type(e).__name__}: {e}')
    results.append(type('AIResult',(),{'name':'cloudflare_ai','metadata':{'enabled':ai.enabled,'count':ai_count},'warnings':ai_warnings})())
    reviews=validate_sources(sources); store=JsonStore(); sources_json=store.upsert('sources.json',sources); offers_json=store.upsert('offers.json',offers); review_json=store.upsert('review_queue.json',reviews)
    status={'ok':True,'generated_at':now_iso(),'source_count':len(sources_json),'offer_count':len(offers_json),'review_queue_count':len(review_json),'collectors':{r.name:{**r.metadata,'warnings':r.warnings} for r in results},'credentials':{k:bool(os.getenv(k)) for k in ['YOUTUBE_API_KEY','REDDIT_CLIENT_ID','REDDIT_CLIENT_SECRET','EBAY_CLIENT_ID','EBAY_CLIENT_SECRET','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']}}
    store.write('status.json',status)
    from pipeline.export_js import export_js; export_js(parts,sources_json,offers_json,status)
    print(json.dumps(status,indent=2))
if __name__=='__main__': main()
