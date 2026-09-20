import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_mako as am  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
MAKO_DIR = ROOT / 'conformance' / 'mako'
AIMD_DIR = ROOT / 'conformance' / 'aimd'


def load_cases(group, root=MAKO_DIR):
    cases = []
    for case_dir in sorted((root / group).iterdir()):
        if not case_dir.is_dir():
            continue
        cases.append((group, case_dir))
    return cases


class MakoVectorTests(unittest.TestCase):
    """Node-generated MAKO signatures must verify identically in Python."""

    def test_mako_vectors_exist(self):
        total = len(load_cases('positive')) + len(load_cases('negative'))
        self.assertGreaterEqual(total, 30)

    def test_all_mako_vectors(self):
        failures = []
        for group, case_dir in load_cases('positive') + load_cases('negative'):
            expected = json.loads((case_dir / 'expected.json').read_text(encoding='utf-8'))
            fragment = json.loads((case_dir / 'manifest.fragment.json').read_text(encoding='utf-8'))
            expected_result = expected['expected']
            problems = []

            if expected['kind'] == 'index':
                index_text = (case_dir / 'index.json').read_text(encoding='utf-8')
                signature_path = case_dir / 'signature.json'
                signature_text = signature_path.read_text(encoding='utf-8') if signature_path.exists() else None
                result = am.verify_mako_index(
                    index_text,
                    expected['url'],
                    fragment['public_key'],
                    signature_text,
                    expected.get('require_signature', False)
                )
                if result['verified'] != expected_result['verified']:
                    problems.append('verified %s != %s' % (result['verified'], expected_result['verified']))
                error_codes = [item['code'] for item in result['errors']]
                warning_codes = [item['code'] for item in result.get('warnings', [])]
                for code in expected_result['errors']:
                    if code not in error_codes:
                        problems.append('missing error %s (got %s)' % (code, error_codes))
                for code in expected_result['warnings']:
                    if code not in warning_codes:
                        problems.append('missing warning %s (got %s)' % (code, warning_codes))
                if 'entry_digest_check' in expected:
                    body = (case_dir / expected['entry_digest_check']['body']).read_bytes()
                    digest_result = am.check_index_entry_digest(result['entries'][0], body)
                    if digest_result['ok']:
                        problems.append('expected entry digest mismatch but check passed')
                    elif digest_result['error']['code'] != expected['entry_digest_check']['error']:
                        problems.append('entry digest error %s != %s' % (digest_result['error']['code'], expected['entry_digest_check']['error']))
            else:
                page = (case_dir / 'page.mako.md').read_bytes()
                signature_path = case_dir / 'signature.json'
                signature_text = signature_path.read_text(encoding='utf-8') if signature_path.exists() else None
                result = am.verify_mako_document(
                    expected['url'],
                    page,
                    signature_text,
                    fragment,
                    expected.get('last_modified')
                )
                if result['mako_verified'] != expected_result['mako_verified']:
                    problems.append('mako_verified %s != %s' % (result['mako_verified'], expected_result['mako_verified']))
                error_codes = [item['code'] for item in result['errors']]
                warning_codes = [item['code'] for item in result['warnings']]
                for code in expected_result['errors']:
                    if code not in error_codes:
                        problems.append('missing error %s (got %s)' % (code, error_codes))
                for code in expected_result['warnings']:
                    if code not in warning_codes:
                        problems.append('missing warning %s (got %s)' % (code, warning_codes))
                for key, value in expected_result.get('usage', {}).items():
                    if result['usage'].get(key) != value:
                        problems.append('usage.%s %s != %s' % (key, result['usage'].get(key), value))
                if 'attribution' in expected_result and result['attribution'] != expected_result['attribution']:
                    problems.append('attribution %s != %s' % (result['attribution'], expected_result['attribution']))
                for key, value in expected_result.get('limits', {}).items():
                    if result['limits'].get(key) != value:
                        problems.append('limits.%s %s != %s' % (key, result['limits'].get(key), value))

            if problems:
                failures.append('%s/%s: %s' % (group, case_dir.name, '; '.join(problems)))
        self.assertEqual(failures, [], '\n'.join(failures))


