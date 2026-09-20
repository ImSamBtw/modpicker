from collections import defaultdict
from math import exp

METRICS=("quality","reliability","power","handling","value")

def score_part(records):
    totals=defaultdict(float); weights=defaultdict(float); source_types=set()
    for r in records:
        source_types.add(r.get("source_type","unknown"))
        w=float(r.get("source_weight",1.0))
        if not r.get("verified",False): w*=0.7
        for metric in METRICS:
            value=(r.get("metrics") or {}).get(metric)
            if value is None: continue
            value=max(0,min(10,float(value)))
            totals[metric]+=value*w; weights[metric]+=w
    scores={m:(round(totals[m]/weights[m],2) if weights[m] else None) for m in METRICS}
    present=[v for v in scores.values() if v is not None]
    overall=round(sum(present)/len(present),2) if present else None
    count=len(records); diversity=len(source_types)
    confidence=round(min((1-exp(-count/10))*min(1,.55+.15*diversity),.95),3)
    return {"overall":overall,**scores,"confidence":confidence,"evidence_count":count}

if __name__=="__main__":
    print("Scoring engine ready. Feed normalized evidence records into score_part(records).")
