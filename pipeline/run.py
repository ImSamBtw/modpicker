from __future__ import annotations
import json, os, math
from pathlib import Path
from urllib.parse import urlparse
from pipeline.store import JsonStore
from pipeline.models import ReviewItem, now_iso
from collectors.curated import CuratedCollector
from collectors.seed_catalog import SeedCatalogCollector
from collectors.youtube import YouTubeCollector
from collectors.reddit import RedditCollector
from collectors.ebay import EbayCollector
from collectors.web_product import WebProductCollector
from collectors.catalog_discovery import CatalogDiscoveryCollector
from collectors.promotion import PromotionCollector
from collectors.vehicles import VehicleCollector
from pipeline.scoring import score_sources

ROOT=Path(__file__).resolve().parents[1]
os.chdir(ROOT)
SOURCE_PRIORITY={'manufacturer':100,'professional_review':90,'retailer':80,'forum':60,'youtube':55,'reddit':50}

def load(path, default):
    p=Path(path); return json.loads(p.read_text()) if p.exists() else default

def load_catalog():
    rows=[]
    for path in [Path('data/seed/parts.json'),*sorted(Path('data/seed').glob('*_parts.json')),Path('data/manual/parts.json')]:
        rows.extend(load(path,[]))
    rows.extend(load('data/live/auto_parts.json',[]))
    by_id={}
    for row in rows:
        if isinstance(row,dict) and row.get('id'): by_id[row['id']]=row
    return list(by_id.values())

def product_page_rows(parts):
    rows=list(load('config/product_pages.json',[]))
    policies=load('config/product_domains.json',[])
    by_domain={str(x.get('domain','')).lower().removeprefix('www.'):x for x in policies if x.get('domain')}
    for p in parts:
        ph=p.get('price_hint') or {}; url=ph.get('url')
        if not url: continue
        host=urlparse(url).netloc.lower().removeprefix('www.'); policy=by_domain.get(host)
        if not policy or not policy.get('allow_scrape'): continue
        rows.append({'part_id':p['id'],'url':url,'vendor':ph.get('vendor') or policy.get('vendor') or host,'title':f"{p.get('brand','')} {p.get('name','')} product page".strip(),'allow_scrape':True,'mpn':p.get('manufacturer_part_number')})
    dedup={}
    for row in rows:
        if row.get('part_id') and row.get('url'): dedup[(row['part_id'],row['url'])]=row
    return list(dedup.values())

def dedupe(records):
    seen={}
    for r in records: seen[r.id]=r
    return list(seen.values())

def dedupe_sources(records):
    """Match the DB uniqueness rule: one canonical source per (part_id, URL).
    Prefer primary/manufacturer evidence, then merge collector metadata into it.
    """
    groups={}
    for r in records:
        key=(r.part_id,r.url)
        if key not in groups:
            groups[key]=r; continue
        current=groups[key]
        current_rank=(SOURCE_PRIORITY.get(current.source_type,40),float(current.confidence or 0),bool(current.metadata.get('catalog_seed')))
        incoming_rank=(SOURCE_PRIORITY.get(r.source_type,40),float(r.confidence or 0),bool(r.metadata.get('catalog_seed')))
        keep,extra=(r,current) if incoming_rank>current_rank else (current,r)
        keep.metadata={**(extra.metadata or {}),**(keep.metadata or {}),'merged_source_types':sorted(set([current.source_type,r.source_type]))}
        keep.confidence=max(float(current.confidence or 0),float(r.confidence or 0))
        if not keep.summary and extra.summary: keep.summary=extra.summary
        if not keep.title and extra.title: keep.title=extra.title
        groups[key]=keep
    return list(groups.values())

def validate_records(sources, offers):
    reviews=[]
    for r in sources:
        if not r.url.startswith(('http://','https://')): reviews.append(ReviewItem.make('source',r.id,'invalid URL',{'url':r.url},'high'))
        if not 0 <= r.confidence <= 1: reviews.append(ReviewItem.make('source',r.id,'confidence outside 0..1',{'confidence':r.confidence},'high'))
        if r.confidence < .45: reviews.append(ReviewItem.make('source',r.id,'low source confidence',{'title':r.title,'confidence':r.confidence},'low'))
    for o in offers:
        if not o.url.startswith(('http://','https://')): reviews.append(ReviewItem.make('offer',o.id,'invalid URL',{'url':o.url},'high'))
        if o.price is not None and (not math.isfinite(o.price) or o.price <= 0 or o.price > 100000): reviews.append(ReviewItem.make('offer',o.id,'implausible price',{'price':o.price},'medium'))
    return reviews

def build_status(results, sources, offers, reviews, history, candidates, parts, platforms, vehicles):
    return {'ok':not any(r.warnings for r in results if r.metadata.get('enabled',True)), 'mode':'deterministic_no_ai','generated_at':now_iso(),'catalog_part_count':len(parts),'platform_count':len(platforms),'vehicle_count':len(vehicles),'candidate_count':len(candidates),'source_count':len(sources),'offer_count':len(offers),'price_history_count':len(history),'review_queue_count':len(reviews),'collectors':{r.name:{**r.metadata,'warnings':r.warnings} for r in results},'credentials':{k:bool(os.getenv(k)) for k in ['YOUTUBE_API_KEY','REDDIT_CLIENT_ID','REDDIT_CLIENT_SECRET','EBAY_CLIENT_ID','EBAY_CLIENT_SECRET','CLOUDFLARE_ACCOUNT_ID','CLOUDFLARE_API_TOKEN']}}

