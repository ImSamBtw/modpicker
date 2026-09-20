"""Starter data refresh pipeline for ModPicker.

Production flow:
1. Pull price data from official vendor APIs/feeds or permitted pages.
2. Pull review/community evidence through official APIs where available.
3. Normalize records and deduplicate them.
4. Recalculate scores with scoring.py.
5. Export generated frontend data.

This prototype intentionally does not bypass robots.txt, authentication, anti-bot systems,
or site terms. Reddit integration should use OAuth/API credentials.
"""
import os
from datetime import datetime, timezone


def reddit_status():
    required=("REDDIT_CLIENT_ID","REDDIT_CLIENT_SECRET","REDDIT_USER_AGENT")
    configured=all(os.getenv(x) for x in required)
    return {"source":"reddit","configured":configured,"checked_at":datetime.now(timezone.utc).isoformat()}


def vendor_status():
    return {"source":"vendors","configured":False,"note":"Add vendor APIs/feeds or permitted adapters here."}


if __name__=="__main__":
    print(reddit_status())
    print(vendor_status())
    print("No live records written: adapters are intentionally placeholders until credentials/source rules are configured.")
