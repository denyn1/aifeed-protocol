#!/usr/bin/env python3
"""AIFeed v0.2 MAKO verification (zero dependencies).

Cross-language parity module for the AIFeed MAKO trust layer: safe YAML-subset
frontmatter parsing, signature container verification, permission binding, and
delta index verification. Reuses the Ed25519/JCS primitives from aifeed_verify.
"""

import base64
import hashlib
import re
import unicodedata
from datetime import datetime, timezone
from urllib.parse import urlparse

from . import verify as av

MAKO_SEPARATION = b'aifeed.mako.v0.2\n'
MAKO_INDEX_SEPARATION = b'aifeed.mako-index.v0.2\n'
AIMD_SEPARATION = b'aifeed.aimd.v1\n'
AIMD_INDEX_SEPARATION = b'aifeed.aimd-index.v1\n'
MAKO_MEDIA_TYPE = 'text/mako+markdown'
AIMD_MEDIA_TYPE = 'text/aifeed+markdown'
SEPARATIONS = {
    'mako': MAKO_SEPARATION,
    'mako-index': MAKO_INDEX_SEPARATION,
    'aimd': AIMD_SEPARATION,
    'aimd-index': AIMD_INDEX_SEPARATION
}
FRONTMATTER_MAX_BYTES = 32768
SCALAR_MAX_LENGTH = 8192
NODE_LIMIT = 512
DEPTH_LIMIT = 6

USAGE_KEYS = [
    'search', 'retrieval', 'input', 'training', 'quote', 'summarize',
    'reproduce', 'translate', 'modify', 'embed', 'commercial_use'
]
MAKO_TYPES = ['product', 'article', 'docs', 'landing', 'profile', 'listing', 'event', 'recipe', 'faq', 'custom']
SITE_TYPES = ['ecommerce', 'news', 'education', 'government', 'saas', 'portfolio', 'community', 'docs', 'nonprofit', 'personal', 'blog', 'media', 'marketplace', 'other']
ATTRIBUTION_ORDER = {'none': 0, 'optional': 1, 'required': 2}

KEY_PATTERN = re.compile(r'^[A-Za-z0-9_-]{1,64}$')
INTEGER_PATTERN = re.compile(r'^-?(0|[1-9][0-9]*)$')
FLOAT_PATTERN = re.compile(r'^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$')
UPDATE_PATTERN = re.compile(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}(T[0-9]{2}:[0-9]{2}:[0-9]{2}Z)?$')
LANGUAGE_PATTERN = re.compile(r'^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$')
ASCII_URL_PATTERN = re.compile(r'^https://[\x21-\x7e]+$')
LOOPBACK_URL_PATTERN = re.compile(r'^http://(127\.0\.0\.1|\[::1\]|localhost)(:\d+)?(/[\x21-\x7e]*)?$')
DOMAIN_PATTERN = re.compile(r'^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$')
SHA256_B64_PATTERN = re.compile(r'^[A-Za-z0-9+/]{43}=$')


def is_mako_url(value):
    if not isinstance(value, str):
        return False
    return bool(ASCII_URL_PATTERN.match(value) or LOOPBACK_URL_PATTERN.match(value))


class MakoFrontmatterError(Exception):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def _error(code, message, **extra):
    result = {'code': code, 'message': message}
    result.update(extra)
    return result


def _decode_utf8(data):
    return data.decode('utf-8')


def _normalize_scalar(value, line):
    if unicodedata.normalize('NFC', value) != value:
        raise MakoFrontmatterError('not_nfc', 'scalar is not NFC normalized (line %d)' % line)
    if len(value) > SCALAR_MAX_LENGTH:
        raise MakoFrontmatterError('scalar_too_long', 'scalar exceeds %d chars (line %d)' % (SCALAR_MAX_LENGTH, line))
    for char in value:
        if ord(char) < 0x20 and char != '\t':
            raise MakoFrontmatterError('yaml_control_char', 'control character in scalar (line %d)' % line)
    return value


def _parse_plain_scalar(raw, line):
    value = raw
    comment_index = re.search(r' #', value)
    if comment_index:
        value = value[:comment_index.start()]
    value = value.rstrip(' ')
    if value == '':
        raise MakoFrontmatterError('yaml_empty_value', 'empty scalar value (line %d)' % line)
    first = value[0]
    if first == '&':
        raise MakoFrontmatterError('yaml_anchor_forbidden', 'anchors are forbidden (line %d)' % line)
    if first == '*':
        raise MakoFrontmatterError('yaml_alias_forbidden', 'aliases are forbidden (line %d)' % line)
    if first == '!':
        raise MakoFrontmatterError('yaml_tag_forbidden', 'tags are forbidden (line %d)' % line)
    if first == '%':
        raise MakoFrontmatterError('yaml_directive_forbidden', 'directives are forbidden (line %d)' % line)
    if first in ('|', '>'):
        raise MakoFrontmatterError('yaml_block_scalar_forbidden', 'block scalars are forbidden (line %d)' % line)
    if first == '~':
        raise MakoFrontmatterError('yaml_null_forbidden', 'null is forbidden (line %d)' % line)
    if first in ('{', '['):
        raise MakoFrontmatterError('yaml_flow_forbidden', 'flow collections are forbidden (line %d)' % line)
    if value.startswith('<<'):
        raise MakoFrontmatterError('yaml_merge_forbidden', 'merge keys are forbidden (line %d)' % line)
    if value == '...':
        raise MakoFrontmatterError('yaml_document_marker_forbidden', 'document markers are forbidden (line %d)' % line)
    if ': ' in value:
        raise MakoFrontmatterError('yaml_inline_mapping_forbidden', 'inline mappings are forbidden (line %d)' % line)
    if value in ('null', 'Null', 'NULL'):
        raise MakoFrontmatterError('yaml_null_forbidden', 'null is forbidden (line %d)' % line)
    if value == 'true':
        return True
    if value == 'false':
        return False
    if INTEGER_PATTERN.match(value):
        number = int(value)
        if abs(number) > av.MAX_SAFE_INTEGER:
            raise MakoFrontmatterError('integer_out_of_range', 'integer exceeds ±2^53-1 (line %d)' % line)
        return 0 if number == 0 else number
    if FLOAT_PATTERN.match(value):
        raise MakoFrontmatterError('float_not_allowed', 'floating point numbers are forbidden (line %d)' % line)
    return _normalize_scalar(value, line)