def collect_safely(collector, *args, **kwargs):
    from collectors.base import CollectorResult
    try: return collector.run(*args, **kwargs)
    except Exception as exc:
        return CollectorResult(collector.name,[],[],[f'Collector failed: {type(exc).__name__}'],{'enabled':True,'failed':True})

def main():
    parts=load_catalog(); store=JsonStore()
    platforms=[]
    for path in [Path('config/platforms.json'),Path('data/manual/platforms.json')]:
        platforms.extend(load(path,[]))
    by_platform={p.get('id'):p for p in platforms if p.get('id')}
    platforms=list(by_platform.values())
    manual_vehicles=load('data/manual/vehicles.json',[])
    existing_vehicles=store.read('vehicles.json',[])
    vehicle_by_id={v.get('id'):v for v in existing_vehicles if v.get('id')}
    for v in manual_vehicles: vehicle_by_id[v['id']]=v
    existing_vehicles=list(vehicle_by_id.values())
    existing_sources=store.read('sources.json',[]); youtube_state=store.read('youtube_search_state.json',{}); retailer_rows=product_page_rows(parts)
    youtube=YouTubeCollector(); youtube_result=youtube.run(parts,existing_sources=existing_sources,search_state=youtube_state)
    results=[CuratedCollector().run(),SeedCatalogCollector().run(parts),youtube_result,collect_safely(RedditCollector(),parts),collect_safely(EbayCollector(),parts),WebProductCollector().run(retailer_rows,existing_sources=existing_sources,refresh_hours=24)]
    candidates,candidate_warnings,candidate_meta=CatalogDiscoveryCollector(timeout=8).run()
    results.append(type('CatalogResult',(),{'name':'catalog_discovery','metadata':candidate_meta,'warnings':candidate_warnings})())
    sources=dedupe_sources([x for r in results if hasattr(r,'sources') for x in r.sources]); offers=dedupe([x for r in results if hasattr(r,'offers') for x in r.offers])
    promoted,promotion_state,promotion_meta=PromotionCollector(timeout=8).run(candidates,parts,store.read('promotion_state.json',{}))
    auto={p['id']:p for p in store.read('auto_parts.json',[])}
    for p in promoted: auto[p['id']]=p
    store.write('auto_parts.json',list(auto.values())); store.write('promotion_state.json',promotion_state)
    if promoted:
        parts.extend(promoted)
        new_result=SeedCatalogCollector().run(promoted); sources.extend(new_result.sources); offers.extend(new_result.offers)
    results.append(type('Result',(),{'name':'automatic_publication','metadata':promotion_meta,'warnings':promotion_meta['warnings']})())
    vehicles,vehicle_state,vehicle_meta=VehicleCollector(timeout=10).run(existing_vehicles,store.read('vehicle_state.json',{}))
    store.write('vehicles.json',vehicles); store.write('vehicle_state.json',vehicle_state)
    results.append(type('Result',(),{'name':'vehicles','metadata':vehicle_meta,'warnings':vehicle_meta['warnings']})())
    reviews=validate_records(sources,offers)
    # Quarantine invalid records instead of merely logging them.
    bad={r.entity_id for r in reviews if r.severity in ('high','medium')}
    sources_json=store.upsert('sources.json',[s for s in sources if s.id not in bad]); offers_json=store.upsert('offers.json',[o for o in offers if o.id not in bad]); review_json=store.upsert('review_queue.json',reviews)
    for p in parts: p['ranking']=score_sources([s for s in sources_json if s.get('part_id')==p['id']])
    old_candidates={c['id']:c for c in store.read('catalog_candidates.json',[])}
    for c in candidates:
        old=old_candidates.get(c['id'],{})
        if old.get('status')=='published_unverified': c['status']=old['status'];c['metadata']={**c['metadata'],**old.get('metadata',{})}
        old_candidates[c['id']]=c
    candidates_json=list(old_candidates.values()); store.write('catalog_candidates.json',candidates_json); store.write('youtube_search_state.json',youtube.search_state)
    history=store.read('price_history.json',[])
    existing={(x.get('offer_id'),x.get('captured_at','')[:10]) for x in history}
    for o in offers_json:
        captured=o.get('retrieved_at') or now_iso(); captured_day=str(captured)[:10]
        if o.get('price') is not None and (o.get('id'),captured_day) not in existing:
            history.append({'id':f"{o['id']}:{captured_day}",'offer_id':o['id'],'part_id':o.get('part_id'),'vendor':o.get('vendor'),'price':o.get('price'),'shipping':o.get('shipping'),'in_stock':o.get('in_stock'),'captured_at':captured})
            existing.add((o.get('id'),captured_day))
    history=history[-20000:]; store.write('price_history.json',history); store.write('catalog.json',parts)
    status=build_status(results,sources_json,offers_json,review_json,history,candidates_json,parts,platforms,vehicles); store.write('status.json',status)
    from pipeline.export_js import export_js
    export_js(parts,sources_json,offers_json,status,vehicles=vehicles,platforms=platforms); print(json.dumps(status,indent=2))

if __name__=='__main__': main()
