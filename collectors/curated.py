import json
from pathlib import Path
from .base import BaseCollector, CollectorResult
from pipeline.models import SourceRecord
from pipeline.curation import classify, source_weight

class CuratedCollector(BaseCollector):
    name='curated'
    def run(self, config='config/curated_sources.json'):
        base=Path(config)
        paths=[base]
        if base.name=='curated_sources.json':
            paths=[base,*sorted(base.parent.glob('curated_sources_*.json'))]
        rows=[]
        for path in paths:
            if path.exists():
                payload=json.loads(path.read_text())
                if isinstance(payload,list): rows.extend(payload)
        out={}
        for x in rows:
            st=x.get('source_type','forum'); summary=x.get('note','')
            record=SourceRecord.make(
                part_id=x['part_id'],source_type=st,url=x['url'],title=x['title'],outlet=x.get('outlet',''),
                summary=summary,confidence=x.get('confidence',source_weight(st)),
                metadata={'labels':classify(x['title'],summary),'curated':True,'curated_file':x.get('curated_file')}
            )
            out[record.id]=record
        return CollectorResult(self.name,list(out.values()),[],[],{'count':len(out),'files':len([p for p in paths if p.exists()])})
