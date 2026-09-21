#!/usr/bin/env python3
"""AIFeed v0.1 reference verifier (zero dependencies).

Verifies signed AI-Web content declarations per the AIFeed v0.1 specification.
Implements: strict JSON parsing, JCS (RFC 8785) canonicalization, Ed25519
verification (RFC 8032, pure Python), and the v0.1 business rules.
"""

import argparse
import base64
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

PK_PATTERN = re.compile(r'^ed25519:[A-Za-z0-9+/]{59}=$')
SIG_PATTERN = re.compile(r'^base64url:[A-Za-z0-9_-]{86}$')
NS_PATTERN = re.compile(r'^0\.1(\.\d+)?$')
NS02_PATTERN = re.compile(r'^0\.2(\.\d+)?$')
SPKI_PREFIX = bytes.fromhex('302a300506032b6570032100')
MANIFEST_SEPARATION = b'aifeed.v0.1\n'
MANIFEST_SEPARATION_02 = b'aifeed.v0.2\n'
REVOCATION_SEPARATION = b'aifeed-revoke.v0.1\n'
BUNDLE_SEPARATION = b'aifeed-bundle.v0.1\n'
BUNDLE_STALE_HOURS = 168
MAX_SAFE_INTEGER = 2 ** 53 - 1
MAX_DEPTH = 10
SKEW_SECONDS = 300
MAX_CHECK_INTERVAL_HOURS = 168

ALLOWED_ROOT = {
    '$schema', 'version', 'identity', 'validity', 'content', 'permissions',
    'limits', 'types', 'capabilities', 'actions', 'revocation', 'metadata'
}
ALLOWED_ROTATION = {'successor_fp', 'predecessor_fp', 'effective_at', 'grace_until', 'supersedes_at'}
FP_PATTERN = re.compile(r'^sha256:[A-Za-z0-9_-]{43}$')
ALLOWED_IDENTITY = {
    'domain', 'name', 'organization', 'type', 'locale', 'contact',
    'public_key', 'key_id', 'signature_url'
}
ALLOWED_PERMISSIONS = {
    'default', 'usage', 'attribution', 'attribution_url', 'attribution_text'
}
ALLOWED_USAGE = {
    'search', 'retrieval', 'input', 'training', 'quote', 'summarize',
    'reproduce', 'translate', 'modify', 'embed', 'commercial_use'
}
USAGE_VALUES = {'allow', 'deny'}
ATTRIBUTION_VALUES = {'required', 'optional', 'none'}


class AifeedError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


