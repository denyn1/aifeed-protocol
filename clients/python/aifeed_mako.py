"""Backward-compatible alias for :mod:`aifeed.mako`.

The implementation lives in the ``aifeed`` package; this module keeps the historical
``import aifeed_mako`` path (and direct script execution) working.
"""

import sys

from aifeed import mako as _mako

if __name__ == '__main__':
    raise SystemExit(_mako.main())

sys.modules[__name__] = _mako