def _parse_quoted_scalar(raw, line, quote):
    body = raw[1:]
    out = []
    closed = False
    index = 0
    while index < len(body):
        char = body[index]
        if char == quote:
            if quote == "'" and index + 1 < len(body) and body[index + 1] == "'":
                out.append("'")
                index += 2
                continue
            closed = True
            rest = body[index + 1:]
            if rest.strip() != '' and not rest.lstrip().startswith('#'):
                raise MakoFrontmatterError('yaml_parse_error', 'trailing content after quoted scalar (line %d)' % line)
            break
        if quote == '"' and char == '\\':
            escape = body[index + 1:index + 2]
            simple = {'n': '\n', 't': '\t', 'r': '\r', '"': '"', '\\': '\\', '/': '/'}
            if escape in simple:
                out.append(simple[escape])
                index += 2
                continue
            if escape == 'u':
                hex_value = body[index + 2:index + 6]
                if not re.match(r'^[0-9a-fA-F]{4}$', hex_value):
                    raise MakoFrontmatterError('yaml_parse_error', 'invalid unicode escape (line %d)' % line)
                out.append(chr(int(hex_value, 16)))
                index += 6
                continue
            raise MakoFrontmatterError('yaml_parse_error', 'invalid escape sequence (line %d)' % line)
        out.append(char)
        index += 1
    if not closed:
        raise MakoFrontmatterError('yaml_parse_error', 'unterminated quoted scalar (line %d)' % line)
    return _normalize_scalar(''.join(out), line)


def _parse_scalar(raw, line, key=None):
    value = raw.rstrip(' ')
    if value.startswith('"'):
        return _parse_quoted_scalar(value, line, '"')
    if value.startswith("'"):
        return _parse_quoted_scalar(value, line, "'")
    if key == 'mako':
        if re.match(r'^1\.0+$', value):
            return '1.0'
        if INTEGER_PATTERN.match(value) or FLOAT_PATTERN.match(value):
            return _normalize_scalar(value, line)
    return _parse_plain_scalar(value, line)


def parse_frontmatter(data):
    """Parse MAKO frontmatter with the AIFeed v0.2 safe YAML subset."""
    errors = []

    def fail(code, message):
        errors.append(_error(code, message))

    if len(data) > FRONTMATTER_MAX_BYTES:
        fail('frontmatter_too_large', 'frontmatter exceeds %d bytes' % FRONTMATTER_MAX_BYTES)
        return {'ok': False, 'errors': errors, 'frontmatter': None, 'body': None}
    if data[:3] == b'\xef\xbb\xbf':
        fail('bom_forbidden', 'BOM is forbidden')
        return {'ok': False, 'errors': errors, 'frontmatter': None, 'body': None}
    try:
        text = _decode_utf8(data)
    except UnicodeDecodeError:
        fail('invalid_utf8', 'MAKO document is not valid UTF-8')
        return {'ok': False, 'errors': errors, 'frontmatter': None, 'body': None}

    match = re.match(r'^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)', text)
    if not match:
        fail('frontmatter_missing', 'frontmatter block delimited by --- was not found')
        return {'ok': False, 'errors': errors, 'frontmatter': None, 'body': None}
    front_text = match.group(1)
    body = text[match.end():]

    root = {}
    stack = [{'kind': 'map', 'indent': 0, 'node': root}]
    counter = {'nodes': 0}

    def count_node(line):
        counter['nodes'] += 1
        if counter['nodes'] > NODE_LIMIT:
            raise MakoFrontmatterError('node_limit_exceeded', 'frontmatter exceeds %d nodes (line %d)' % (NODE_LIMIT, line))

    def assign(node, key, value):
        if key in node:
            raise MakoFrontmatterError('duplicate_key', 'duplicate key: ' + key)
        node[key] = value

    def ensure_context(indent, wants_list, line):
        top = stack[-1]
        if top['kind'] is None:
            if indent <= top['parent_indent']:
                raise MakoFrontmatterError('yaml_indent_invalid', 'nested block must be indented (line %d)' % line)
            top['kind'] = 'list' if wants_list else 'map'
            top['indent'] = indent
            top['node'] = [] if wants_list else {}
            assign(top['parent'], top['key'], top['node'])
            count_node(line)
        return top

    for index, raw_line in enumerate(front_text.split('\n')):
        line_number = index + 1
        raw = raw_line[:-1] if raw_line.endswith('\r') else raw_line
        if raw.strip() == '':
            continue
        leading = raw[:len(raw) - len(raw.lstrip())]
        if '\t' in leading:
            fail('yaml_tab_indent', 'tabs are forbidden for indentation (line %d)' % line_number)
            continue
        indent = len(leading)
        if indent % 2 != 0:
            fail('yaml_indent_invalid', 'indentation must be a multiple of 2 spaces (line %d)' % line_number)
            continue
        content = raw[indent:]
        if content.startswith('#'):
            continue

        while len(stack) > 1 and stack[-1]['kind'] is not None and stack[-1]['indent'] > indent:
            stack.pop()

        try:
            if content.startswith('- '):
                top = ensure_context(indent, True, line_number)
                if top['kind'] != 'list' or top['indent'] != indent:
                    raise MakoFrontmatterError('yaml_indent_invalid', 'misaligned sequence item (line %d)' % line_number)
                item_raw = content[2:].rstrip(' ')
                item_match = re.match(r'^([A-Za-z0-9_-]{1,64}):(?: (.*))?$', item_raw)
                if item_match:
                    item = {}
                    count_node(line_number)
                    top['node'].append(item)
                    item_key = item_match.group(1)
                    item_value = item_match.group(2)
                    if item_value is None:
                        stack.append({'kind': None, 'key': item_key, 'parent': item, 'parent_indent': indent})
                        if len(stack) > DEPTH_LIMIT:
                            raise MakoFrontmatterError('yaml_max_depth', 'maximum nesting depth exceeded (line %d)' % line_number)
                    else:
                        assign(item, item_key, _parse_scalar(item_value, line_number, item_key))
                        count_node(line_number)
                    stack.append({'kind': 'map', 'indent': indent + 2, 'node': item})
                    if len(stack) > DEPTH_LIMIT:
                        raise MakoFrontmatterError('yaml_max_depth', 'maximum nesting depth exceeded (line %d)' % line_number)
                else:
                    top['node'].append(_parse_scalar(item_raw, line_number))
                    count_node(line_number)
                continue

            key_match = re.match(r'^([A-Za-z0-9_-]{1,64}):(?: (.*))?$', content)
            if not key_match:
                raise MakoFrontmatterError('yaml_parse_error', 'line is not a mapping or sequence item (line %d)' % line_number)
            key = key_match.group(1)
            raw_value = key_match.group(2)
            if not KEY_PATTERN.match(key):
                raise MakoFrontmatterError('yaml_key_invalid', 'invalid key: ' + key)
            top = ensure_context(indent, False, line_number)
            if top['kind'] != 'map' or top['indent'] != indent:
                raise MakoFrontmatterError('yaml_indent_invalid', 'misaligned mapping key (line %d)' % line_number)
            if raw_value is None:
                stack.append({'kind': None, 'key': key, 'parent': top['node'], 'parent_indent': indent})
                if len(stack) > DEPTH_LIMIT:
                    raise MakoFrontmatterError('yaml_max_depth', 'maximum nesting depth exceeded (line %d)' % line_number)
                continue
            assign(top['node'], key, _parse_scalar(raw_value, line_number, key))
            count_node(line_number)
        except MakoFrontmatterError as parse_error:
            fail(parse_error.code, str(parse_error))

    for context in stack:
        if context['kind'] is None:
            fail('yaml_null_forbidden', 'key without a value: ' + context['key'])

    return {
        'ok': len(errors) == 0,
        'errors': errors,
        'frontmatter': root if len(errors) == 0 else None,
        'body': body
    }


