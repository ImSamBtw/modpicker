from __future__ import annotations
KEYWORDS={'install':['install','installation','how to','diy','fitting'],'review':['review','long term','owner','impressions'],'comparison':[' vs ','versus','compare','comparison'],'dyno':['dyno','whp','wheel horsepower','torque'],'fitment':['fitment','fits','compatible','clearance'],'problem':['failure','failed','problem','issue','leak','broken','rattle']}
def classify(title:str, summary:str='')->list[str]:
    text=f' {title} {summary} '.lower(); labels=[]
    for label,words in KEYWORDS.items():
        if any(w in text for w in words): labels.append(label)
    return labels or ['discussion']
def source_weight(source_type:str)->float:
    return {'manufacturer':1.0,'manual':1.0,'professional_review':0.9,'retailer':0.8,'youtube':0.65,'forum':0.62,'reddit':0.55,'marketplace':0.5}.get(source_type,0.45)