class Verifier:
    def __init__(self, domain=None, now=None):
        self.domain = normalize_domain(domain) if domain else None
        if now is None:
            self.now_ts = datetime.now(timezone.utc).timestamp()
        elif isinstance(now, datetime):
            self.now_ts = now.timestamp() if now.tzinfo else now.replace(tzinfo=timezone.utc).timestamp()
        else:
            parsed = _parse_time(now)
            if parsed is None:
                raise AifeedError('invalid_now', 'cannot parse verification time: %r' % (now,))
            self.now_ts = parsed
        self.errors = []
        self.warnings = []
        self.version_family = None

    def error(self, code, message, path='$'):
        self.errors.append({'code': code, 'path': path, 'message': message})

    def warning(self, code, message, path='$'):
        self.warnings.append({'code': code, 'path': path, 'message': message})

    def run(self, manifest_text, signature_text):
        manifest = None
        signature = None
        parse_failed = False
        try:
            manifest = parse_strict(manifest_text)
        except AifeedError as error:
            parse_failed = True
            self.error(error.code, str(error))
        try:
            signature = parse_strict(signature_text)
        except AifeedError as error:
            parse_failed = True
            self.error(error.code, str(error))
        if isinstance(signature, dict) and signature.get('raw_digest') is not None:
            self.check_raw_digest(signature['raw_digest'], manifest_text)
        if parse_failed:
            return self.report()

        if isinstance(manifest, dict):
            manifest_version = manifest.get('version')
            if isinstance(manifest_version, str) and NS_PATTERN.match(manifest_version):
                self.version_family = '0.1'
            elif isinstance(manifest_version, str) and NS02_PATTERN.match(manifest_version):
                self.version_family = '0.2'

        self.check_manifest(manifest)
        self.check_signature(signature)

        manifest_key = None
        if isinstance(manifest, dict) and isinstance(manifest.get('identity'), dict):
            manifest_key = manifest['identity'].get('public_key')
        signature_value = signature.get('signature') if isinstance(signature, dict) else None
        key_decodable = isinstance(manifest_key, str) and bool(PK_PATTERN.match(manifest_key))
        signature_decodable = isinstance(signature_value, str) and bool(SIG_PATTERN.match(signature_value))

        if key_decodable and signature_decodable and self.version_family in ('0.1', '0.2'):
            try:
                public_key = decode_public_key(manifest_key)
                signature_bytes = decode_signature(signature_value)
                separation = MANIFEST_SEPARATION if self.version_family == '0.1' else MANIFEST_SEPARATION_02
                message = separation + jcs(manifest).encode('utf-8')
                if not ed25519_verify(public_key, signature_bytes, message):
                    self.error('bad_signature', 'Ed25519 signature verification failed')
            except AifeedError as error:
                self.error(error.code, str(error))
            except Exception as error:  # noqa: BLE001
                self.error('bad_signature', 'signature verification error: %s' % error)

        return self.report()

    def report(self):
        return {
            'result': 'VERIFIED' if not self.errors else 'UNVERIFIED',
            'errors': self.errors,
            'warnings': self.warnings
        }

    def check_manifest(self, manifest):
        if not isinstance(manifest, dict):
            self.error('schema_violation', 'manifest must be a JSON object')
            return
        for key in manifest:
            if key in ALLOWED_ROOT or key.startswith('x_'):
                continue
            if key == 'rotation' and self.version_family == '0.2':
                continue
            self.error('schema_violation', 'unknown property: ' + key)
        for key in ('version', 'identity', 'validity', 'content', 'permissions', 'revocation', 'metadata'):
            if key not in manifest:
                self.error('schema_violation', 'missing required property: ' + key)
        if self.errors:
            return

        version = manifest.get('version')
        if self.version_family is None:
            self.error('upgrade_required', 'unsupported manifest version: %r (supported: 0.1.x, 0.2.x)' % (version,))
            return

        if self.version_family == '0.2':
            content = manifest.get('content')
            if isinstance(content, dict) and 'mako' in content:
                mako_block = content['mako']
                if not isinstance(mako_block, dict):
                    self.error('schema_violation', 'content.mako must be an object')
                else:
                    for key in mako_block:
                        if key.startswith('x_'):
                            continue
                        if key not in ('index_url', 'signature', 'overrides', 'embedding'):
                            self.error('schema_violation', 'unknown content.mako property: ' + key)
                    index_url = mako_block.get('index_url')
                    if index_url is not None and (not isinstance(index_url, str) or not index_url.startswith('/')):
                        self.error('schema_violation', 'content.mako.index_url must be a path')
                    if mako_block.get('signature') is not None and mako_block['signature'] not in ('required', 'optional'):
                        self.error('schema_violation', 'content.mako.signature must be required or optional')
                    if mako_block.get('overrides') is not None and mako_block['overrides'] not in ('restrict-only', 'bidirectional'):
                        self.error('schema_violation', 'content.mako.overrides must be restrict-only or bidirectional')
                    if mako_block.get('embedding') is not None and not isinstance(mako_block['embedding'], bool):
                        self.error('schema_violation', 'content.mako.embedding must be a boolean')

        identity = manifest['identity']
        if not isinstance(identity, dict):
            self.error('schema_violation', 'identity must be an object')
            return
        for key in identity:
            if key not in ALLOWED_IDENTITY and not key.startswith('x_'):
                self.error('schema_violation', 'unknown identity property: ' + key)
        for key in ('domain', 'name', 'type', 'locale', 'contact', 'public_key', 'key_id', 'signature_url'):
            if key not in identity:
                self.error('schema_violation', 'missing identity property: ' + key)
        if 'public_key' in identity and not PK_PATTERN.match(str(identity.get('public_key', ''))):
            self.error('schema_violation', 'public_key must match ed25519:<base64 SPKI>')

        validity = manifest['validity']
        signed_at = _parse_time(validity.get('signed_at')) if isinstance(validity, dict) else None
        expires_at = _parse_time(validity.get('expires_at')) if isinstance(validity, dict) else None
        if signed_at is None or expires_at is None:
            self.error('schema_violation', 'validity must contain RFC 3339 signed_at and expires_at')
        else:
            if signed_at > self.now_ts + SKEW_SECONDS:
                self.error('validity_not_yet_valid', 'signed_at is too far in the future')
            if expires_at <= self.now_ts:
                self.error('expired', 'manifest has expired')
            if expires_at <= signed_at:
                self.error('validity_order', 'expires_at must be after signed_at')

        permissions = manifest['permissions']
        if isinstance(permissions, dict):
            for key in permissions:
                if key not in ALLOWED_PERMISSIONS and not key.startswith('x_'):
                    self.error('schema_violation', 'unknown permissions property: ' + key)
            if permissions.get('default') not in USAGE_VALUES:
                self.error('schema_violation', 'permissions.default must be allow or deny')
            if permissions.get('attribution') not in ATTRIBUTION_VALUES:
                self.error('schema_violation', 'permissions.attribution must be required, optional, or none')
            usage = permissions.get('usage')
            if isinstance(usage, dict):
                for key, value in usage.items():
                    if key.startswith('x_'):
                        continue
                    if key not in ALLOWED_USAGE:
                        self.error('schema_violation', 'unknown usage permission: ' + key)
                    elif value not in USAGE_VALUES:
                        self.error('schema_violation', 'usage.%s must be allow or deny' % key)
            else:
                self.error('schema_violation', 'permissions.usage must be an object')
        else:
            self.error('schema_violation', 'permissions must be an object')

        revocation = manifest['revocation']
        if isinstance(revocation, dict):
            list_url = revocation.get('list_url')
            interval = revocation.get('maximum_check_interval_hours')
            if not isinstance(list_url, str) or not list_url.startswith('https://aifeed.md/revoke/v1/'):
                self.error('schema_violation', 'revocation.list_url must be an aifeed.md canonical URL')
            if not isinstance(interval, int) or isinstance(interval, bool) or interval < 1:
                self.error('schema_violation', 'revocation.maximum_check_interval_hours must be a positive integer')
            elif interval > MAX_CHECK_INTERVAL_HOURS:
                self.warning('check_interval_capped', 'maximum_check_interval_hours above %d is ignored by clients' % MAX_CHECK_INTERVAL_HOURS)
            if isinstance(list_url, str) and self.domain:
                canonical = 'https://aifeed.md/revoke/v1/%s.json' % self.domain
                if list_url != canonical:
                    self.warning('revocation_url_mismatch', 'list_url should be ' + canonical)
        else:
            self.error('schema_violation', 'revocation must be an object')

        if self.domain:
            manifest_domain = normalize_domain(identity.get('domain', ''))
            if manifest_domain != self.domain:
                self.error('domain_mismatch', 'manifest domain %r does not match expected %r' % (manifest_domain, self.domain))

        self.check_rotation(manifest)

    def check_rotation(self, manifest):
        if self.version_family != '0.2' or 'rotation' not in manifest:
            return
        directive = manifest['rotation']
        if not isinstance(directive, dict):
            self.error('schema_violation', 'rotation must be an object')
            return
        for key in directive:
            if key.startswith('x_'):
                continue
            if key not in ALLOWED_ROTATION:
                self.error('schema_violation', 'unknown rotation property: ' + key)
        successor = directive.get('successor_fp')
        predecessor = directive.get('predecessor_fp')
        if successor is not None and predecessor is not None:
            self.error('rotation_invalid', 'rotation must not carry successor_fp and predecessor_fp together')
            return
        if successor is None and predecessor is None:
            self.error('rotation_invalid', 'rotation requires successor_fp or predecessor_fp')
            return
        if successor is not None:
            if not isinstance(successor, str) or not FP_PATTERN.match(successor):
                self.error('schema_violation', 'rotation.successor_fp must be a sha256 fingerprint')
                return
            effective_raw = directive.get('effective_at')
            grace_raw = directive.get('grace_until')
            if effective_raw is None or grace_raw is None:
                self.error('rotation_invalid', 'successor_fp requires effective_at and grace_until')
                return
            effective_at = _parse_time(effective_raw)
            grace_until = _parse_time(grace_raw)
            if effective_at is None or grace_until is None:
                self.error('rotation_invalid', 'rotation timestamps must be UTC instants (YYYY-MM-DDTHH:MM:SSZ)')
                return
            if grace_until - effective_at < 3600:
                self.error('rotation_invalid', 'grace_until must exceed effective_at by at least 1 hour')
            if self.now_ts >= grace_until:
                self.error('rotation_denied', 'old signing key is past grace_until; rotation must be completed')
            elif self.now_ts >= effective_at:
                self.warning('grace_accepted', 'old signing key accepted inside its grace window')
            return
        if not isinstance(predecessor, str) or not FP_PATTERN.match(predecessor):
            self.error('schema_violation', 'rotation.predecessor_fp must be a sha256 fingerprint')
            return
        if directive.get('supersedes_at') is None:
            self.error('rotation_invalid', 'predecessor_fp requires supersedes_at')
            return
        supersedes_at = _parse_time(directive.get('supersedes_at'))
        signed_at = _parse_time(manifest.get('validity', {}).get('signed_at')) if isinstance(manifest.get('validity'), dict) else None
        if supersedes_at is None:
            self.error('rotation_invalid', 'rotation timestamps must be UTC instants (YYYY-MM-DDTHH:MM:SSZ)')
        elif signed_at is not None and supersedes_at > signed_at + SKEW_SECONDS:
            self.error('rotation_invalid', 'supersedes_at must not follow signed_at by more than %d seconds' % SKEW_SECONDS)

    def check_raw_digest(self, raw_digest, manifest_text):
        if not isinstance(raw_digest, dict):
            self.error('signature_malformed', 'raw_digest must be an object')
            return
        applies_to = raw_digest.get('applies_to')
        if applies_to != 'raw-bytes':
            self.error('signature_malformed', 'raw_digest.applies_to must be "raw-bytes"')
        expected = raw_digest.get('sha-256')
        if not isinstance(expected, str) or not re.match(r'^[A-Za-z0-9+/]{43}=$', expected):
            self.error('signature_malformed', 'raw_digest.sha-256 must be base64 of a 32-byte digest')
            return
        actual = base64.b64encode(hashlib.sha256(manifest_text.encode('utf-8')).digest()).decode('ascii')
        if actual != expected:
            self.error('raw_digest_mismatch', 'raw bytes do not match raw_digest.sha-256')

    def check_signature(self, signature):
        if not isinstance(signature, dict):
            self.error('signature_malformed', 'signature file must be a JSON object')
            return
        if signature.get('algorithm') != 'ed25519':
            self.error('signature_malformed', 'algorithm must be ed25519')
        if signature.get('canonicalization') != 'jcs-rfc8785':
            self.error('signature_malformed', 'canonicalization must be jcs-rfc8785')
        value = signature.get('signature')
        if not isinstance(value, str) or not SIG_PATTERN.match(value):
            self.error('signature_malformed', 'signature must match base64url:<86 chars>')


