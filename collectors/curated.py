import json
from pathlib import Path
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord
from pipeline.curation import classify, source_weight
class CuratedCollector(BaseCollector):
    name='curated'
    def run(self, config='config/curated_sources.json'):
        rows=json.loads(Path(config).read_text()); out=[]
        for x in rows:
            st=x.get('source_type','forum'); summary=x.get('note','')
            out.append(SourceRecord.make(part_id=x['part_id'],source_type=st,url=x['url'],title=x['title'],outlet=x.get('outlet',''),summary=summary,confidence=x.get('confidence',source_weight(st)),metadata={'labels':classify(x['title'],summary),'curated':True}))
        return CollectorResult(self.name,out,[],[],{'count':len(out)})