def validate_mako_fields(frontmatter):
    errors = []
    if not isinstance(frontmatter, dict):
        return [_error('mako_frontmatter_invalid', 'frontmatter must be a mapping')]
    if 'mako' not in frontmatter:
        errors.append(_error('mako_frontmatter_missing', 'missing required field: mako'))
    elif frontmatter['mako'] != '1.0':
        errors.append(_error('mako_unsupported', 'unsupported MAKO protocol version: %s' % (frontmatter['mako'],)))
    for field in ('type', 'entity', 'updated', 'tokens', 'language'):
        if field not in frontmatter:
            errors.append(_error('mako_frontmatter_missing', 'missing required field: ' + field))
    if 'type' in frontmatter and frontmatter['type'] not in MAKO_TYPES:
        errors.append(_error('mako_frontmatter_invalid', 'invalid type: %s' % (frontmatter['type'],)))
    if 'entity' in frontmatter and (not isinstance(frontmatter['entity'], str) or frontmatter['entity'] == ''):
        errors.append(_error('mako_frontmatter_invalid', 'entity must be a non-empty string'))
    if 'updated' in frontmatter and (not isinstance(frontmatter['updated'], str) or not UPDATE_PATTERN.match(frontmatter['updated'])):
        errors.append(_error('mako_frontmatter_invalid', 'updated must be an ISO 8601 date or UTC timestamp'))
    tokens = frontmatter.get('tokens')
    if 'tokens' in frontmatter and (not isinstance(tokens, int) or isinstance(tokens, bool) or tokens < 1 or tokens > 100000):
        errors.append(_error('mako_frontmatter_invalid', 'tokens must be an integer between 1 and 100000'))
    if 'language' in frontmatter and (not isinstance(frontmatter['language'], str) or not LANGUAGE_PATTERN.match(frontmatter['language'])):
        errors.append(_error('mako_frontmatter_invalid', 'language must be a BCP 47 tag'))

    aifeed_block = frontmatter.get('aifeed')
    if aifeed_block is not None:
        errors.extend(validate_aifeed_block(aifeed_block))
    return errors


