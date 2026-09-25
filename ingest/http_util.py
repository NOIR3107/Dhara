"""
Shared HTTP helper for external feeds (adapted from the request-budget /
disk-cache pattern in bilawalsidhu/gods-eye-view).

- Disk cache with per-call TTL, so re-running an ingest does not re-hit
  free-tier APIs (Open-Meteo, USGS, GDACS, FIRMS, GDELT).
- Per-host daily request budget persisted to disk, so a loop or a cron gone
  wrong cannot exhaust a free quota in the middle of a disaster.
- Retries with exponential backoff on transient errors (5xx, 429, timeouts).
- A real User-Agent, which several public APIs require.
"""
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import date

CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cache", "http")
BUDGET_FILE = os.path.join(CACHE_DIR, "_budget.json")
USER_AGENT = "DHARA-SIH/1.0 (disaster logistics research prototype)"

# Conservative daily ceilings, well under each provider's free tier.
DAILY_BUDGET = {
    "api.open-meteo.com": 2000,          # free tier: 10,000 calls/day (non-commercial)
    "earthquake.usgs.gov": 500,
    "www.gdacs.org": 500,
    "firms.modaps.eosdis.nasa.gov": 300,  # FIRMS: 5,000 transactions / 10 min per key
    "api.gdeltproject.org": 300,
}
DEFAULT_BUDGET = 500


class BudgetExceeded(RuntimeError):
    pass


def _load_budget():
    try:
        with open(BUDGET_FILE, encoding="utf-8") as f:
            data = json.load(f)
        if data.get("day") == date.today().isoformat():
            return data
    except (OSError, ValueError):
        pass
    return {"day": date.today().isoformat(), "counts": {}}


def _spend(host):
    os.makedirs(CACHE_DIR, exist_ok=True)
    budget = _load_budget()
    used = budget["counts"].get(host, 0)
    limit = DAILY_BUDGET.get(host, DEFAULT_BUDGET)
    if used >= limit:
        raise BudgetExceeded(f"Daily request budget for {host} exhausted ({used}/{limit})")
    budget["counts"][host] = used + 1
    with open(BUDGET_FILE, "w", encoding="utf-8") as f:
        json.dump(budget, f)


def _cache_path(url, data):
    key = hashlib.sha256((url + "\n" + (data or "")).encode()).hexdigest()[:32]
    return os.path.join(CACHE_DIR, key + ".bin")


def fetch(url, ttl_seconds=900, data=None, timeout=30, retries=3):
    """GET (or POST when `data` is a str) with cache, budget and retries. Returns bytes."""
    path = _cache_path(url, data)
    if ttl_seconds > 0 and os.path.exists(path) and time.time() - os.path.getmtime(path) < ttl_seconds:
        with open(path, "rb") as f:
            return f.read()

    host = urllib.parse.urlparse(url).netloc
    body = data.encode() if isinstance(data, str) else None
    last_err = None
    for attempt in range(retries):
        _spend(host)
        try:
            req = urllib.request.Request(url, data=body, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                payload = resp.read()
            os.makedirs(CACHE_DIR, exist_ok=True)
            with open(path, "wb") as f:
                f.write(payload)
            return payload
        except urllib.error.HTTPError as e:
            last_err = e
            if e.code not in (429, 500, 502, 503, 504):
                raise
        except (urllib.error.URLError, TimeoutError) as e:
            last_err = e
        time.sleep(2 ** attempt)
    raise last_err


def fetch_json(url, ttl_seconds=900, **kw):
    return json.loads(fetch(url, ttl_seconds=ttl_seconds, **kw).decode("utf-8"))
