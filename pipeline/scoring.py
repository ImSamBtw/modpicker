"""Deterministic published-review aggregation. Never infer performance from link counts."""
from math import isfinite
from urllib.parse import urlparse
from datetime import datetime, timezone
METRICS = ('quality', 'reliability', 'performance', 'handling', 'value')
VERSION = 'published_reviews_v2'
def score_sources(sources):
    by_outlet = {}
    for source in sources:
        meta = source.get('metadata') or {}
        rating = meta.get('aggregate_rating') or {}
        if not meta.get('identity_matched') or not rating: continue
        try:
            value, maximum = float(rating['ratingValue']), float(rating.get('bestRating', 5))
            minimum = float(rating.get('worstRating', 1))
            count = int(rating.get('reviewCount') or rating.get('ratingCount') or 0)
            if not all(isfinite(n) for n in (value, maximum, minimum)) or not minimum <= value <= maximum or maximum <= 0 or count < 1: continue
            dt = datetime.fromisoformat(source['retrieved_at'].replace('Z','+00:00'))
            if (datetime.now(timezone.utc)-dt).total_seconds() > 90*86400: continue
            host = urlparse(source['url']).hostname
            if not host: continue
        except (KeyError, TypeError, ValueError): continue
        record = {'url': source['url'], 'outlet':host, 'rating':round(value/maximum*10,2), 'count':count, 'retrieved_at':source['retrieved_at']}
        # A retailer's repeated pages are not independent reviews. Use its largest sample once.
        old = by_outlet.get(host.removeprefix('www.'))
        if old is None or count > old['count']: by_outlet[host.removeprefix('www.')] = record
    evidence = list(by_outlet.values())
    count = sum(x['count'] for x in evidence)
    overall = round(sum(x['rating']*x['count'] for x in evidence)/count,2) if count else None
    return {'overall':overall, **{m:None for m in METRICS}, 'confidence':None, 'source_count':len(evidence), 'methodology_version':VERSION, 'metadata':{'review_count':count,'evidence':evidence,'provisional':count<5,'label':'Published owner rating','limitations':'Retailer-reported reviews; buyers and independence across retailers are not verified. No inferred quality, reliability or performance metrics.'}}