def validate_aifeed_block(aifeed_block):
    errors = []
    if not isinstance(aifeed_block, dict):
        errors.append(_error('aifeed_invalid', 'aifeed block must be a mapping'))
        return errors
    for key in aifeed_block:
        if key.startswith('x_'):
            continue
        if key not in ('policy_version', 'usage', 'attribution', 'attribution_url', 'attribution_text', 'limits', 'license', 'assets'):
            errors.append(_error('aifeed_unknown_field', 'unknown aifeed field: ' + key))
    if aifeed_block.get('policy_version') not in (None, '0.2'):
        errors.append(_error('aifeed_invalid', 'aifeed.policy_version must be "0.2"'))
    usage = aifeed_block.get('usage')
    if usage is not None:
        if not isinstance(usage, dict):
            errors.append(_error('aifeed_invalid', 'aifeed.usage must be a mapping'))
        else:
            for key, value in usage.items():
                if key.startswith('x_'):
                    continue
                if key not in USAGE_KEYS:
                    errors.append(_error('aifeed_invalid', 'unknown aifeed.usage key: ' + key))
                elif value not in ('allow', 'deny'):
                    errors.append(_error('aifeed_invalid', 'aifeed.usage.%s must be allow or deny' % key))
    if aifeed_block.get('attribution') is not None and aifeed_block['attribution'] not in ATTRIBUTION_ORDER:
        errors.append(_error('aifeed_invalid', 'aifeed.attribution must be required, optional, or none'))
    limits = aifeed_block.get('limits')
    if limits is not None:
        if not isinstance(limits, dict):
            errors.append(_error('aifeed_invalid', 'aifeed.limits must be a mapping'))
        else:
            for key in limits:
                if key.startswith('x_'):
                    continue
                if key not in ('requests_per_minute', 'concurrent', 'crawl_delay_seconds'):
                    errors.append(_error('aifeed_invalid', 'unknown aifeed.limits key: ' + key))
                elif not isinstance(limits[key], int) or isinstance(limits[key], bool) or limits[key] < 0:
                    errors.append(_error('aifeed_invalid', 'aifeed.limits.%s must be a non-negative integer' % key))
    assets = aifeed_block.get('assets')
    if assets is not None:
        if not isinstance(assets, list) or len(assets) > 100:
            errors.append(_error('aifeed_invalid', 'aifeed.assets must be an array of at most 100 items'))
        else:
            for position, asset in enumerate(assets):
                if not isinstance(asset, dict):
                    errors.append(_error('aifeed_invalid', 'aifeed.assets[%d] must be an object' % position))
                    continue
                for key in asset:
                    if key not in ('url', 'type', 'mime', 'title', 'alt'):
                        errors.append(_error('aifeed_invalid', 'unknown aifeed.assets[%d] field: %s' % (position, key)))
                url_value = asset.get('url')
                if not isinstance(url_value, str) or not url_value or len(url_value) > 2048:
                    errors.append(_error('aifeed_invalid', 'aifeed.assets[%d].url must be a non-empty string' % position))
                if asset.get('type') not in ('image', 'video', 'audio', 'document', 'archive', 'file'):
                    errors.append(_error('aifeed_invalid', 'aifeed.assets[%d].type is invalid' % position))
    return errors


