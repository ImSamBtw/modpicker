from __future__ import annotations
from dataclasses import dataclass, asdict, field
from datetime import datetime, timezone
from typing import Any
import hashlib, json

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace('+00:00','Z')

def stable_id(*parts: str) -> str:
    raw = '|'.join((p or '').strip().lower() for p in parts)
    return hashlib.sha256(raw.encode()).hexdigest()[:20]

@dataclass
class SourceRecord:
    id: str; part_id: str; source_type: str; url: str; title: str
    outlet: str = ''; published_at: str | None = None; retrieved_at: str = field(default_factory=now_iso)
    summary: str = ''; confidence: float = 0.5; metadata: dict[str, Any] = field(default_factory=dict)
    @classmethod
    def make(cls, *, part_id:str, source_type:str, url:str, title:str, **kwargs):
        return cls(id=stable_id(part_id, source_type, url), part_id=part_id, source_type=source_type, url=url, title=title, **kwargs)

@dataclass
class OfferRecord:
    id: str; part_id: str; vendor: str; url: str
    price: float | None = None; shipping: float | None = None; currency: str = 'USD'; in_stock: bool | None = None
    condition: str = 'new'; retrieved_at: str = field(default_factory=now_iso); metadata: dict[str, Any] = field(default_factory=dict)
    @classmethod
    def make(cls, *, part_id:str, vendor:str, url:str, **kwargs):
        return cls(id=stable_id(part_id, vendor, url), part_id=part_id, vendor=vendor, url=url, **kwargs)

@dataclass
class ReviewItem:
    id: str; entity_type: str; entity_id: str; reason: str; payload: dict[str, Any]
    severity: str = 'medium'; created_at: str = field(default_factory=now_iso)
    @classmethod
    def make(cls, entity_type:str, entity_id:str, reason:str, payload:dict[str,Any], severity='medium'):
        return cls(stable_id(entity_type, entity_id, reason, json.dumps(payload,sort_keys=True)), entity_type, entity_id, reason, payload, severity)

def serialize(items):
    return [asdict(x) if hasattr(x, '__dataclass_fields__') else x for x in items]
