import json, os, re, requests
class CloudflareCurator:
    def __init__(self, timeout=30):
        self.account=os.getenv('CLOUDFLARE_ACCOUNT_ID'); self.token=os.getenv('CLOUDFLARE_API_TOKEN'); self.model=os.getenv('CLOUDFLARE_AI_MODEL','@cf/meta/llama-3.1-8b-instruct'); self.timeout=timeout
    @property
    def enabled(self): return bool(self.account and self.token)
    def curate(self, record):
        if not self.enabled: return None
        prompt=('Return JSON only with keys summary (max 35 words), labels (array chosen from install,review,comparison,dyno,fitment,problem,discussion), and relevance (0 to 1). Do not infer facts not present. Source metadata:\n'+json.dumps({'title':record.title,'source_type':record.source_type,'outlet':record.outlet,'existing_summary':record.summary},ensure_ascii=False))
        url=f'https://api.cloudflare.com/client/v4/accounts/{self.account}/ai/run/{self.model}'
        r=requests.post(url,headers={'Authorization':f'Bearer {self.token}','Content-Type':'application/json'},json={'prompt':prompt},timeout=self.timeout); r.raise_for_status(); text=r.json().get('result',{}).get('response','')
        m=re.search(r'\{.*\}',text,re.S)
        if not m: return None
        data=json.loads(m.group(0)); data['labels']=data.get('labels',[]) if isinstance(data.get('labels',[]),list) else []; data['relevance']=max(0,min(1,float(data.get('relevance',0.5)))); return data
