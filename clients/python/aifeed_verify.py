"""Backward-compatible alias for :mod:`aifeed.verify`.

The implementation lives in the ``aifeed`` package; this module keeps the historical
``import aifeed_verify`` path (and direct script execution) working.
"""

import sys

from aifeed import verify as _verify

if __name__ == '__main__':
    raise SystemExit(_verify.main())

sys.modules[__name__] = _verify