def normalize_domain(value):
    if not isinstance(value, str):
        return None
    domain = value.strip().lower().rstrip('.')
    if not domain or len(domain) > 253:
        return None
    if '/' in domain or ':' in domain or ' ' in domain or '@' in domain:
        return None
    try:
        domain.encode('ascii')
        ascii_domain = domain
    except UnicodeEncodeError:
        try:
            ascii_domain = domain.encode('idna').decode('ascii').lower()
        except UnicodeError:
            return None
    if not ascii_domain or len(ascii_domain) > 253:
        return None
    for label in ascii_domain.split('.'):
        if not label or len(label) > 63 or label.startswith('-') or label.endswith('-'):
            return None
    return ascii_domain


def _parse_time(value):
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.strptime(value, '%Y-%m-%dT%H:%M:%SZ')
    except ValueError:
        return None
    return parsed.replace(tzinfo=timezone.utc).timestamp()


def _now_ts(value):
    if value is None:
        return datetime.now(timezone.utc).timestamp()
    if isinstance(value, datetime):
        return value.timestamp() if value.tzinfo else value.replace(tzinfo=timezone.utc).timestamp()
    parsed = _parse_time(value)
    if parsed is None:
        raise AifeedError('invalid_now', 'cannot parse verification time: %r' % (value,))
    return parsed


