"""AIFeed protocol verifier (independent Python implementation).

Modules:
    ``aifeed.verify`` — manifests, JCS, Ed25519, revocation, bundles, Content-Digest
    ``aifeed.mako``   — MAKO / AIFeed Markdown frontmatter, containers, and indices

Standard library only; no third-party dependencies.
"""

from . import mako, verify  # noqa: F401

__all__ = ['mako', 'verify', '__version__']
__version__ = '1.0.0a1'
