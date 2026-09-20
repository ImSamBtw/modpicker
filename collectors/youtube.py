import os
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord
from pipeline.curation import classify
class YouTubeCollector(BaseCollector):
    name='youtube'
    def run(self, parts):
        key=os.getenv('YOUTUBE_API_KEY')
        if not key: return CollectorResult(self.name,[],[],['YOUTUBE_API_KEY not configured'],{'enabled':False})
        out=[]; warnings=[]; calls=0
        for p in parts[:30]:
            query=f"{p['brand']} {p['name']} {p.get('vehicle_query','')} install review".strip()
            try:
                r=self.get('https://www.googleapis.com/youtube/v3/search',params={'key':key,'part':'snippet','type':'video','maxResults':5,'q':query,'safeSearch':'moderate'}); calls+=1
                for item in r.json().get('items',[]):
                    vid=item.get('id',{}).get('videoId'); sn=item.get('snippet',{})
                    if not vid: continue
                    title=sn.get('title','')
                    out.append(SourceRecord.make(part_id=p['id'],source_type='youtube',url=f'https://www.youtube.com/watch?v={vid}',title=title,outlet=sn.get('channelTitle',''),published_at=sn.get('publishedAt'),summary='YouTube result discovered by the ModPicker collector.',confidence=.62,metadata={'video_id':vid,'thumbnail':sn.get('thumbnails',{}).get('medium',{}).get('url'),'labels':classify(title)}))
            except Exception as e: warnings.append(f"{p['id']}: {type(e).__name__}: {e}")
        return CollectorResult(self.name,out,[],warnings,{'enabled':True,'search_calls':calls,'count':len(out)})