class MakoParserTests(unittest.TestCase):
    def test_unquoted_version_and_lists(self):
        text = '\n'.join([
            '---',
            'mako: 1.0',
            'type: article',
            'entity: "x"',
            'updated: 2026-09-14',
            'tokens: 10',
            'language: id',
            'related:',
            '  - /a',
            '  - /b',
            'actions:',
            '  - name: add_to_cart',
            '    description: "Add item"',
            '    method: POST',
            '---',
            '',
            'body',
            ''
        ])
        parsed = am.parse_frontmatter(text.encode('utf-8'))
        self.assertEqual(parsed['errors'], [])
        self.assertEqual(parsed['frontmatter']['mako'], '1.0')
        self.assertEqual(parsed['frontmatter']['related'], ['/a', '/b'])
        self.assertEqual(parsed['frontmatter']['actions'][0]['name'], 'add_to_cart')
        self.assertEqual(parsed['frontmatter']['actions'][0]['method'], 'POST')

    def test_asset_integrity_fields_pass_through(self):
        text = '\n'.join([
            '---',
            'mako: "1.0"',
            'type: article',
            'entity: "Aset"',
            'updated: 2026-09-14',
            'tokens: 10',
            'language: id',
            'aifeed:',
            '  policy_version: "0.2"',
            '  assets:',
            '    - url: /laporan.pdf',
            '      type: document',
            '      mime: application/pdf',
            '      size: 2048',
            '      sha-256: "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="',
            '---',
            '',
            'body',
            ''
        ])
        parsed = am.parse_frontmatter(text.encode('utf-8'))
        self.assertEqual(parsed['errors'], [])
        asset = parsed['frontmatter']['aifeed']['assets'][0]
        self.assertEqual(asset['mime'], 'application/pdf')
        self.assertEqual(asset['size'], 2048)
        self.assertEqual(asset['sha-256'], 'A' * 43 + '=')

    def test_restrict_only_rejects_loosening(self):
        result = am.resolve_permissions(
            {'default': 'allow', 'usage': {'training': 'deny'}, 'attribution': 'required'},
            {'usage': {'training': 'allow', 'summarize': 'allow'}, 'attribution': 'none'},
            'restrict-only'
        )
        self.assertEqual(result['usage']['training'], 'deny')
        self.assertEqual(result['attribution'], 'required')
        rejected = [item for item in result['warnings'] if item['code'] == 'permission_override_rejected']
        self.assertEqual(len(rejected), 2)

    def test_bidirectional_grant(self):
        result = am.resolve_permissions(
            {'default': 'deny', 'usage': {'training': 'deny'}, 'attribution': 'optional'},
            {'usage': {'training': 'allow'}},
            'bidirectional'
        )
        self.assertEqual(result['usage']['training'], 'allow')

    def test_restrict_only_rejects_license_replacement(self):
        base = {'name': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/'}
        result = am.resolve_permissions(
            {'default': 'allow', 'usage': {}, 'license': dict(base)},
            {'license': {'name': 'All Rights Reserved', 'url': 'https://berita.example/license'}},
            'restrict-only'
        )
        self.assertEqual(result['license'], base)
        rejected = [item for item in result['warnings']
                    if item['code'] == 'permission_override_rejected' and item.get('key') == 'license']
        self.assertEqual(len(rejected), 1)

    def test_restrict_only_allows_identical_license(self):
        base = {'name': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/'}
        result = am.resolve_permissions(
            {'default': 'allow', 'usage': {}, 'license': dict(base)},
            {'license': {'url': 'https://creativecommons.org/licenses/by/4.0/', 'name': 'CC BY 4.0'}},
            'restrict-only'
        )
        self.assertEqual(result['license'], base)
        flagged = [item for item in result['warnings'] if item.get('key') == 'license']
        self.assertEqual(flagged, [])

    def test_rejects_nfd_and_anchors(self):
        nfd = '---\nmako: "1.0"\ntype: article\nentity: "Cafe\u0301"\nupdated: 2026-09-14\ntokens: 5\nlanguage: id\n---\n\nbody\n'
        parsed = am.parse_frontmatter(nfd.encode('utf-8'))
        self.assertFalse(parsed['ok'])
        self.assertIn('not_nfc', [item['code'] for item in parsed['errors']])

        anchor = '---\nmako: "1.0"\ntype: article\nentity: &a "x"\n---\n\nbody\n'
        parsed = am.parse_frontmatter(anchor.encode('utf-8'))
        self.assertIn('yaml_anchor_forbidden', [item['code'] for item in parsed['errors']])

    def test_aimd_field_validation_and_profile_detection(self):
        base = 'aimd: "1.0"\ntype: article\nentity: "x"\nupdated: 2026-09-15\ntokens: 5\nlanguage: id\n'
        parsed = am.parse_frontmatter(('---\n' + base + '---\n\nbody\n').encode('utf-8'))
        self.assertEqual(parsed['errors'], [])
        self.assertEqual(am.document_profile(parsed['frontmatter']), 'aimd')
        self.assertEqual(am.validate_aimd_fields(parsed['frontmatter']), [])

        dual = am.parse_frontmatter(('---\nmako: "1.0"\n' + base + '---\n\nbody\n').encode('utf-8'))
        self.assertEqual(am.document_profile(dual['frontmatter']), 'aimd')

        missing = am.parse_frontmatter(('---\ntype: article\nentity: "x"\nupdated: 2026-09-15\ntokens: 5\nlanguage: id\n---\n\nbody\n').encode('utf-8'))
        codes = [item['code'] for item in am.validate_aimd_fields(missing['frontmatter'])]
        self.assertIn('aimd_frontmatter_missing', codes)


class AimdVectorTests(unittest.TestCase):
    """Node-generated AIMD signatures and native documents verify in Python."""

    def test_aimd_vectors_exist(self):
        total = len(load_cases('positive', AIMD_DIR)) + len(load_cases('negative', AIMD_DIR))
        self.assertGreaterEqual(total, 6)

    def test_all_aimd_vectors(self):
        failures = []
        for group, case_dir in load_cases('positive', AIMD_DIR) + load_cases('negative', AIMD_DIR):
            expected = json.loads((case_dir / 'expected.json').read_text(encoding='utf-8'))
            fragment = json.loads((case_dir / 'manifest.fragment.json').read_text(encoding='utf-8'))
            expected_result = expected['expected']
            problems = []
            signature_path = case_dir / 'signature.json'
            signature_text = signature_path.read_text(encoding='utf-8') if signature_path.exists() else None

            if expected['kind'] == 'index':
                index_text = (case_dir / 'index.json').read_text(encoding='utf-8')
                result = am.verify_aimd_index(index_text, expected['url'], fragment['public_key'], signature_text)
            else:
                page = (case_dir / 'page.aifeed.md').read_bytes()
                result = am.verify_aimd_document(expected['url'], page, signature_text, fragment)

            if result['verified'] != expected_result['verified']:
                problems.append('verified %s != %s' % (result['verified'], expected_result['verified']))
            error_codes = [item['code'] for item in result['errors']]
            for code in expected_result['errors']:
                if code not in error_codes:
                    problems.append('missing error %s (got %s)' % (code, error_codes))
            for key, value in expected_result.get('usage', {}).items():
                if result['usage'].get(key) != value:
                    problems.append('usage.%s %s != %s' % (key, result['usage'].get(key), value))
            if problems:
                failures.append('%s/%s: %s' % (group, case_dir.name, '; '.join(problems)))
        self.assertEqual(failures, [], '\n'.join(failures))


if __name__ == '__main__':
    unittest.main()
