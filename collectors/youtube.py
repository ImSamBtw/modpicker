from __future__ import annotations
import os
from datetime import datetime, timezone, timedelta
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord
from pipeline.curation import classify

STOP={'the','and','for','with','kit','set','system','performance','sport','series','high','front','rear'}

def dt(value):
    try: return datetime.fromisoformat(str(value).replace('Z','+00:00'))
    except Exception: return datetime(1970,1,1,tzinfo=timezone.utc)

def tokens(part):
    raw=f"{part.get('brand','')} {part.get('name','')}"
    return {x.lower() for x in raw.replace('/',' ').replace('-',' ').split() if len(x)>=3 and x.lower() not in STOP}

class YouTubeCollector(BaseCollector):
    name='youtube'
    def run(self, parts, existing_sources=None, max_searches=85, refresh_days=7):
        key=os.getenv('YOUTUBE_API_KEY')
        if not key: return CollectorResult(self.name,[],[],['YOUTUBE_API_KEY not configured'],{'enabled':False})
        existing_sources=existing_sources or []
        cutoff=datetime.now(timezone.utc)-timedelta(days=refresh_days)
        fresh={s.get('part_id') for s in existing_sources if s.get('source_type')=='youtube' and dt(s.get('retrieved_at'))>=cutoff}
        out=[]; warnings=[]; calls=0; skipped=0
        for p in parts:
            if p['id'] in fresh: skipped+=1; continue
            if calls>=max_searches: break
            query=f"{p.get('brand','')} {p.get('name','')} {p.get('vehicle_query','')} install review".strip()
            wanted=tokens(p)
            try:
                r=self.get('https://www.googleapis.com/youtube/v3/search',params={'key':key,'part':'snippet','type':'video','maxResults':5,'q':query,'safeSearch':'moderate','order':'relevance'}); calls+=1
                payload=r.json()
                if payload.get('error'): raise RuntimeError(str(payload['error']))
                for item in payload.get('items',[]):
                    vid=item.get('id',{}).get('videoId'); sn=item.get('snippet',{})
                    if not vid: continue
                    title=sn.get('title',''); desc=sn.get('description',''); hay=f'{title} {desc}'.lower()
                    overlap=sum(1 for t in wanted if t in hay)
                    if wanted and overlap<1: continue
                    conf=min(.82,.56+.05*min(overlap,5))
                    out.append(SourceRecord.make(
                        part_id=p['id'],source_type='youtube',url=f'https://www.youtube.com/watch?v={vid}',
                        title=title,outlet=sn.get('channelTitle',''),published_at=sn.get('publishedAt'),
                        summary=(desc[:500] if desc else 'YouTube result discovered by the ModPicker collector.'),confidence=conf,
                        metadata={'video_id':vid,'thumbnail':sn.get('thumbnails',{}).get('medium',{}).get('url'),'labels':classify(title,desc),'query':query,'token_overlap':overlap}
                    ))
            except Exception as e: warnings.append(f"{p['id']}: {type(e).__name__}: {e}")
        return CollectorResult(self.name,out,[],warnings,{'enabled':True,'search_calls':calls,'count':len(out),'fresh_parts_skipped':skipped,'refresh_days':refresh_days,'max_searches':max_searches})
