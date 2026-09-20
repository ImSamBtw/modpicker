"""Publication gate for automated refreshes."""
import json, math
from pathlib import Path

def validate(root=Path('data/live')):
    parts=json.loads((root/'catalog.json').read_text()); sources=json.loads((root/'sources.json').read_text()); offers=json.loads((root/'offers.json').read_text())
    ids={p['id'] for p in parts}; assert len(ids)==len(parts), 'Duplicate part IDs'
    for p in parts:
        r=p['ranking']; assert r['methodology_version']=='published_reviews_v2'
        if r['overall'] is not None:
            assert r['metadata']['evidence'] and r['metadata']['review_count']>0
            assert math.isfinite(r['overall']) and 0<=r['overall']<=10
        for metric in ('quality','reliability','performance','handling','value'): assert r[metric] is None, 'Unsupported metric'
    for o in offers:
        assert o['part_id'] in ids
        if o.get('price') is not None: assert math.isfinite(o['price']) and 0<o['price']<100000
    print(f'Validated {len(parts)} canonical parts, {len(sources)} sources, {len(offers)} offers')
if __name__=='__main__': validate()
