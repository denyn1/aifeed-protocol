import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

ROOT = Path(__file__).resolve().parents[3]
BUNDLE_DIR = ROOT / 'conformance' / 'fixtures' / 'bundles'


class DifferentialBundleTests(unittest.TestCase):
    """Node-generated bundles must verify identically in Python."""

    def run_bundle(self, name):
        bundle_dir = BUNDLE_DIR / name
        expected = json.loads((bundle_dir / 'expected.json').read_text(encoding='utf-8'))
        result = av.verify_bundle(
            bundle_dir,
            now=expected['now'],
            bundler_public_key=expected['bundler_public_key']
        )
        self.assertEqual(result['result'], expected['result'], json.dumps(result['errors']))
        self.assertEqual(result['manifest_result'], 'VERIFIED')
        warning_codes = [warning['code'] for warning in result['warnings']]
        for code in expected['warnings']:
            self.assertIn(code, warning_codes)
        return result

    def test_unsigned_bundle(self):
        result = self.run_bundle('unsigned')
        warning_codes = [warning['code'] for warning in result['warnings']]
        self.assertIn('bundle_unsigned', warning_codes)

    def test_signed_bundle(self):
        result = self.run_bundle('signed')
        warning_codes = [warning['code'] for warning in result['warnings']]
        self.assertNotIn('bundle_unsigned', warning_codes)
        self.assertNotIn('bundle_signature_invalid', [error['code'] for error in result['errors']])

    def test_traversal_entry_rejected(self):
        import shutil
        import tempfile

        source = BUNDLE_DIR / 'signed'
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / 'bundle'
            shutil.copytree(source, target)
            manifest_path = target / 'BUNDLE-MANIFEST.json'
            manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
            evil = dict(manifest['files'][0])
            evil['path'] = '../evil.txt'
            manifest['files'].append(evil)
            manifest_path.write_text(json.dumps(manifest), encoding='utf-8')
            expected = json.loads((source / 'expected.json').read_text(encoding='utf-8'))
            result = av.verify_bundle(target, now=expected['now'], bundler_public_key=expected['bundler_public_key'])
            self.assertEqual(result['result'], 'UNVERIFIED')
            self.assertIn('bundle_manifest_invalid', [error['code'] for error in result['errors']])

    def test_tampered_bundle_fails(self):
        import shutil
        import tempfile

        source = BUNDLE_DIR / 'signed'
        with tempfile.TemporaryDirectory() as temp_dir:
            target = Path(temp_dir) / 'bundle'
            shutil.copytree(source, target)
            manifest_path = target / 'manifest' / 'ai.json'
            manifest_path.write_bytes(manifest_path.read_bytes() + b' ')
            expected = json.loads((source / 'expected.json').read_text(encoding='utf-8'))
            result = av.verify_bundle(target, now=expected['now'], bundler_public_key=expected['bundler_public_key'])
            self.assertEqual(result['result'], 'UNVERIFIED')
            codes = [error['code'] for error in result['errors']]
            self.assertTrue(
                'bundle_file_mismatch' in codes or 'raw_digest_mismatch' in codes,
                'expected tamper detection, got ' + json.dumps(codes)
            )


if __name__ == '__main__':
    unittest.main()
