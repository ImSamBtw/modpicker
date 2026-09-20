"""Publication gate for automated refreshes."""
import json, math
from pathlib import Path
from pipeline.applications import application_matches, load_applications

def validate(root=Path('data/live')):
    parts=json.loads((root/'catalog.json').read_text()); sources=json.loads((root/'sources.json').read_text()); offers=json.loads((root/'offers.json').read_text())
    applications=load_applications()
    ids={p['id'] for p in parts}; assert len(ids)==len(parts), 'Duplicate part IDs'
    rules_path=root/'fitment_rules.json'
    if rules_path.exists():
        rules=json.loads(rules_path.read_text())
        rule_ids=[r.get('id') for r in rules]
        assert len(rule_ids)==len(set(rule_ids)), 'Duplicate fitment rules'
        for rule in rules:
            assert rule.get('source_url','').startswith(('http://','https://')), 'Fitment rule missing source'
            assert rule.get('selector'), 'Fitment rule has empty selector'
            assert any(application_matches(app,rule['selector']) for app in applications), f"Fitment rule matches no application: {rule.get('id')}"
            assert all(part_id in ids for part_id in (rule.get('part_ids') or [])), f"Fitment rule references unknown part: {rule.get('id')}"
    vehicles={v['id'] for v in json.loads((root/'vehicles.json').read_text())}
    for p in parts:
        fits=p.get('fitments',[])
        assert len({f['vehicle_id'] for f in fits})==len(fits), 'Duplicate fitments'
        for f in fits:
            assert f['vehicle_id'] in vehicles, 'Unknown fitment vehicle'
            assert math.isfinite(f['confidence']) and 0<=f['confidence']<=1
            if f['fitment_status']=='verified': assert f.get('source_url'), 'Missing fitment evidence'
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