def validate_aimd_fields(frontmatter):
    errors = []
    if not isinstance(frontmatter, dict):
        return [_error('aimd_frontmatter_invalid', 'frontmatter must be a mapping')]
    if 'aimd' not in frontmatter:
        errors.append(_error('aimd_frontmatter_missing', 'missing required field: aimd'))
    elif frontmatter['aimd'] != '1.0':
        errors.append(_error('aimd_unsupported', 'unsupported AIMD protocol version: %s' % (frontmatter['aimd'],)))
    if 'mako' in frontmatter and frontmatter['mako'] != '1.0':
        errors.append(_error('mako_unsupported', 'unsupported MAKO protocol version: %s' % (frontmatter['mako'],)))
    for field in ('type', 'entity', 'updated', 'tokens', 'language'):
        if field not in frontmatter:
            errors.append(_error('aimd_frontmatter_missing', 'missing required field: ' + field))
    if 'type' in frontmatter and frontmatter['type'] not in MAKO_TYPES:
        errors.append(_error('aimd_frontmatter_invalid', 'invalid type: %s' % (frontmatter['type'],)))
    if 'entity' in frontmatter and (not isinstance(frontmatter['entity'], str) or frontmatter['entity'] == ''):
        errors.append(_error('aimd_frontmatter_invalid', 'entity must be a non-empty string'))
    if 'updated' in frontmatter and (not isinstance(frontmatter['updated'], str) or not UPDATE_PATTERN.match(frontmatter['updated'])):
        errors.append(_error('aimd_frontmatter_invalid', 'updated must be an ISO 8601 date or UTC timestamp'))
    tokens = frontmatter.get('tokens')
    if 'tokens' in frontmatter and (not isinstance(tokens, int) or isinstance(tokens, bool) or tokens < 1 or tokens > 1000000):
        errors.append(_error('aimd_frontmatter_invalid', 'tokens must be an integer between 1 and 1000000'))
    if 'language' in frontmatter and (not isinstance(frontmatter['language'], str) or not LANGUAGE_PATTERN.match(frontmatter['language'])):
        errors.append(_error('aimd_frontmatter_invalid', 'language must be a BCP 47 tag'))
    if 'summary' in frontmatter and (not isinstance(frontmatter['summary'], str) or len(frontmatter['summary']) > 300):
        errors.append(_error('aimd_frontmatter_invalid', 'summary must be a string of at most 300 characters'))
    alternates = frontmatter.get('alternates')
    if alternates is not None:
        if not isinstance(alternates, list) or len(alternates) > 20:
            errors.append(_error('aimd_frontmatter_invalid', 'alternates must be an array of at most 20 items'))
        else:
            for item in alternates:
                if not isinstance(item, dict):
                    errors.append(_error('aimd_frontmatter_invalid', 'alternates items must be objects'))
                    continue
                for key in item:
                    if key not in ('url', 'lang'):
                        errors.append(_error('aimd_frontmatter_invalid', 'alternates items may only contain url and lang'))
                url_value = item.get('url')
                if not isinstance(url_value, str) or not url_value or len(url_value) > 2048:
                    errors.append(_error('aimd_frontmatter_invalid', 'alternates.url must be a non-empty string (<=2048)'))
                lang_value = item.get('lang')
                if not isinstance(lang_value, str) or not LANGUAGE_PATTERN.match(lang_value):
                    errors.append(_error('aimd_frontmatter_invalid', 'alternates.lang must be a BCP 47 tag'))
    canonical = frontmatter.get('canonical')
    if canonical is not None and (not isinstance(canonical, str) or not canonical or len(canonical) > 2048):
        errors.append(_error('aimd_frontmatter_invalid', 'canonical must be a non-empty string (<=2048)'))
    tags = frontmatter.get('tags')
    if tags is not None:
        if not isinstance(tags, list) or len(tags) > 50:
            errors.append(_error('aimd_frontmatter_invalid', 'tags must be an array of at most 50 items'))
        elif any(not isinstance(tag, str) or not 1 <= len(tag) <= 64 for tag in tags):
            errors.append(_error('aimd_frontmatter_invalid', 'tags items must be strings of 1-64 characters'))
    related = frontmatter.get('related')
    if related is not None:
        if not isinstance(related, list) or len(related) > 100:
            errors.append(_error('aimd_frontmatter_invalid', 'related must be an array of at most 100 items'))
        elif any(not isinstance(item, str) or not 1 <= len(item) <= 2048 for item in related):
            errors.append(_error('aimd_frontmatter_invalid', 'related items must be strings of 1-2048 characters'))
    audience = frontmatter.get('audience')
    if audience is not None and (not isinstance(audience, str) or len(audience) > 128):
        errors.append(_error('aimd_frontmatter_invalid', 'audience must be a string of at most 128 characters'))
    freshness = frontmatter.get('freshness')
    if freshness is not None and freshness not in ('realtime', 'hourly', 'daily', 'weekly', 'monthly', 'static'):
        errors.append(_error('aimd_frontmatter_invalid', 'freshness must be realtime, hourly, daily, weekly, monthly, or static'))
    media = frontmatter.get('media')
    if media is not None:
        if not isinstance(media, dict):
            errors.append(_error('aimd_frontmatter_invalid', 'media must be a mapping'))
        else:
            cover = media.get('cover')
            if cover is not None:
                if (not isinstance(cover, dict)
                        or not isinstance(cover.get('url'), str) or not 1 <= len(cover.get('url', '')) <= 2048
                        or not isinstance(cover.get('alt'), str) or not 1 <= len(cover.get('alt', '')) <= 500):
                    errors.append(_error('aimd_frontmatter_invalid', 'media.cover must be {url, alt} strings'))
            for key in ('images', 'video', 'audio', 'interactive', 'downloads'):
                if key in media and (not isinstance(media[key], int) or isinstance(media[key], bool) or media[key] < 0):
                    errors.append(_error('aimd_frontmatter_invalid', 'media.%s must be a non-negative integer' % key))
    actions = frontmatter.get('actions')
    if actions is not None:
        if not isinstance(actions, list) or len(actions) > 100:
            errors.append(_error('aimd_frontmatter_invalid', 'actions must be an array of at most 100 items'))
        else:
            seen_names = set()
            for action in actions:
                valid = (isinstance(action, dict)
                         and isinstance(action.get('name'), str) and re.match(r'^[a-z][a-z0-9_]{0,63}$', action.get('name', ''))
                         and isinstance(action.get('description'), str) and 1 <= len(action.get('description', '')) <= 500)
                if not valid:
                    errors.append(_error('aimd_frontmatter_invalid', 'actions items must have a snake_case name and a description'))
                    continue
                if action['name'] in seen_names:
                    errors.append(_error('aimd_frontmatter_invalid', 'duplicate action name: ' + action['name']))
                seen_names.add(action['name'])
                if 'method' in action and action['method'] not in ('GET', 'POST', 'PUT', 'PATCH', 'DELETE'):
                    errors.append(_error('aimd_frontmatter_invalid', 'action method must be an HTTP method'))
                if 'endpoint' in action and (not isinstance(action['endpoint'], str) or not action['endpoint'].startswith('/')):
                    errors.append(_error('aimd_frontmatter_invalid', 'action endpoint must be a path'))
    links = frontmatter.get('links')
    if links is not None:
        if not isinstance(links, dict):
            errors.append(_error('aimd_frontmatter_invalid', 'links must be a mapping'))
        else:
            for side in ('internal', 'external'):
                side_links = links.get(side)
                if side_links is None:
                    continue
                if not isinstance(side_links, list) or len(side_links) > 100:
                    errors.append(_error('aimd_frontmatter_invalid', 'links.%s must be an array of at most 100 items' % side))
                    continue
                for link in side_links:
                    if (not isinstance(link, dict)
                            or not isinstance(link.get('url'), str) or not 1 <= len(link.get('url', '')) <= 2048
                            or not isinstance(link.get('context'), str) or not 1 <= len(link.get('context', '')) <= 500):
                        errors.append(_error('aimd_frontmatter_invalid', 'links.%s items must be {url, context} strings' % side))
    if 'aifeed' in frontmatter and frontmatter['aifeed'] is not None:
        errors.extend(validate_aifeed_block(frontmatter['aifeed']))
    return errors


def document_profile(frontmatter):
    if not isinstance(frontmatter, dict):
        return None
    if frontmatter.get('aimd') == '1.0':
        return 'aimd'
    if frontmatter.get('mako') == '1.0':
        return 'mako'
    return None


