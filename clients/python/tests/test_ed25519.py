import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

RFC8032_TEST1 = {
    'public': bytes.fromhex('d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a'),
    'message': bytes.fromhex(''),
    'signature': bytes.fromhex(
        'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e06522490155'
        '5fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b'
    )
}

VECTOR_DIR = Path(__file__).resolve().parents[3] / 'conformance' / 'vectors' / 'positive' / '001-basic'


class Ed25519Tests(unittest.TestCase):
    def test_rfc8032_test_vector_1(self):
        self.assertTrue(av.ed25519_verify(
            RFC8032_TEST1['public'],
            RFC8032_TEST1['signature'],
            RFC8032_TEST1['message']
        ))

    def test_rfc8032_tampered_signature(self):
        signature = bytearray(RFC8032_TEST1['signature'])
        signature[0] ^= 0xFF
        self.assertFalse(av.ed25519_verify(
            RFC8032_TEST1['public'],
            bytes(signature),
            RFC8032_TEST1['message']
        ))

    def test_rfc8032_tampered_message(self):
        self.assertFalse(av.ed25519_verify(
            RFC8032_TEST1['public'],
            RFC8032_TEST1['signature'],
            b'aifeed.v0.1\n{}'
        ))

    def test_node_generated_vector_verifies(self):
        manifest_text = (VECTOR_DIR / 'ai.json').read_text(encoding='utf-8')
        signature_text = (VECTOR_DIR / 'ai-signature.json').read_text(encoding='utf-8')
        result = av.verify(manifest_text, signature_text, domain='tokobuku.example', now='2026-10-01T00:00:00Z')
        self.assertEqual(result['result'], 'VERIFIED', result['errors'])

    def test_node_generated_vector_tamper_detected(self):
        manifest_text = (VECTOR_DIR / 'ai.json').read_text(encoding='utf-8')
        signature_text = (VECTOR_DIR / 'ai-signature.json').read_text(encoding='utf-8')
        tampered = manifest_text.replace('Toko Buku Nusantara', 'Toko Buku Palsu')
        result = av.verify(tampered, signature_text, domain='tokobuku.example', now='2026-10-01T00:00:00Z')
        self.assertEqual(result['result'], 'UNVERIFIED')
        self.assertIn('bad_signature', [error['code'] for error in result['errors']])

    def test_decode_public_key_rejects_wrong_prefix(self):
        with self.assertRaises(av.AifeedError) as context:
            av.decode_public_key('ed25519:AAAA')
        self.assertEqual(context.exception.code, 'pk_format')


if __name__ == '__main__':
    unittest.main()
