"""AIFeed ASGI middleware for Python (FastAPI, Starlette, Django ASGI, etc.).

Usage (FastAPI / Starlette):

    from aifeed_middleware import AifeedMiddleware
    app.add_middleware(AifeedMiddleware, root="public", mako=True)

Usage (raw ASGI):

    app = AifeedMiddleware(app, root="public")

Serves the AIFeed manifest, delta index, AIMD/MAKO content negotiation, and
llms.txt from a directory produced by `aifeed site build`. Zero dependencies.
"""

from __future__ import annotations

import base64
import json
import os
import re
from typing import Iterable

MEDIA = {"aimd": "text/aifeed+markdown", "mako": "text/mako+markdown"}
FRONTMATTER = re.compile(r"^---\r?\n(.*?)\r?\n---", re.DOTALL)


def parse_frontmatter_fields(text: str) -> dict:
    match = FRONTMATTER.match(text)
    if not match:
        return {}
    fields: dict = {}
    for line in match.group(1).splitlines():
        kv = re.match(r"^([A-Za-z0-9_-]+):\s*(.*)$", line.strip())
        if not kv:
            continue
        key, value = kv.group(1), kv.group(2).strip()
        if value.startswith('"') and value.endswith('"') and len(value) >= 2:
            value = value[1:-1]
        if key == "tokens":
            try:
                fields["tokens"] = int(value)
            except ValueError:
                pass
        elif key in ("type", "language"):
            fields[key] = value
    return fields


def _safe_join(root: str, relative: str) -> str | None:
    root = os.path.realpath(root)
    target = os.path.realpath(os.path.join(root, relative))
    if target != root and not target.startswith(root + os.sep):
        return None
    return target


class AifeedMiddleware:
    def __init__(self, app, root: str = "public", aimd: bool = True, mako: bool = False):
        self.app = app
        self.root = root
        self.aimd = aimd
        self.mako = mako

    async def __call__(self, scope, receive, send):
        if scope.get("type") != "http" or scope.get("method") not in ("GET", "HEAD"):
            return await self.app(scope, receive, send)

        path = scope.get("path", "/")
        response = self._resolve(path, dict(scope.get("headers") or {}))
        if response is None:
            return await self.app(scope, receive, send)

        status, headers, body = response
        headers = [(k.lower().encode(), v.encode()) for k, v in headers]
        if scope.get("method") == "HEAD":
            body = b""
        headers.append((b"content-length", str(len(body)).encode()))
        await send({"type": "http.response.start", "status": status, "headers": headers})
        await send({"type": "http.response.body", "body": body})

    def _resolve(self, path: str, headers: dict):
        well_known = {
            "/.well-known/ai.json": ("ai.json", self.aimd or self.mako),
            "/.well-known/ai-signature.json": ("ai-signature.json", self.aimd or self.mako),
            "/.well-known/aifeed-index.json": ("aifeed-index.json", self.aimd),
            "/.well-known/aifeed-index.json.sig": ("aifeed-index.json.sig", self.aimd),
            "/.well-known/mako-index.json": ("mako-index.json", self.mako),
            "/.well-known/mako-index.json.sig": ("mako-index.json.sig", self.mako),
        }
        if path in well_known:
            name, enabled = well_known[path]
            if not enabled:
                return None
            return self._file(os.path.join(self.root, ".well-known", name), "application/json; charset=utf-8")

        if path == "/llms.txt":
            resolved = self._file(os.path.join(self.root, "llms.txt"), "text/plain; charset=utf-8")
            if resolved:
                return resolved

        accept = headers.get(b"accept", b"").decode(errors="ignore")
        profile = None
        if self.aimd and MEDIA["aimd"] in accept:
            profile = "aimd"
        elif self.mako and MEDIA["mako"] in accept:
            profile = "mako"
        if profile is None:
            return None

        clean = path.strip("/")
        suffix = ".mako.md" if profile == "mako" else ".aifeed.md"
        candidates = ["index" + suffix] if clean == "" else [clean + suffix, clean + "/index" + suffix]
        md_path = None
        body = None
        for candidate in candidates:
            resolved = _safe_join(self.root, candidate)
            if resolved is None or not os.path.isfile(resolved):
                continue
            md_path = resolved
            with open(resolved, "rb") as handle:
                body = handle.read()
            break
        if md_path is None or body is None:
            return None
        fields = parse_frontmatter_fields(body.decode("utf-8", errors="ignore"))
        extra = {
            "vary": "Accept",
            "x-mako-version": "1.0",
            "x-mako-tokens": str(fields.get("tokens", 0)),
            "x-mako-type": fields.get("type", "custom"),
            "x-mako-lang": fields.get("language", ""),
            "x-aifeed-profile": profile,
        }
        signature_path = md_path + ".sig"
        if os.path.isfile(signature_path):
            with open(signature_path, "r", encoding="utf-8") as handle:
                container = handle.read().strip()
            extra["x-aifeed-signature"] = (
                ("mako1:" if profile == "mako" else "aimd1:")
                + base64.urlsafe_b64encode(container.encode()).decode().rstrip("=")
            )
        return 200, {"content-type": MEDIA[profile] + "; charset=utf-8", **extra}, body

    def _file(self, file_path: str, content_type: str):
        if not os.path.isfile(file_path):
            return None
        with open(file_path, "rb") as handle:
            body = handle.read()
        return 200, {"content-type": content_type, "cache-control": "public, max-age=3600, must-revalidate"}, body
