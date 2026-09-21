"""Gate Crawl4AI downloads on AIFeed permissions and asset digests.

Requires: pip install aifeed crawl4ai

Everything decision-shaped is pure and unit-tested; the Crawl4AI wiring at the
bottom is documentation for host applications.
"""

ALLOWED = 'allow'
DENIED = 'deny'


def download_decision(manifest, target, intended_use='retrieval'):
    """Decide whether an agent may download ``target`` under manifest policy.

    ``manifest`` is a verified AIFeed manifest dict; ``target`` is either a page
    URL or an ``aifeed.assets`` entry dict. Returns ``(verdict, reason)`` where
    verdict is ``'allow'`` or ``'deny'``.
    """
    usage = manifest.get('permissions', {}).get('usage', {})
    if usage.get(intended_use, 'deny') != ALLOWED:
        return DENIED, 'usage %r is %r' % (intended_use, usage.get(intended_use, 'deny'))
    if isinstance(target, dict):
        missing = [key for key in ('size', 'sha-256') if target.get(key) is None]
        if missing:
            return ALLOWED, 'declared asset without integrity metadata (%s); verify after download' % ', '.join(missing)
        return ALLOWED, 'declared asset with integrity metadata'
    return ALLOWED, 'page fetch allowed by manifest usage'


def filter_assets(manifest, assets, intended_use='retrieval'):
    """Split declared assets into ``(allowed, denied)`` lists (pure helper)."""
    allowed, denied = [], []
    for asset in assets:
        verdict, reason = download_decision(manifest, asset, intended_use)
        (allowed if verdict == ALLOWED else denied).append((asset.get('url', ''), reason))
    return allowed, denied


# --- host wiring (documentation; needs crawl4ai) -------------------------------
#
# from crawl4ai import AsyncWebCrawler
#
# async def gated_download(manifest, url, intended_use='retrieval'):
#     verdict, reason = download_decision(manifest, url, intended_use)
#     if verdict != ALLOWED:
#         raise PermissionError(reason)
#     async with AsyncWebCrawler() as crawler:
#         return await crawler.arun(url=url)
#
# -------------------------------------------------------------------------------

if __name__ == '__main__':
    print('see download_decision() and filter_assets(); needs crawl4ai for wiring')
