"""Read AIFeed delta indexes as LlamaIndex documents.

Requires: pip install aifeed llama-index-core

Only the standard library and ``aifeed`` are imported at module level; the
LlamaIndex import is lazy so this file also serves as plain documentation.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / 'clients' / 'python'))

from aifeed import verify  # noqa: E402


def document_dict(entry, markdown):
    """Shape one delta-index entry plus its verified markdown as a dict."""
    return {
        'text': markdown,
        'metadata': {
            'source': entry.get('url', ''),
            'doc_id': entry.get('url', ''),
            'aifeed_sha256': entry.get('sha-256', ''),
            'aifeed_updated': entry.get('updated', ''),
            'aifeed_assets': entry.get('assets', 0),
        },
    }


def changed_entries(entries, stored_digests):
    """Return entries whose digest differs from the stored map (pure helper)."""
    stored_digests = stored_digests or {}
    return [entry for entry in entries if stored_digests.get(entry.get('url')) != entry.get('sha-256')]


def load_aifeed_index(index_text):
    """Strict-parse an AIFeed delta index (raises AifeedError when invalid)."""
    return verify.parse_strict(index_text)


class AifeedReader:
    """LlamaIndex reader sketch: verified pages only, unchanged pages skipped."""

    def load_data(self, index_text, fetch_markdown, stored_digests=None):
        """Fetch markdown per changed entry; returns LlamaIndex Documents."""
        from llama_index.core import Document

        index = load_aifeed_index(index_text)
        documents = []
        for entry in changed_entries(index.get('entries', []), stored_digests):
            markdown = fetch_markdown(entry['url'])
            documents.append(Document(**document_dict(entry, markdown)))
        return documents


if __name__ == '__main__':
    print('see AifeedReader.load_data(); needs llama-index-core')
