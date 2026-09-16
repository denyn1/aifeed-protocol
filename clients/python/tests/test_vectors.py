import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
VECTOR_DIR = ROOT / 'conformance' / 'vectors'


def load_cases(group):
    cases = []
    for case_dir in sorted((VECTOR_DIR / group).iterdir()):
        if not case_dir.is_dir():
            continue
        cases.append({
            'name': '%s/%s' % (group, case_dir.name),
            'manifest': (case_dir / 'ai.json').read_text(encoding='utf-8'),
            'signature': (case_dir / 'ai-signature.json').read_text(encoding='utf-8'),
            'expected': json.loads((case_dir / 'expected.json').read_text(encoding='utf-8')),
        })
    return cases


class DifferentialVectorTests(unittest.TestCase):
    """Node-generated signatures must verify identically in Python."""

    def test_vectors_exist(self):
        cases = load_cases('positive') + load_cases('negative')
        self.assertGreaterEqual(len(cases), 20)

    def test_all_vectors(self):
        failures = []
        for case in load_cases('positive') + load_cases('negative'):
            expected = case['expected']
            result = av.verify(
                case['manifest'],
                case['signature'],
                domain=expected['domain'],
                now=expected['now']
            )
            error_codes = [error['code'] for error in result['errors']]
            warning_codes = [warning['code'] for warning in result['warnings']]
            problems = []
            if result['result'] != expected['result']:
                problems.append('result %s != %s (errors=%s)' % (result['result'], expected['result'], error_codes))
            for code in expected['errors']:
                if code not in error_codes:
                    problems.append('missing error %s (got %s)' % (code, error_codes))
            for code in expected.get('warnings', []):
                if code not in warning_codes:
                    problems.append('missing warning %s (got %s)' % (code, warning_codes))
            if problems:
                failures.append('%s: %s' % (case['name'], '; '.join(problems)))
        self.assertEqual(failures, [], '\n'.join(failures))


if __name__ == '__main__':
    unittest.main()