def _pairs_hook(pairs):
    seen = set()
    result = {}
    for key, value in pairs:
        if key in seen:
            raise AifeedError('duplicate_key', 'duplicate object key: ' + key)
        seen.add(key)
        result[key] = value
    return result


def _reject_float(value):
    raise AifeedError('float_not_allowed', 'floating point numbers are not allowed: ' + value)


def _reject_constant(value):
    raise AifeedError('parse_error', 'non-finite numbers are not allowed: ' + value)


def parse_strict(text):
    try:
        value = json.loads(
            text,
            object_pairs_hook=_pairs_hook,
            parse_float=_reject_float,
            parse_constant=_reject_constant
        )
    except AifeedError:
        raise
    except json.JSONDecodeError as error:
        raise AifeedError('parse_error', 'invalid JSON: %s' % error) from error
    _check_value(value, 0)
    return value


def _check_value(value, depth):
    if depth > MAX_DEPTH:
        raise AifeedError('max_depth', 'maximum nesting depth exceeded')
    if isinstance(value, dict):
        for key, item in value.items():
            _check_string(key)
            _check_value(item, depth + 1)
    elif isinstance(value, list):
        for item in value:
            _check_value(item, depth + 1)
    elif isinstance(value, str):
        _check_string(value)
    elif isinstance(value, bool):
        return
    elif isinstance(value, int):
        if abs(value) > MAX_SAFE_INTEGER:
            raise AifeedError('integer_out_of_range', 'integer exceeds ±2^53-1')
    elif value is None:
        return
    else:
        raise AifeedError('parse_error', 'unsupported value type: %s' % type(value).__name__)


