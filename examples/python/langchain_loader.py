"""Load verified AIFeed pages as LangChain documents.

Requires: pip install aifeed langchain-core

Only the standard library and ``aifeed`` are imported at module level; the
LangChain import is lazy so this file also serves as plain documentation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'clients' / 'python'))

from aifeed import verify  # noqa: E402


def manifest_url_for(domain):
    """Return the canonical manifest URL for a domain (pure helper)."""
    clean = verify.normalize_domain(domain)
    if not clean:
        raise verify.AifeedError('invalid_domain', 'not a valid domain: %r' % (domain,))
    return 'https://' + clean + '/.well-known/ai.json'


def document_for_page(page_url, markdown, usage=None, attribution='required'):
    """Shape one verified AIFeed page as a LangChain-style document dict."""
    usage = usage or {}
    return {
        'page_content': markdown,
        'metadata': {
            'source': page_url,
            'aifeed_verified': True,
            'training': usage.get('training', 'deny'),
            'attribution': attribution,
        },
    }


def load_aifeed_documents(pages, usage=None, attribution='required'):
    """Shape verified ``(page_url, markdown)`` pairs as LangChain Documents.

    Verify first (``aifeed-verify``) and pass only verified bytes here.
    Requires ``langchain-core``.
    """
    from langchain_core.documents import Document

    return [Document(**document_for_page(url, text, usage, attribution)) for url, text in pages]


if __name__ == '__main__':
    print('see document_for_page() and load_aifeed_documents(); needs langchain-core')
