"""Deterministic official FuelEconomy.gov import; no inferred engine codes or fitment."""
import argparse, csv, hashlib, io, json, zipfile
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
ROOT=Path(__file__).resolve().parents[1]
URL='https://www.fueleconomy.gov/feg/epadata/vehicles.csv.zip'
def normalize(rows):
    result=[]
    for r in rows:
        year=int(r['year']); make=r['make']; model=r['model']
        family=None
        if make=='BMW' and model.startswith('Z3'): family='bmw-z3'
        elif make=='Mazda' and model=='MX-5 Miata' and 1999<=year<=2005: family='mazda-nb'
        elif make=='Subaru' and model=='BRZ' and 2013<=year<=2020: family='subaru-brz-zc6'
        elif make=='Scion' and model=='FR-S' and 2013<=year<=2016: family='scion-frs'
        elif make=='Toyota' and model=='86' and 2017<=year<=2020: family='toyota-86'
        if not family: continue
        source_url=f"https://www.fueleconomy.gov/ws/rest/vehicle/{r['id']}"
        result.append({'id':'epa-'+r['id'],'family_id':family,'year':year,'make':make,
            'model':'Z3' if family=='bmw-z3' else model,
            'trim':f"{model} · {r['displ']}L · {r['trany']}",
            'engine':f"{r['displ']}L / {r['cylinders']} cylinders",'chassis':'Not specified',
            'transmission':r['trany'],'drivetrain':r['drive'],'market':'US',
            'tags':['EPA configuration','Engine code not established'],
            'metadata':{'source':'FuelEconomy.gov','source_url':source_url,'source_id':r['id'],
                'source_model':model,'displacement_l':r['displ'],'cylinders':r['cylinders'],
                'turbo':r.get('tCharger',''),'engine_descriptor':r.get('eng_dscr',''),
                'fitment_status':'not_established'}})
    labels={}
    for v in result: labels.setdefault((v['make'],v['model'],v['year'],v['trim']),[]).append(v)
    for group in labels.values():
        if len(group)>1:
            for v in group:
                detail='Turbo' if v['metadata'].get('turbo')=='T' else 'Engine configuration'
                v['trim']+=f" · {detail} (EPA {v['metadata']['source_id']})"
    ids=[v['id'] for v in result]
    if len(set(ids))!=len(ids): raise ValueError('Duplicate EPA IDs')
    if not result: raise ValueError('No configured applications found; retaining previous data')
    return sorted(result,key=lambda x:(x['make'],x['model'],x['year'],x['id']))
def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--archive',type=Path)
    args=parser.parse_args()
    raw=args.archive.read_bytes() if args.archive else urlopen(URL,timeout=45).read()
    with zipfile.ZipFile(io.BytesIO(raw)) as z:
        with z.open('vehicles.csv') as stream: records=list(csv.DictReader(io.TextIOWrapper(stream,encoding='utf-8-sig')))
    vehicles=normalize(records); target=ROOT/'data/reference';target.mkdir(exist_ok=True)
    for name,payload in [('epa_vehicles.json',vehicles),('epa_import.json',{'source_url':URL,'documentation_url':'https://www.fueleconomy.gov/feg/ws/index.shtml','retrieved_at':datetime.now(timezone.utc).isoformat(),'sha256':hashlib.sha256(raw).hexdigest(),'upstream_rows':len(records),'imported_rows':len(vehicles),'scope':'Z3, NB Miata, first-generation BRZ/FR-S/86 US configurations','limits':'EPA configurations are not trim, engine-code, production-month or part-fitment evidence.'})]:
        temp=target/(name+'.tmp');temp.write_text(json.dumps(payload,indent=2)+'\n');temp.replace(target/name)
    print(f'Imported {len(vehicles)} configurations from {len(records)} official records')
if __name__=='__main__':main()
