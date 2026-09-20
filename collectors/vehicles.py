"""Bounded, rotating official NHTSA vehicle-model discovery; no inferred trims or engines."""
import json
from datetime import datetime, timezone
from pathlib import Path
from .base import BaseCollector
class VehicleCollector(BaseCollector):
    name='vehicles'
    def run(self, existing, state):
        cfg=json.loads(Path('config/vehicle_discovery.json').read_text())
        jobs=[(make,year) for make in cfg['makes'] for year in cfg['years']]
        cursor=int(state.get('cursor',0)); rows={x['id']:x for x in existing}; warnings=[]; checked=0
        for i in range(min(cfg.get('requests_per_run',2),len(jobs))):
            make,year=jobs[(cursor+i)%len(jobs)]
            url=f'https://vpic.nhtsa.dot.gov/api/vehicles/GetModelsForMakeYear/make/{make}/modelyear/{year}?format=json'
            try:
                for x in self.get(url).json().get('Results',[]):
                    key=f"nhtsa-{year}-{x['Make_ID']}-{x['Model_ID']}"
                    rows[key]={'id':key,'year':year,'make':x['Make_Name'],'model':x['Model_Name'],'trim':'Unspecified','chassis':'Not specified','engine':'Not specified','tags':['Model record · fitment not established'],'metadata':{'source':'NHTSA vPIC','source_url':url,'model_id':x['Model_ID'],'retrieved_at':datetime.now(timezone.utc).isoformat()}}
                checked+=1
            except Exception as e: warnings.append(f'{make} {year}: {type(e).__name__}')
        return list(rows.values()), {'cursor':(cursor+min(cfg.get('requests_per_run',2),len(jobs)))%len(jobs)}, {'enabled':True,'requests':checked,'vehicle_count':len(rows),'warnings':warnings}
