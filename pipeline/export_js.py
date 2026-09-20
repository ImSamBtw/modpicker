import json
from pathlib import Path
def export_js(parts,sources,offers,status,path='pipeline-data.js',vehicles=None,platforms=None):
    by={p['id']:{**p,'sources':[],'offers':[]} for p in parts}
    for s in sources:
        if s.get('part_id') in by: by[s['part_id']]['sources'].append(s)
    for o in offers:
        if o.get('part_id') in by: by[o['part_id']]['offers'].append(o)
    Path(path).write_text('window.MODPICKER_PIPELINE_DATA='+json.dumps({'parts':list(by.values()),'status':status,'vehicles':vehicles or [],'platforms':platforms or []},separators=(',',':'))+';\n')
