import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
EXAMPLE_DIR = ROOT / 'conformance' / 'fixtures' / 'examples'


class DifferentialExampleTests(unittest.TestCase):
    """Signatures produced by the Node signer must verify for every site category."""

    def test_all_example_categories(self):
        failures = []
        for case_dir in sorted(EXAMPLE_DIR.iterdir()):
            if not case_dir.is_dir():
                continue
            expected = json.loads((case_dir / 'expected.json').read_text(encoding='utf-8'))
            result = av.verify(
                (case_dir / 'ai.json').read_text(encoding='utf-8'),
                (case_dir / 'ai-signature.json').read_text(encoding='utf-8'),
                domain=expected['domain'],
                now=expected['now']
            )
            if result['result'] != expected['result']:
                failures.append('%s: %s' % (case_dir.name, json.dumps(result['errors'])))
        self.assertEqual(failures, [], '\n'.join(failures))

    def test_categories_present(self):
        names = sorted(case_dir.name for case_dir in EXAMPLE_DIR.iterdir() if case_dir.is_dir())
        self.assertEqual(names, ['blog', 'ecommerce', 'government', 'marketplace', 'news', 'saas'])


if __name__ == '__main__':
    unittest.main()
