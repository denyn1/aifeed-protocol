import sys
import unittest
from pathlib import Path

EXAMPLES_DIR = Path(__file__).resolve().parents[3] / 'examples' / 'python'
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(EXAMPLES_DIR))

from aifeed import verify as av  # noqa: E402
import langchain_loader  # noqa: E402
import llamaindex_reader  # noqa: E402
import crawl4ai_hook as hook  # noqa: E402

MANIFEST = {
    'permissions': {
        'usage': {'retrieval': 'allow', 'training': 'deny'},
        'attribution': 'required',
    }
}


class LoaderHelperTests(unittest.TestCase):
    def test_manifest_url_for(self):
        self.assertEqual(
            langchain_loader.manifest_url_for('Example.COM.'),
            'https://example.com/.well-known/ai.json',
        )

    def test_manifest_url_for_rejects_bad_domain(self):
        with self.assertRaises(av.AifeedError) as context:
            langchain_loader.manifest_url_for('not a domain')
        self.assertEqual(context.exception.code, 'invalid_domain')

    def test_document_for_page(self):
        doc = langchain_loader.document_for_page(
            'https://example.com/a', '# Hi', {'training': 'deny'}, 'required'
        )
        self.assertEqual(doc['page_content'], '# Hi')
        self.assertTrue(doc['metadata']['aifeed_verified'])
        self.assertEqual(doc['metadata']['training'], 'deny')
        self.assertEqual(doc['metadata']['source'], 'https://example.com/a')


class ReaderHelperTests(unittest.TestCase):
    def test_changed_entries(self):
        entries = [
            {'url': '/a', 'sha-256': 'x'},
            {'url': '/b', 'sha-256': 'y'},
        ]
        changed = llamaindex_reader.changed_entries(entries, {'/a': 'x', '/b': 'old'})
        self.assertEqual([entry['url'] for entry in changed], ['/b'])

    def test_document_dict(self):
        entry = {'url': '/a', 'sha-256': 'x', 'updated': '2026-09-20', 'assets': 2}
        doc = llamaindex_reader.document_dict(entry, '# A')
        self.assertEqual(doc['text'], '# A')
        self.assertEqual(doc['metadata']['doc_id'], '/a')
        self.assertEqual(doc['metadata']['aifeed_assets'], 2)

    def test_load_index_rejects_garbage(self):
        with self.assertRaises(av.AifeedError):
            llamaindex_reader.load_aifeed_index('{"a":1.5}')

    def test_load_index_round_trip(self):
        index = llamaindex_reader.load_aifeed_index('{"version":"0.2","entries":[]}')
        self.assertEqual(index['entries'], [])


class DownloadDecisionTests(unittest.TestCase):
    def test_page_allowed_by_usage(self):
        verdict, _ = hook.download_decision(MANIFEST, 'https://example.com/a')
        self.assertEqual(verdict, 'allow')

    def test_denied_usage(self):
        verdict, reason = hook.download_decision(MANIFEST, 'https://example.com/a', 'training')
        self.assertEqual(verdict, 'deny')
        self.assertIn('training', reason)

    def test_asset_without_integrity_still_allowed_with_note(self):
        verdict, reason = hook.download_decision(MANIFEST, {'url': '/f.pdf'})
        self.assertEqual(verdict, 'allow')
        self.assertIn('integrity', reason)

    def test_filter_assets_splits(self):
        assets = [{'url': '/ok.pdf', 'size': 10, 'sha-256': 'x'}, {'url': '/other'}]
        allowed, denied = hook.filter_assets(MANIFEST, assets, 'training')
        self.assertEqual(allowed, [])
        self.assertEqual(len(denied), 2)
        allowed, denied = hook.filter_assets(MANIFEST, assets, 'retrieval')
        self.assertEqual(len(allowed), 2)
        self.assertEqual(denied, [])


if __name__ == '__main__':
    unittest.main()
