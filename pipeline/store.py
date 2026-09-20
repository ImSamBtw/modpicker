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
        (self.root/name).write_text(json.dumps(data, indent=2, sort_keys=True)+'\n')
    def upsert(self, name, records):
        current=self.read(name, [])
        by_id={x['id']:x for x in current if isinstance(x,dict) and x.get('id')}
        for rec in serialize(records): by_id[rec['id']]=rec
        out=sorted(by_id.values(), key=lambda x:(x.get('part_id',''),x.get('source_type',x.get('vendor','')),x.get('id','')))
        self.write(name,out); return out
