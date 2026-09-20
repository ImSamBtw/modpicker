import os, time
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord
from pipeline.curation import classify
class RedditCollector(BaseCollector):
    name='reddit'
    def token(self):
        cid=os.getenv('REDDIT_CLIENT_ID'); secret=os.getenv('REDDIT_CLIENT_SECRET')
        if not cid or not secret: return None
        ua=os.getenv('REDDIT_USER_AGENT','ModPicker/0.1 by ImSamBtw')
        r=self.session.post('https://www.reddit.com/api/v1/access_token',auth=(cid,secret),data={'grant_type':'client_credentials'},headers={'User-Agent':ua},timeout=self.timeout); r.raise_for_status(); return r.json()['access_token'],ua
    def run(self, parts):
        auth=self.token()
        if not auth: return CollectorResult(self.name,[],[],['Reddit OAuth secrets not configured'],{'enabled':False})
        token,ua=auth; out=[]; warnings=[]; headers={'Authorization':f'bearer {token}','User-Agent':ua}
        for p in parts[:40]:
            try:
                r=self.get('https://oauth.reddit.com/search',headers=headers,params={'q':f"{p['brand']} {p['name']}",'sort':'relevance','limit':8,'type':'link'})
                for child in r.json().get('data',{}).get('children',[]):
                    d=child.get('data',{}); per=d.get('permalink'); title=d.get('title','')
                    if not per: continue
                    out.append(SourceRecord.make(part_id=p['id'],source_type='reddit',url='https://www.reddit.com'+per,title=title,outlet='r/'+d.get('subreddit',''),published_at=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime(d.get('created_utc',0))),summary='Reddit thread metadata only; ModPicker does not retain post/comment bodies.',confidence=.55,metadata={'reddit_id':d.get('name'),'score':d.get('score'),'comment_count':d.get('num_comments'),'labels':classify(title),'retention':'metadata-only'}))
            except Exception as e: warnings.append(f"{p['id']}: {type(e).__name__}: {e}")
        return CollectorResult(self.name,out,[],warnings,{'enabled':True,'count':len(out)})