def resolve_permissions(manifest_permissions, aifeed_block, overrides='restrict-only'):
    permissions = manifest_permissions or {}
    base_usage = permissions.get('usage') or {}
    page_usage = (aifeed_block or {}).get('usage') or {}
    usage = {}
    warnings = []
    for key in USAGE_KEYS:
        base = base_usage.get(key, permissions.get('default'))
        page = page_usage.get(key)
        if page is None or page == base:
            usage[key] = base
            continue
        if overrides == 'bidirectional':
            usage[key] = page
            continue
        if base == 'deny' and page == 'allow':
            warnings.append(_error('permission_override_rejected', 'page may not grant "%s" (manifest denies it)' % key,
                                  key=key, attempted=page, effective=base))
            usage[key] = base
            continue
        usage[key] = page

    attribution = permissions.get('attribution')
    page_attribution = (aifeed_block or {}).get('attribution')
    if page_attribution is not None and page_attribution != attribution:
        base_rank = ATTRIBUTION_ORDER.get(attribution, -1)
        page_rank = ATTRIBUTION_ORDER.get(page_attribution, -1)
        if overrides == 'bidirectional' or page_rank > base_rank:
            attribution = page_attribution
        else:
            warnings.append(_error('permission_override_rejected', 'page may not loosen attribution',
                                  key='attribution', attempted=page_attribution, effective=attribution))

    base_limits = permissions.get('limits') or {}
    page_limits = (aifeed_block or {}).get('limits') or {}
    limits = dict(base_limits)
    for key in ('requests_per_minute', 'concurrent'):
        page = page_limits.get(key)
        if page is None:
            continue
        base = limits.get(key)
        if overrides == 'bidirectional' or base is None or page <= base:
            limits[key] = page
        else:
            warnings.append(_error('permission_override_rejected', 'page may not loosen limit "%s"' % key,
                                  key=key, attempted=page, effective=base))
    if 'crawl_delay_seconds' in page_limits:
        page = page_limits['crawl_delay_seconds']
        base = limits.get('crawl_delay_seconds')
        if overrides == 'bidirectional' or base is None or page >= base:
            limits['crawl_delay_seconds'] = page
        else:
            warnings.append(_error('permission_override_rejected', 'page may not loosen limit "crawl_delay_seconds"',
                                  key='crawl_delay_seconds', attempted=page, effective=base))

    base_license = permissions.get('license')
    page_license = (aifeed_block or {}).get('license')
    if page_license is None:
        license_value = base_license
    elif base_license is None:
        license_value = page_license
    elif overrides == 'bidirectional':
        license_value = page_license
    else:
        try:
            same = av.jcs(page_license) == av.jcs(base_license)
        except Exception:
            same = False
        if same:
            license_value = base_license
        else:
            warnings.append(_error('permission_override_rejected', 'page may not replace license (manifest license applies)',
                                   key='license', attempted=page_license, effective=base_license))
            license_value = base_license
    return {'usage': usage, 'attribution': attribution, 'limits': limits, 'license': license_value, 'warnings': warnings}


def signed_message(page_url, body_bytes, context='mako'):
    separation = SEPARATIONS.get(context, MAKO_SEPARATION)
    if not is_mako_url(page_url):
        raise MakoFrontmatterError('mako_url_invalid', 'page URL must be an absolute https URL with ASCII characters (loopback http allowed for tests)')
    return separation + page_url.encode('utf-8') + b'\n' + body_bytes


def verify_mako_container(container_text, page_url, body_bytes, public_key_value, context='mako'):
    try:
        container = av.parse_strict(container_text)
    except av.AifeedError as parse_error:
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'signature container is not valid strict JSON: %s' % parse_error)]}
    if not isinstance(container, dict):
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'signature container must be an object')]}
    if container.get('algorithm') != 'ed25519':
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'algorithm must be "ed25519"')]}
    if container.get('context') != context:
        return {'ok': False, 'errors': [_error('mako_context_invalid', 'context must be "%s"' % context)]}
    url = container.get('url')
    if not is_mako_url(url):
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'url must be an absolute ASCII https URL (loopback http allowed for tests)')]}
    if url != page_url:
        return {'ok': False, 'errors': [_error('mako_url_mismatch', 'signed URL does not match the requested page URL',
                                               signed=url, requested=page_url)]}
    try:
        public_key = av.decode_public_key(public_key_value)
    except av.AifeedError as key_error:
        return {'ok': False, 'errors': [_error('mako_manifest_key_invalid', 'invalid public key: %s' % key_error)]}
    if container.get('key_fingerprint') != av.fingerprint_of(public_key_value):
        return {'ok': False, 'errors': [_error('mako_key_mismatch', 'signature key does not match the manifest key')]}
    raw_digest = container.get('raw_digest')
    if not isinstance(raw_digest, dict):
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'raw_digest is required')]}
    expected = raw_digest.get('sha-256')
    if not isinstance(expected, str) or not SHA256_B64_PATTERN.match(expected):
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'raw_digest.sha-256 is malformed')]}
    actual = av.sha256_b64(body_bytes)
    if actual != expected:
        return {'ok': False, 'errors': [_error('mako_digest_mismatch', 'MAKO bytes do not match raw_digest.sha-256')]}
    signature_value = container.get('signature')
    try:
        signature_bytes = av.decode_signature(signature_value)
    except av.AifeedError:
        return {'ok': False, 'errors': [_error('mako_container_malformed', 'signature is malformed')]}
    message = signed_message(page_url, body_bytes, context)
    if not av.ed25519_verify(public_key, signature_bytes, message):
        return {'ok': False, 'errors': [_error('mako_bad_signature', 'MAKO signature verification failed')]}
    return {'ok': True, 'errors': [], 'container': container}


