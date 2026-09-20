from __future__ import annotations
import os
from datetime import datetime, timezone, timedelta
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord, now_iso
from pipeline.curation import classify

STOP={'the','and','for','with','kit','set','system','performance','sport','series','high','front','rear'}

def dt(value):
    try: return datetime.fromisoformat(str(value).replace('Z','+00:00'))
    except Exception: return datetime(1970,1,1,tzinfo=timezone.utc)

def tokens(part):
    raw=f"{part.get('brand','')} {part.get('name','')}"
    return {x.lower() for x in raw.replace('/',' ').replace('-',' ').split() if len(x)>=3 and x.lower() not in STOP}

def is_quota_error(exc):
    text=str(exc).lower()
    return any(x in text for x in ('429','quota','403 client error','rate limit'))

class YouTubeCollector(BaseCollector):
    name='youtube'

    def run(self, parts, existing_sources=None, search_state=None, max_searches=25, refresh_days=7):
        key=os.getenv('YOUTUBE_API_KEY')
        if not key:
            self.search_state=search_state or {}
            return CollectorResult(self.name,[],[],['YOUTUBE_API_KEY not configured'],{'enabled':False})

        existing_sources=existing_sources or []
        state=dict(search_state or {})
        cutoff=datetime.now(timezone.utc)-timedelta(days=refresh_days)
        fresh_sources={
            s.get('part_id') for s in existing_sources
            if s.get('source_type')=='youtube' and dt(s.get('retrieved_at'))>=cutoff
        }
        fresh_attempts={
            part_id for part_id,entry in state.items()
            if dt((entry or {}).get('last_attempt'))>=cutoff
        }

        out=[]; warnings=[]; calls=0; skipped=0; quota_stopped=False
        for p in parts:
            part_id=p['id']
            if part_id in fresh_sources or part_id in fresh_attempts:
                skipped+=1
                continue
            if calls>=max_searches:
                break

            query=f"{p.get('brand','')} {p.get('name','')} {p.get('vehicle_query','')} install review".strip()
            wanted=tokens(p)
            accepted=0
            try:
                calls+=1
                r=self.get(
                    'https://www.googleapis.com/youtube/v3/search',
                    params={
                        'key':key,'part':'snippet','type':'video','maxResults':5,'q':query,
                        'safeSearch':'moderate','order':'relevance'
                    }
                )
                payload=r.json()
                if payload.get('error'):
                    raise RuntimeError(str(payload['error']))
                for item in payload.get('items',[]):
                    vid=item.get('id',{}).get('videoId'); sn=item.get('snippet',{})
                    if not vid:
                        continue
                    title=sn.get('title',''); desc=sn.get('description',''); hay=f'{title} {desc}'.lower()
                    overlap=sum(1 for t in wanted if t in hay)
                    if wanted and overlap<1:
                        continue
                    conf=min(.82,.56+.05*min(overlap,5))
                    out.append(SourceRecord.make(
                        part_id=part_id,source_type='youtube',url=f'https://www.youtube.com/watch?v={vid}',
                        title=title,outlet=sn.get('channelTitle',''),published_at=sn.get('publishedAt'),
                        summary=(desc[:500] if desc else 'YouTube result discovered by the ModPicker collector.'),confidence=conf,
                        metadata={
                            'video_id':vid,
                            'thumbnail':sn.get('thumbnails',{}).get('medium',{}).get('url'),
                            'labels':classify(title,desc),'query':query,'token_overlap':overlap
                        }
                    ))
                    accepted+=1
                state[part_id]={
                    'last_attempt':now_iso(),
                    'status':'ok',
                    'result_count':accepted,
                    'query':query,
                }
            except Exception as e:
                warnings.append(f"{part_id}: {type(e).__name__}: {e}")
                if is_quota_error(e):
                    quota_stopped=True
                    break
                state[part_id]={
                    'last_attempt':now_iso(),
                    'status':'error',
                    'result_count':0,
                    'error_type':type(e).__name__,
                    'query':query,
                }

        self.search_state=state
        return CollectorResult(
            self.name,out,[],warnings,
            {
                'enabled':True,
                'search_calls':calls,
                'count':len(out),
                'fresh_parts_skipped':skipped,
                'refresh_days':refresh_days,
                'max_searches':max_searches,
                'search_state_entries':len(state),
                'quota_stopped':quota_stopped,
            }
        )
