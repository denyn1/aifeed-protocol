import random
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import aifeed_verify as av  # noqa: E402

CORPUS = [
    '{"a":1}',
    '{"a":[1,2,{"b":"x\\n"}],"c":true,"d":null,"e":-3}',
    '{"name":"Caf\u00e9","emoji":"\U0001F600"}',
    '{"nested":{"deep":{"value":9007199254740991}}}',
    '{"__proto__":{"polluted":true}}',
    '{"dup":1,"dup":2}',
    '{"text":"line\\u0041\\n","tab":"\\t"}',
    '{"big":12345678901234567890}',
    '{"neg":-0,"int":0}',
    '"unterminated',
    '{"u":"\\ud800"}',
    '{"u":"\\ud83d\\ude00"}',
    '[]',
    'null',
    'true',
    '{"a": ',
    '{',
    '}',
    '{"a":1,}',
    '{"a" 1}'
]

CHAR_POOL = [
    '0', '1', '9', '-', '.', 'e', 'E', '+',
    '{', '}', '[', ']', ':', ',', '"',
    'a', 'z', 'A', 'Z', '_', ' ',
    '\\', '/', 'n', 't', 'u',
    '\u0000', '\u0001', '\u001f', '\u007f',
    '\n', '\r', '\t',
    '\u00e9', '\u00fc', '\U0001F600',
    '\ud800', '\udc00', '\ufeff'
]


def mutate(text, rng):
    for _ in range(rng.randint(1, 4)):
        operation = rng.randrange(8)
        position = rng.randint(0, len(text))
        if operation == 0:
            text = text[:position] + rng.choice(CHAR_POOL) + text[position:]
        elif operation == 1 and text:
            index = min(position, len(text) - 1)
            text = text[:index] + text[index + 1:]
        elif operation == 2 and text:
            index = min(position, len(text) - 1)
            text = text[:index] + rng.choice(CHAR_POOL) + text[index + 1:]
        elif operation == 3:
            text = text[:position]
        elif operation == 4:
            text = text[:position] + '"__proto__":{"polluted":true},' + text[position:]
        elif operation == 5:
            text = text[:position] + '"dup":1,' + text[position:]
        elif operation == 6:
            text = text[:position] + rng.choice(CHAR_POOL) * 32 + text[position:]
        else:
            text = text[:position] + '\\ud800' + text[position:]
    return text


class FuzzSmokeTests(unittest.TestCase):
    def test_smoke_fuzz_parser(self):
        rng = random.Random(20260914)
        failures = []
        for iteration in range(800):
            text = mutate(rng.choice(CORPUS), rng)
            if len(text) > 8192:
                text = text[:8192]
            try:
                value = av.parse_strict(text)
            except av.AifeedError:
                continue
            except Exception as error:  # noqa: BLE001
                failures.append((iteration, 'unexpected ' + type(error).__name__ + ': ' + str(error)))
                continue
            try:
                canonical = av.jcs(value)
                av.parse_strict(canonical)
            except Exception as error:  # noqa: BLE001
                failures.append((iteration, 'round-trip ' + type(error).__name__ + ': ' + str(error)))
        self.assertEqual(failures[:5], [])

    def test_prototype_keys_are_plain_data(self):
        value = av.parse_strict('{"__proto__":{"polluted":true},"ok":1}')
        self.assertEqual(value['ok'], 1)
        self.assertEqual(value['__proto__'], {'polluted': True})


if __name__ == '__main__':
    unittest.main()