def verify_mako_document(page_url, mako_bytes, container_text=None, manifest_fragment=None, last_modified=None, profile='mako'):
    fragment = manifest_fragment or {}
    content_mako = fragment.get('content_mako') or {}
    overrides = content_mako.get('overrides', 'restrict-only')
    signature_policy = content_mako.get('signature', 'optional')
    context = 'aimd' if profile == 'aimd' else 'mako'
    format_label = 'AIMD' if profile == 'aimd' else 'MAKO'

    errors = []
    warnings = []

    parsed = parse_frontmatter(mako_bytes)
    errors.extend(parsed['errors'])
    if parsed['frontmatter'] is not None:
        if profile == 'aimd':
            errors.extend(validate_aimd_fields(parsed['frontmatter']))
        else:
            errors.extend(validate_mako_fields(parsed['frontmatter']))
        updated = parsed['frontmatter'].get('updated')
        if updated and last_modified:
            try:
                updated_dt = datetime.fromisoformat(updated.replace('Z', '+00:00'))
                if updated_dt.tzinfo is None:
                    updated_dt = updated_dt.replace(tzinfo=timezone.utc)
                modified_dt = datetime.fromisoformat(last_modified.replace('Z', '+00:00'))
                if modified_dt.tzinfo is None:
                    modified_dt = modified_dt.replace(tzinfo=timezone.utc)
                if (modified_dt - updated_dt).total_seconds() > 86400:
                    warnings.append(_error('mako_stale', format_label + ' document is older than the page Last-Modified timestamp'))
            except ValueError:
                pass

    verified = False
    signature_present = container_text is not None
    if signature_present:
        result = verify_mako_container(container_text, page_url, mako_bytes, fragment.get('public_key', ''), context)
        if result['ok']:
            verified = True
        else:
            errors.extend(result['errors'])
    elif signature_policy == 'required':
        errors.append(_error('mako_signature_missing', 'manifest requires ' + format_label + ' signatures but none was provided'))

    resolved = resolve_permissions(fragment.get('permissions'), (parsed['frontmatter'] or {}).get('aifeed'), overrides)
    warnings.extend(resolved['warnings'])

    return {
        'verified': verified,
        'mako_verified': verified,
        'aimd_verified': verified,
        'mako_signature_present': signature_present,
        'profile': profile,
        'errors': errors,
        'warnings': warnings,
        'frontmatter': parsed['frontmatter'],
        'body': parsed['body'],
        'usage': resolved['usage'],
        'attribution': resolved['attribution'],
        'limits': resolved['limits'],
        'license': resolved['license']
    }


def verify_aimd_document(page_url, mako_bytes, container_text=None, manifest_fragment=None, last_modified=None):
    return verify_mako_document(page_url, mako_bytes, container_text, manifest_fragment, last_modified, profile='aimd')


def verify_mako_index(index_text, index_url, public_key_value, signature_text=None, require_signature=False, profile='mako'):
    errors = []
    body_bytes = index_text.encode('utf-8')
    try:
        index = av.parse_strict(index_text)
    except av.AifeedError as parse_error:
        return {'ok': False, 'verified': False, 'errors': [_error('mako_index_malformed', 'index is not valid strict JSON: %s' % parse_error)], 'entries': None}
    if not isinstance(index, dict):
        return {'ok': False, 'verified': False, 'errors': [_error('mako_index_malformed', 'index must be an object')], 'entries': None}

    if index.get('version') != '0.2':
        errors.append(_error('mako_index_invalid', '$.version: must equal "0.2"'))
    if not isinstance(index.get('domain'), str) or not DOMAIN_PATTERN.match(index.get('domain', '')):
        errors.append(_error('mako_index_invalid', '$.domain: invalid domain'))
    site = index.get('site')
    if site is not None:
        if not isinstance(site, dict):
            errors.append(_error('mako_index_invalid', '$.site: must be an object'))
        else:
            for key in site:
                if key.startswith('x_'):
                    continue
                if key not in ('name', 'description', 'type', 'languages', 'license', 'updated_at'):
                    errors.append(_error('mako_index_invalid', '$.site: unknown property: ' + key))
            if 'name' in site and (not isinstance(site['name'], str) or not 1 <= len(site['name']) <= 256):
                errors.append(_error('mako_index_invalid', '$.site.name: must be 1-256 characters'))
            if 'description' in site and (not isinstance(site['description'], str) or not 1 <= len(site['description']) <= 500):
                errors.append(_error('mako_index_invalid', '$.site.description: must be 1-500 characters'))
            if 'type' in site and site['type'] not in SITE_TYPES:
                errors.append(_error('mako_index_invalid', '$.site.type: invalid site type'))
            languages = site.get('languages')
            if languages is not None:
                if not isinstance(languages, list) or not 1 <= len(languages) <= 20:
                    errors.append(_error('mako_index_invalid', '$.site.languages: must be an array of 1-20 items'))
                else:
                    for language in languages:
                        if not isinstance(language, str) or not LANGUAGE_PATTERN.match(language):
                            errors.append(_error('mako_index_invalid', '$.site.languages: invalid BCP 47 tag'))
            if 'license' in site and (not isinstance(site['license'], str) or len(site['license']) > 256):
                errors.append(_error('mako_index_invalid', '$.site.license: must be a string of at most 256 characters'))
            if 'updated_at' in site and (not isinstance(site['updated_at'], str) or not re.match(r'^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$', site['updated_at'])):
                errors.append(_error('mako_index_invalid', '$.site.updated_at: must be an RFC 3339 UTC timestamp'))
    entries = index.get('entries')
    if not isinstance(entries, list) or not entries:
        errors.append(_error('mako_index_invalid', '$.entries: must be a non-empty array'))
    else:
        for position, entry in enumerate(entries):
            if not isinstance(entry, dict):
                errors.append(_error('mako_index_invalid', '$.entries[%d]: must be an object' % position))
                continue
            if not isinstance(entry.get('url'), str) or not entry['url'].startswith('/'):
                errors.append(_error('mako_index_invalid', '$.entries[%d].url: must be a path' % position))
            if entry.get('type') not in MAKO_TYPES:
                errors.append(_error('mako_index_invalid', '$.entries[%d].type: invalid type' % position))
            if not isinstance(entry.get('tokens'), int) or isinstance(entry.get('tokens'), bool):
                errors.append(_error('mako_index_invalid', '$.entries[%d].tokens: must be an integer' % position))
            digest_value = entry.get('sha-256')
            if not isinstance(digest_value, str) or not SHA256_B64_PATTERN.match(digest_value):
                errors.append(_error('mako_index_invalid', '$.entries[%d].sha-256: malformed digest' % position))
            allowed_entry = ('url', 'type', 'tokens', 'title', 'summary', 'tags', 'lang', 'related', 'updated', 'etag', 'sha-256')
            for key in entry:
                if key not in allowed_entry:
                    errors.append(_error('mako_index_invalid', '$.entries[%d]: unknown property: %s' % (position, key)))
            if 'title' in entry and (not isinstance(entry['title'], str) or not 1 <= len(entry['title']) <= 500):
                errors.append(_error('mako_index_invalid', '$.entries[%d].title: must be 1-500 characters' % position))
            if 'summary' in entry and (not isinstance(entry['summary'], str) or not 1 <= len(entry['summary']) <= 160):
                errors.append(_error('mako_index_invalid', '$.entries[%d].summary: must be 1-160 characters' % position))
            tags = entry.get('tags')
            if tags is not None:
                if not isinstance(tags, list) or len(tags) > 10:
                    errors.append(_error('mako_index_invalid', '$.entries[%d].tags: at most 10 items' % position))
                else:
                    for tag in tags:
                        if not isinstance(tag, str) or not 1 <= len(tag) <= 64:
                            errors.append(_error('mako_index_invalid', '$.entries[%d].tags: items must be 1-64 characters' % position))
            if 'lang' in entry and (not isinstance(entry['lang'], str) or not LANGUAGE_PATTERN.match(entry['lang'])):
                errors.append(_error('mako_index_invalid', '$.entries[%d].lang: invalid BCP 47 tag' % position))
            related = entry.get('related')
            if related is not None:
                if not isinstance(related, list) or len(related) > 20:
                    errors.append(_error('mako_index_invalid', '$.entries[%d].related: at most 20 items' % position))
                else:
                    for related_url in related:
                        if not isinstance(related_url, str) or not 1 <= len(related_url) <= 2048:
                            errors.append(_error('mako_index_invalid', '$.entries[%d].related: items must be strings' % position))
    if errors:
        return {'ok': False, 'verified': False, 'errors': errors, 'entries': entries}

    host = urlparse(index_url).hostname
    if index.get('domain') != host:
        errors.append(_error('mako_index_domain_mismatch', 'index domain does not match the serving host',
                             declared=index.get('domain'), serving=host))
        return {'ok': False, 'verified': False, 'errors': errors, 'entries': entries}

    verified = False
    if signature_text is not None:
        result = verify_mako_container(signature_text, index_url, body_bytes, public_key_value, 'aimd-index' if profile == 'aimd' else 'mako-index')
        if result['ok']:
            verified = True
        else:
            errors.extend(result['errors'])
    elif require_signature:
        errors.append(_error('mako_signature_missing', 'manifest requires MAKO signatures but the index is unsigned'))

    return {'ok': len(errors) == 0, 'verified': verified, 'errors': errors, 'entries': entries, 'profile': profile}