def _check_string(value):
    if any(0xD800 <= ord(ch) <= 0xDFFF for ch in value):
        raise AifeedError('lone_surrogate', 'lone surrogate in string')
    import unicodedata
    if unicodedata.normalize('NFC', value) != value:
        raise AifeedError('not_nfc', 'string is not NFC normalized')


def _sort_key(name):
    return name.encode('utf-16-be')


def _escape_string(value):
    out = ['"']
    for ch in value:
        code = ord(ch)
        if ch == '"':
            out.append('\\"')
        elif ch == '\\':
            out.append('\\\\')
        elif ch == '\b':
            out.append('\\b')
        elif ch == '\f':
            out.append('\\f')
        elif ch == '\n':
            out.append('\\n')
        elif ch == '\r':
            out.append('\\r')
        elif ch == '\t':
            out.append('\\t')
        elif code < 0x20:
            out.append('\\u%04x' % code)
        elif 0xD800 <= code <= 0xDFFF:
            raise AifeedError('lone_surrogate', 'lone surrogate in string')
        else:
            out.append(ch)
    out.append('"')
    return ''.join(out)


def jcs(value):
    if value is None:
        return 'null'
    if isinstance(value, bool):
        return 'true' if value else 'false'
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        raise AifeedError('float_not_allowed', 'floating point numbers are not allowed')
    if isinstance(value, str):
        return _escape_string(value)
    if isinstance(value, list):
        return '[' + ','.join(jcs(item) for item in value) + ']'
    if isinstance(value, dict):
        keys = sorted(value.keys(), key=_sort_key)
        return '{' + ','.join(_escape_string(key) + ':' + jcs(value[key]) for key in keys) + '}'
    raise AifeedError('parse_error', 'unsupported value type: %s' % type(value).__name__)


def public_key_der(value):
    if not isinstance(value, str) or not PK_PATTERN.match(value):
        raise AifeedError('pk_format', 'invalid public key encoding')
    der = base64.b64decode(value[len('ed25519:'):])
    if len(der) != 44 or not der.startswith(SPKI_PREFIX):
        raise AifeedError('pk_format', 'invalid SPKI DER structure')
    return der


def decode_public_key(value):
    return public_key_der(value)[len(SPKI_PREFIX):]


def fingerprint_of_der(der):
    digest = hashlib.sha256(der).digest()
    return 'sha256:' + base64.urlsafe_b64encode(digest).decode('ascii').rstrip('=')


def fingerprint_of(value):
    return fingerprint_of_der(public_key_der(value))


def decode_signature(value):
    if not isinstance(value, str) or not SIG_PATTERN.match(value):
        raise AifeedError('signature_malformed', 'invalid signature encoding')
    import base64
    raw = base64.urlsafe_b64decode(value[len('base64url:'):] + '==')
    if len(raw) != 64:
        raise AifeedError('signature_malformed', 'signature must be 64 bytes')
    return raw


