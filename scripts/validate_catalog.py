"""Validate reviewable manual and platform catalog inputs before publication."""
from __future__ import annotations
import json, re
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
MANUAL = ROOT / 'data' / 'manual'

def read(path, default):
    p = ROOT / path
    return json.loads(p.read_text()) if p.exists() else default

def require_url(value, field, errors, allow_empty=False):
    if not value and allow_empty: return
    parsed = urlparse(str(value))
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        errors.append(f'{field}: expected an http(s) URL')

def validate():
    errors=[]
    vehicles=read('data/manual/vehicles.json',[])
    platforms=read('config/platforms.json',[])+read('data/manual/platforms.json',[])
    parts=read('data/manual/parts.json',[])
    def unique(rows,label):
        seen=set()
        for i,row in enumerate(rows):
            if not isinstance(row,dict): errors.append(f'{label}[{i}] must be an object'); continue
            ident=row.get('id')
            if not isinstance(ident,str) or not re.fullmatch(r'[a-z0-9][a-z0-9_-]{2,100}',ident): errors.append(f'{label}[{i}].id must be stable lowercase slug')
            elif ident in seen: errors.append(f'{label}: duplicate id {ident}')
            seen.add(ident)
    unique(vehicles,'vehicles'); unique(platforms,'platforms'); unique(parts,'parts')
    vehicle_ids={v.get('id') for v in vehicles if isinstance(v,dict)}
    platform_ids={p.get('id') for p in platforms if isinstance(p,dict)}
    for i,v in enumerate(vehicles):
        if not isinstance(v,dict): continue
        for key in ('year','make','model','trim'):
            if not v.get(key): errors.append(f'vehicles[{i}] missing {key}')
        if str(v.get('trim','')).lower()=='unspecified': errors.append(f'vehicles[{i}] exact manual vehicle cannot use Unspecified trim')
        if not isinstance(v.get('year'),int) or not 1886<=v.get('year',0)<=2100: errors.append(f'vehicles[{i}].year outside supported range')
        require_url((v.get('metadata') or {}).get('source_url'),'vehicles[%d].metadata.source_url'%i,errors,allow_empty=True)
    for i,p in enumerate(platforms):
        if not isinstance(p,dict): continue
        for key in ('make','name','display_name','type'):
            if not p.get(key): errors.append(f'platforms[{i}] missing {key}')
        if not isinstance(p.get('aliases'),list) or not p['aliases']: errors.append(f'platforms[{i}].aliases must be a nonempty list')
        if not isinstance(p.get('vehicle_ids'),list) or not p['vehicle_ids']: errors.append(f'platforms[{i}].vehicle_ids must be a nonempty list')
        for vehicle_id in p.get('vehicle_ids',[]):
            if vehicle_id not in vehicle_ids: errors.append(f'platforms[{i}] references manual vehicle not present: {vehicle_id}')
        if not isinstance(p.get('categories'),list) or not p['categories']: errors.append(f'platforms[{i}].categories must be a nonempty allow-list')
        for j,url in enumerate(p.get('source_urls',[])): require_url(url,f'platforms[{i}].source_urls[{j}]',errors)
    for i,p in enumerate(parts):
        for key in ('brand','name','category','vehicle_id','fitment_status','fitment_source_url','description'):
            if not p.get(key): errors.append(f'parts[{i}] missing {key}')
        if p.get('vehicle_id') not in vehicle_ids: errors.append(f'parts[{i}] references manual vehicle not present: {p.get("vehicle_id")}')
        if 'ranking' in p: errors.append(f'parts[{i}] contains ranking; remove it and let the evidence pipeline calculate scores')
        if p.get('fitment_status') not in ('verified','probable','unknown','not_fitment'): errors.append(f'parts[{i}] has unsupported fitment_status')
        try:
            confidence=float(p.get('fitment_confidence',0))
            if not 0<=confidence<=1: raise ValueError
        except (TypeError,ValueError): errors.append(f'parts[{i}].fitment_confidence must be between 0 and 1')
        require_url(p.get('fitment_source_url'),f'parts[{i}].fitment_source_url',errors)
        require_url(p.get('official_url'),f'parts[{i}].official_url',errors,allow_empty=True)
        hint=p.get('price_hint')
        if hint:
            require_url(hint.get('url'),f'parts[{i}].price_hint.url',errors)
            if hint.get('price') is not None:
                try:
                    if float(hint['price'])<=0: raise ValueError
                except (TypeError,ValueError): errors.append(f'parts[{i}].price_hint.price must be positive')
    if errors:
        raise SystemExit('\n'.join(f'ERROR: {x}' for x in errors))
    print(f'Validated manual inputs: {len(vehicles)} vehicles, {len(platforms)} platforms, {len(parts)} parts')

if __name__=='__main__': validate()
