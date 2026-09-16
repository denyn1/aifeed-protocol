import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402


class StrictParseTests(unittest.TestCase):
    def assert_code(self, text, code):
        with self.assertRaises(av.AifeedError) as context:
            av.parse_strict(text)
        self.assertEqual(context.exception.code, code)

    def test_valid(self):
        value = av.parse_strict('{"a":[1,2,{"b":"x"}],"c":true,"d":null}')
        self.assertEqual(value['a'][2]['b'], 'x')

    def test_duplicate_keys(self):
        self.assert_code('{"a":1,"a":2}', 'duplicate_key')

    def test_nfd(self):
        self.assert_code('{"a":"cafe\u0301"}', 'not_nfc')
        self.assertEqual(av.parse_strict('{"a":"café"}')['a'], 'café')

    def test_float(self):
        self.assert_code('{"a":1.5}', 'float_not_allowed')

    def test_integer_overflow(self):
        self.assert_code('{"a":9007199254740992}', 'integer_out_of_range')
        self.assertEqual(av.parse_strict('{"a":9007199254740991}')['a'], 9007199254740991)

    def test_depth(self):
        deep = '1'
        for _ in range(12):
            deep = '{"a":' + deep + '}'
        self.assert_code(deep, 'max_depth')

    def test_lone_surrogate(self):
        self.assert_code('{"a":"\\ud800"}', 'lone_surrogate')
        self.assertEqual(av.parse_strict('{"a":"\\ud83d\\ude00"}')['a'], '😀')

    def test_jcs_sorting_and_escaping(self):
        self.assertEqual(av.jcs({'b': 1, 'a': 2, 'A': 3}), '{"A":3,"a":2,"b":1}')
        self.assertEqual(av.jcs('a"b\\c\nd'), '"a\\"b\\\\c\\nd"')
        self.assertEqual(av.jcs('café'), '"café"')
        self.assertEqual(av.jcs({'z': [1, {'y': 'x'}], 'a': None}), '{"a":null,"z":[1,{"y":"x"}]}')


if __name__ == '__main__':
    unittest.main()
