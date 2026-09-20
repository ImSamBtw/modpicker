from __future__ import annotations
import json
from pathlib import Path
from .models import serialize

class JsonStore:
    def __init__(self, root='data/live'):
        self.root = Path(root); self.root.mkdir(parents=True, exist_ok=True)
    def read(self, name, default):
        p=self.root/name
        if not p.exists(): return default
        try: return json.loads(p.read_text())
        except Exception: return default
    def write(self, name, data):
        tmp=self.root/(name+'.tmp')
        tmp.write_text(json.dumps(data, indent=2, sort_keys=True, allow_nan=False)+'\n'); tmp.replace(self.root/name)
    def upsert(self, name, records):
        current=self.read(name, [])
        by_id={x['id']:x for x in current if isinstance(x,dict) and x.get('id')}
        for rec in serialize(records):
            old=by_id.get(rec['id'])
            if old and name=='sources.json' and old.get('metadata',{}).get('collector')=='web_product' and not rec.get('metadata',{}).get('collector'): continue
            if old and str(old.get('retrieved_at','')) > str(rec.get('retrieved_at','')): continue
            by_id[rec['id']]=rec
        out=sorted(by_id.values(), key=lambda x:(x.get('part_id',''),x.get('source_type',x.get('vendor','')),x.get('id','')))
        self.write(name,out); return out