def verify_aimd_index(index_text, index_url, public_key_value, signature_text=None, require_signature=False):
    return verify_mako_index(index_text, index_url, public_key_value, signature_text, require_signature, profile='aimd')


def check_index_entry_digest(entry, body_bytes):
    actual = av.sha256_b64(body_bytes)
    if entry.get('sha-256') != actual:
        return {'ok': False, 'error': _error('mako_index_digest_mismatch', 'index entry digest does not match MAKO bytes',
                                             url=entry.get('url'))}
    return {'ok': True}


def main():
    import argparse
    import json
    from pathlib import Path

    parser = argparse.ArgumentParser(prog='aifeed-mako', description='AIFeed v0.2 AIMD/MAKO verifier')
    parser.add_argument('file', help='content file (.aifeed.md or .mako.md)')
    parser.add_argument('--url', required=True, help='page URL')
    parser.add_argument('--signature', help='signature sidecar (default: <file>.sig)')
    parser.add_argument('--public-key', required=True, help='public key value or key file')
    parser.add_argument('--profile', choices=['mako', 'aimd'], help='content profile (auto-detected by default)')
    parser.add_argument('--json', action='store_true')
    args = parser.parse_args()

    data = Path(args.file).read_bytes()
    signature_path = Path(args.signature) if args.signature else Path(args.file + '.sig')
    signature_text = signature_path.read_text(encoding='utf-8') if signature_path.exists() else None
    public_key_value = args.public_key
    key_path = Path(args.public_key)
    if key_path.exists():
        public_key_value = av.read_key_file(key_path)[0]

    if args.profile:
        profile = args.profile
    else:
        parsed = parse_frontmatter(data)
        profile = document_profile(parsed['frontmatter'] if parsed['frontmatter'] else None) or 'mako'

    result = verify_mako_document(args.url, data, signature_text, {
        'public_key': public_key_value,
        'content_mako': {'signature': 'optional'}
    }, profile=profile)
    if args.json:
        print(json.dumps(result, indent=2, ensure_ascii=False))
    else:
        state = 'VERIFIED' if result['verified'] and not result['errors'] else 'UNVERIFIED'
        print('Result     : %s' % state)
        print('Profile    : %s' % result['profile'])
        print('File       : %s' % args.file)
        print('Errors     : %s' % (', '.join(item['code'] for item in result['errors']) or 'none'))
    return 0 if result['verified'] and not result['errors'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
