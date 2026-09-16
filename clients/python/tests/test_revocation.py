import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
REVOCATION_DIR = ROOT / 'conformance' / 'revocation'


class DifferentialRevocationTests(unittest.TestCase):
    """Node-generated revocation fixtures must verify identically in Python."""

    def test_revocation_fixtures(self):
        failures = []
        for case_dir in sorted(REVOCATION_DIR.iterdir()):
            if not case_dir.is_dir():
                continue
            expected = json.loads((case_dir / 'expected.json').read_text(encoding='utf-8'))
            result = av.verify_revocation_document(
                (case_dir / 'revocation.json').read_text(encoding='utf-8'),
                domain=expected['domain'],
                now=expected['now'],
                governance_keys=expected['governance_keys']
            )
            error_codes = [error['code'] for error in result['errors']]
            warning_codes = [warning['code'] for warning in result['warnings']]
            problems = []
            if result['result'] != expected['result']:
                problems.append('result %s != %s (errors=%s)' % (result['result'], expected['result'], error_codes))
            if expected.get('status') and result.get('status') != expected['status']:
                problems.append('status %s != %s' % (result.get('status'), expected['status']))
            for code in expected['errors']:
                if code not in error_codes:
                    problems.append('missing error %s (got %s)' % (code, error_codes))
            for code in expected['warnings']:
                if code not in warning_codes:
                    problems.append('missing warning %s (got %s)' % (code, warning_codes))
            if problems:
                failures.append('%s: %s' % (case_dir.name, '; '.join(problems)))
        self.assertEqual(failures, [], '\n'.join(failures))

    def test_status_and_expiry_hardening(self):
        base = json.loads((REVOCATION_DIR / '001-active-multisig' / 'revocation.json').read_text(encoding='utf-8'))
        expected = json.loads((REVOCATION_DIR / '001-active-multisig' / 'expected.json').read_text(encoding='utf-8'))

        bad = dict(base)
        bad['status'] = 'banned'
        result = av.verify_revocation_document(json.dumps(bad), domain=expected['domain'], now=expected['now'],
                                               governance_keys=expected['governance_keys'])
        self.assertIn('revocation_status_invalid', [error['code'] for error in result['errors']])

        no_expiry = dict(base)
        del no_expiry['expires_at']
        result = av.verify_revocation_document(json.dumps(no_expiry), domain=expected['domain'], now=expected['now'],
                                               governance_keys=expected['governance_keys'])
        self.assertIn('revocation_expires_invalid', [error['code'] for error in result['errors']])

        dotted = av.verify_revocation_document(
            (REVOCATION_DIR / '001-active-multisig' / 'revocation.json').read_text(encoding='utf-8'),
            domain=expected['domain'].upper() + '.', now=expected['now'],
            governance_keys=expected['governance_keys'])
        self.assertEqual(dotted['result'], 'valid', json.dumps(dotted['errors']))

    def test_threshold_math(self):
        case_dir = REVOCATION_DIR / '003-single-signature'
        expected = json.loads((case_dir / 'expected.json').read_text(encoding='utf-8'))
        result = av.verify_revocation_document(
            (case_dir / 'revocation.json').read_text(encoding='utf-8'),
            domain=expected['domain'],
            now=expected['now'],
            governance_keys=expected['governance_keys']
        )
        self.assertEqual(result['valid_signatures'], 1)


if __name__ == '__main__':
    unittest.main()