_Q = 2 ** 255 - 19
_L = 2 ** 252 + 27742317777372353535851937790883648493
_D = -121665 * pow(121666, _Q - 2, _Q) % _Q
_I = pow(2, (_Q - 1) // 4, _Q)


def _x_recover(y):
    xx = (y * y - 1) * pow(_D * y * y + 1, _Q - 2, _Q)
    x = pow(xx, (_Q + 3) // 8, _Q)
    if (x * x - xx) % _Q != 0:
        x = (x * _I) % _Q
    if x % 2 != 0:
        x = _Q - x
    return x


_BY = 4 * pow(5, _Q - 2, _Q) % _Q
_BX = _x_recover(_BY)
_B = (_BX % _Q, _BY % _Q)


def _edwards(point, other):
    x1, y1 = point
    x2, y2 = other
    denominator = _D * x1 * x2 * y1 * y2
    x3 = (x1 * y2 + x2 * y1) * pow(1 + denominator, _Q - 2, _Q)
    y3 = (y1 * y2 + x1 * x2) * pow(1 - denominator, _Q - 2, _Q)
    return (x3 % _Q, y3 % _Q)


def _scalar_mult(point, scalar):
    result = (0, 1)
    addend = point
    while scalar > 0:
        if scalar & 1:
            result = _edwards(result, addend)
        addend = _edwards(addend, addend)
        scalar >>= 1
    return result


def _on_curve(point):
    x, y = point
    return (-x * x + y * y - 1 - _D * x * x * y * y) % _Q == 0


def _decode_point(data):
    y = int.from_bytes(data, 'little') & ((1 << 255) - 1)
    x = _x_recover(y)
    if (x & 1) != (data[31] >> 7):
        x = _Q - x
    point = (x, y)
    if not _on_curve(point):
        raise AifeedError('bad_signature', 'public key point is not on the curve')
    return point


def ed25519_verify(public_key_raw, signature, message):
    if len(public_key_raw) != 32 or len(signature) != 64:
        return False
    try:
        point_a = _decode_point(public_key_raw)
        point_r = _decode_point(signature[:32])
    except AifeedError:
        return False
    scalar_s = int.from_bytes(signature[32:], 'little')
    if scalar_s >= _L:
        return False
    digest = hashlib.sha512(signature[:32] + public_key_raw + message).digest()
    scalar_k = int.from_bytes(digest, 'little') % _L
    left = _scalar_mult(_B, scalar_s)
    right = _edwards(point_r, _scalar_mult(point_a, scalar_k))
    return left == right


def sha256_b64(data):
    return base64.b64encode(hashlib.sha256(data).digest()).decode('ascii')


def sha512_b64(data):
    return base64.b64encode(hashlib.sha512(data).digest()).decode('ascii')


def parse_content_digest(header):
    if not isinstance(header, str) or not header.strip():
        raise AifeedError('content_digest_malformed', 'Content-Digest header is empty')
    result = {}
    for part in header.split(','):
        member = part.strip()
        if not member:
            continue
        if '=' not in member:
            raise AifeedError('content_digest_malformed', 'invalid Content-Digest member: ' + member)
        algorithm, value = member.split('=', 1)
        algorithm = algorithm.strip().lower()
        value = value.strip()
        if ';' in value:
            value = value.split(';', 1)[0].strip()
        if not (value.startswith(':') and value.endswith(':')):
            raise AifeedError('content_digest_malformed', 'Content-Digest value must be a byte sequence')
        encoded = value[1:-1]
        if not re.match(r'^[A-Za-z0-9+/]*={0,2}$', encoded):
            raise AifeedError('content_digest_malformed', 'Content-Digest value is not valid base64')
        result[algorithm] = encoded
    if not result:
        raise AifeedError('content_digest_malformed', 'Content-Digest header has no members')
    return result


def verify_content_digest(header, body_bytes):
    digests = parse_content_digest(header)
    checked = []
    for algorithm in ('sha-512', 'sha-256'):
        if algorithm not in digests:
            continue
        actual = sha512_b64(body_bytes) if algorithm == 'sha-512' else sha256_b64(body_bytes)
        if digests[algorithm] != actual:
            return {
                'ok': False,
                'algorithm': algorithm,
                'errors': [{'code': 'content_digest_mismatch', 'message': 'Content-Digest ' + algorithm + ' mismatch'}]
            }
        checked.append(algorithm)
    if not checked:
        return {
            'ok': False,
            'errors': [{'code': 'content_digest_unsupported', 'message': 'no supported Content-Digest algorithm found'}]
        }
    return {'ok': True, 'algorithms': checked, 'errors': []}


def without_signatures(document):
    return {key: value for key, value in document.items() if key != 'signatures'}


def verify_revocation_document(text, domain=None, now=None, governance_keys=None, threshold=2):
    errors = []
    warnings = []
    now_ts = _now_ts(now)
    try:
        document = parse_strict(text)
    except AifeedError as error:
        return {
            'status': 'invalid',
            'result': 'invalid',
            'valid_signatures': 0,
            'errors': [{'code': error.code, 'message': str(error)}],
            'warnings': warnings
        }

    if domain and normalize_domain(document.get('domain')) != normalize_domain(domain):
        errors.append({'code': 'revocation_domain_mismatch', 'message': 'revocation domain does not match ' + domain})
    if document.get('status') not in ('active', 'under_review', 'suspended'):
        errors.append({'code': 'revocation_status_invalid', 'message': 'revocation status must be one of active, under_review, suspended'})
    expires_at = _parse_time(document.get('expires_at')) if isinstance(document.get('expires_at'), str) else None
    if expires_at is None:
        errors.append({'code': 'revocation_expires_invalid', 'message': 'revocation document requires a valid expires_at timestamp'})
    elif expires_at <= now_ts:
        errors.append({'code': 'revocation_document_expired', 'message': 'revocation document has expired'})
    elif expires_at > now_ts + 30 * 24 * 3600:
        warnings.append({'code': 'revocation_expiry_long', 'message': 'revocation document lifetime exceeds 30 days'})

    valid_signatures = 0
    signatures = document.get('signatures')
    if not isinstance(signatures, list) or not signatures:
        errors.append({'code': 'revocation_unsigned', 'message': 'revocation document has no signatures'})
    elif governance_keys:
        signed = without_signatures(document)
        message = REVOCATION_SEPARATION + jcs(signed).encode('utf-8')
        valid_fingerprints = set()
        for entry in signatures:
            if not isinstance(entry, dict):
                continue
            try:
                signature_bytes = decode_signature(entry.get('signature'))
            except AifeedError:
                continue
            for key_value in governance_keys:
                try:
                    public_key = decode_public_key(key_value)
                except AifeedError:
                    continue
                try:
                    if ed25519_verify(public_key, signature_bytes, message):
                        valid_fingerprints.add(fingerprint_of(key_value))
                except Exception:  # noqa: BLE001
                    continue
        valid_signatures = len(valid_fingerprints)
        if valid_signatures < threshold:
            errors.append({
                'code': 'revocation_threshold_not_met',
                'message': 'only %d valid governance signature(s); threshold is %d' % (valid_signatures, threshold)
            })
    else:
        warnings.append({
            'code': 'revocation_signature_unchecked',
            'message': 'no governance keys provided; revocation signatures not verified'
        })

    return {
        'status': document.get('status'),
        'result': 'valid' if not errors else 'invalid',
        'valid_signatures': valid_signatures,
        'errors': errors,
        'warnings': warnings
    }


def verify_bundle(bundle_dir, now=None, bundler_public_key=None):
    errors = []
    warnings = []
    now_ts = _now_ts(now)
    root = Path(bundle_dir)

    try:
        manifest = parse_strict((root / 'BUNDLE-MANIFEST.json').read_text(encoding='utf-8'))
    except AifeedError as error:
        return {
            'result': 'UNVERIFIED',
            'errors': [{'code': error.code, 'message': str(error)}],
            'warnings': warnings,
            'files': 0,
            'created_at': None,
            'age_hours': None
        }
    except OSError as error:
        return {
            'result': 'UNVERIFIED',
            'errors': [{'code': 'bundle_manifest_invalid', 'message': str(error)}],
            'warnings': warnings,
            'files': 0,
            'created_at': None,
            'age_hours': None
        }

    if (
        not isinstance(manifest, dict)
        or not isinstance(manifest.get('files'), list)
        or not isinstance(manifest.get('domain'), str)
        or not isinstance(manifest.get('created_at'), str)
    ):
        return {
            'result': 'UNVERIFIED',
            'errors': [{'code': 'bundle_manifest_invalid', 'message': 'missing required bundle manifest fields'}],
            'warnings': warnings,
            'files': 0,
            'created_at': None,
            'age_hours': None
        }

    for entry in manifest['files']:
        if not isinstance(entry, dict) or not isinstance(entry.get('path'), str) or not isinstance(entry.get('sha-256'), str):
            errors.append({'code': 'bundle_manifest_invalid', 'message': 'invalid file entry in bundle manifest'})
            continue
        rel = entry['path']
        if rel.startswith('/') or rel.startswith('\\') or '..' in rel.replace('\\', '/').split('/'):
            errors.append({'code': 'bundle_manifest_invalid', 'message': 'unsafe file path in bundle manifest: ' + rel})
            continue
        target = (root / rel).resolve()
        try:
            target.relative_to(root.resolve())
        except ValueError:
            errors.append({'code': 'bundle_manifest_invalid', 'message': 'file path escapes bundle directory: ' + rel})
            continue
        try:
            data = target.read_bytes()
        except OSError as error:
            errors.append({'code': 'bundle_file_missing', 'message': 'cannot read ' + entry['path'] + ': ' + str(error)})
            continue
        if isinstance(entry.get('size'), int) and len(data) != entry['size']:
            errors.append({'code': 'bundle_file_mismatch', 'message': 'size mismatch for ' + entry['path']})
        if sha256_b64(data) != entry['sha-256']:
            errors.append({'code': 'bundle_file_mismatch', 'message': 'sha-256 mismatch for ' + entry['path']})

    bundler = manifest.get('bundler')
    if isinstance(bundler, dict):
        if bundler_public_key:
            signed = {key: value for key, value in manifest.items() if key != 'bundler'}
            message = BUNDLE_SEPARATION + jcs(signed).encode('utf-8')
            try:
                public_key = decode_public_key(bundler_public_key)
                signature_bytes = decode_signature(bundler.get('signature'))
                if not ed25519_verify(public_key, signature_bytes, message):
                    errors.append({'code': 'bundle_signature_invalid', 'message': 'bundler signature verification failed'})
            except AifeedError as error:
                errors.append({'code': 'bundle_signature_invalid', 'message': str(error)})
        else:
            warnings.append({'code': 'bundle_signature_unverified', 'message': 'bundler public key not provided; signature not checked'})
    else:
        warnings.append({'code': 'bundle_unsigned', 'message': 'bundle has no bundler signature'})

    manifest_result = None
    try:
        manifest_result = verify(
            (root / 'manifest' / 'ai.json').read_text(encoding='utf-8'),
            (root / 'manifest' / 'ai-signature.json').read_text(encoding='utf-8'),
            domain=manifest.get('domain'),
            now=now
        )
        errors.extend(manifest_result['errors'])
        warnings.extend(manifest_result['warnings'])
    except OSError as error:
        errors.append({'code': 'bundle_manifest_missing', 'message': str(error)})

    created_at = _parse_time(manifest.get('created_at'))
    age_hours = None if created_at is None else max(0.0, (now_ts - created_at) / 3600.0)
    if age_hours is not None and age_hours > BUNDLE_STALE_HOURS and not errors:
        errors.append({
            'code': 'bundle_stale',
            'message': 'bundle is older than %d hours; trust reduced' % BUNDLE_STALE_HOURS
        })

    return {
        'result': 'VERIFIED' if not errors else 'UNVERIFIED',
        'errors': errors,
        'warnings': warnings,
        'files': len(manifest['files']),
        'created_at': manifest.get('created_at'),
        'age_hours': None if age_hours is None else round(age_hours, 2),
        'manifest_result': manifest_result['result'] if manifest_result else None
    }


def read_key_file(path):
    lines = Path(path).read_text(encoding='utf-8').split('\n')
    return [line.strip() for line in lines if line.strip().startswith('ed25519:')]


def verify(manifest_text, signature_text, domain=None, now=None):
    return Verifier(domain=domain, now=now).run(manifest_text, signature_text)


def verify_directory(target, domain=None, now=None):
    target_path = Path(target)
    if target_path.is_dir():
        manifest_path = target_path / 'ai.json'
        signature_path = target_path / 'ai-signature.json'
    else:
        manifest_path = target_path
        signature_path = target_path.parent / 'ai-signature.json'
    return verify(
        manifest_path.read_text(encoding='utf-8'),
        signature_path.read_text(encoding='utf-8'),
        domain=domain,
        now=now
    )


def main(argv=None):
    parser = argparse.ArgumentParser(prog='aifeed-verify', description='AIFeed v0.1 reference verifier')
    parser.add_argument('mode_or_target', help="manifest target, or 'bundle'/'revocation'")
    parser.add_argument('maybe_target', nargs='?', help='target for bundle/revocation mode')
    parser.add_argument('--domain', help='expected domain')
    parser.add_argument('--now', help='verification time, RFC 3339 (default: now)')
    parser.add_argument('--governance-key', help='file with governance public keys (one per line)')
    parser.add_argument('--bundler-key', help='file with the bundler public key')
    parser.add_argument('--json', action='store_true', help='machine readable output')
    args = parser.parse_args(argv)

    mode = 'manifest'
    target = args.mode_or_target
    if args.mode_or_target in ('bundle', 'revocation'):
        mode = args.mode_or_target
        target = args.maybe_target
        if not target:
            parser.error('target required for mode ' + mode)

    if mode == 'manifest':
        result = verify_directory(target, domain=args.domain, now=args.now)
        success = result['result'] == 'VERIFIED'
    elif mode == 'revocation':
        governance_keys = read_key_file(args.governance_key) if args.governance_key else []
        result = verify_revocation_document(
            Path(target).read_text(encoding='utf-8'),
            domain=args.domain,
            now=args.now,
            governance_keys=governance_keys
        )
        success = result['result'] == 'valid'
    else:
        bundler_public_key = None
        if args.bundler_key:
            keys = read_key_file(args.bundler_key)
            bundler_public_key = keys[0] if keys else None
        result = verify_bundle(target, now=args.now, bundler_public_key=bundler_public_key)
        success = result['result'] == 'VERIFIED'

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print('Result   :', result.get('result', 'UNVERIFIED'))
        for key, label in (('files', 'Files'), ('created_at', 'Created'), ('age_hours', 'AgeHours'), ('valid_signatures', 'ValidSigs'), ('status', 'Status')):
            if key in result and result[key] is not None:
                print('%-9s:' % label, result[key])
        print('Errors   :', 'none' if not result['errors'] else '')
        for error in result['errors']:
            print('  - [%s] %s' % (error['code'], error['message']))
        print('Warnings :', 'none' if not result['warnings'] else '')
        for warning in result['warnings']:
            print('  - [%s] %s' % (warning['code'], warning['message']))
    return 0 if success else 1


if __name__ == '__main__':
    sys.exit(main())
