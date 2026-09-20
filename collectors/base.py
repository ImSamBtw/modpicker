from __future__ import annotations
from dataclasses import dataclass
from typing import Any
import requests, time
@dataclass
class CollectorResult:
    name: str; sources: list; offers: list; warnings: list[str]; metadata: dict[str,Any]
class BaseCollector:
    name='base'
    def __init__(self, timeout=20):
        self.timeout=timeout; self.session=requests.Session(); self.session.headers.update({'User-Agent':'ModPickerBot/0.1 (+https://imsambtw.github.io/modpicker/)'})
    def get(self,url,**kwargs):
        last=None
        for delay in (0,1,3):
            if delay: time.sleep(delay)
            try:
                r=self.session.get(url,timeout=self.timeout,**kwargs)
                if r.status_code in (429,500,502,503,504): last=RuntimeError(f'{r.status_code} {url}'); continue
                r.raise_for_status(); return r
            except Exception as e: last=e
        raise last
