import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

BODY = b'{"hello":"world"}'
HELLO_SHA256 = 'LPJNul+wow4m6DsqxbninhsWHlwfp0JecwQzYpOLmCQ='


class ContentDigestTests(unittest.TestCase):
    def test_sha256_known_vector(self):
        self.assertEqual(av.sha256_b64(b'hello'), HELLO_SHA256)

    def test_parse_structured_field(self):
        parsed = av.parse_content_digest('sha-256=:' + HELLO_SHA256 + ':, sha-512=:AAAA:;foo=bar')
        self.assertEqual(parsed['sha-256'], HELLO_SHA256)
        self.assertEqual(parsed['sha-512'], 'AAAA')

    def test_parse_rejects_malformed(self):
        with self.assertRaises(av.AifeedError) as context:
            av.parse_content_digest('sha-256=not-a-byte-sequence')
        self.assertEqual(context.exception.code, 'content_digest_malformed')
        with self.assertRaises(av.AifeedError):
            av.parse_content_digest('')

    def test_verify_match(self):
        result = av.verify_content_digest('sha-256=:' + av.sha256_b64(BODY) + ':', BODY)
        self.assertTrue(result['ok'])
        self.assertEqual(result['algorithms'], ['sha-256'])

    def test_verify_mismatch(self):
        result = av.verify_content_digest('sha-256=:' + av.sha256_b64(b'other') + ':', BODY)
        self.assertFalse(result['ok'])
        self.assertEqual(result['errors'][0]['code'], 'content_digest_mismatch')

    def test_verify_unsupported(self):
        result = av.verify_content_digest('md5=:XrY7u+Ae7tCTyyK7j1rNww==:', BODY)
        self.assertFalse(result['ok'])
        self.assertEqual(result['errors'][0]['code'], 'content_digest_unsupported')


if __name__ == '__main__':
    unittest.main()
