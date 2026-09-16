// Browser verifier for AIFeed demo origins. Client-side only: strict parse, JCS
// re-canonicalization, Ed25519 via WebCrypto, and the DNS anchor via DNS-over-HTTPS.
// Canonical implementations live in lib/ — this is a compact demo port, not the SDK.

(function () {
  'use strict';

  var MANIFEST_SEPARATION = { '0.1': 'aifeed.v0.1\n', '0.2': 'aifeed.v0.2\n' };
  var AIMD_SEPARATION = 'aifeed.aimd.v1\n';
  var MAX_INT = 9007199254740991;

  // --- JCS (RFC 8785 subset; port of lib/jcs.js) ---
  var SIMPLE_ESCAPES = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
  function escapeString(value) {
    var out = '"';
    for (var i = 0; i < value.length; i++) {
      var ch = value[i];
      if (SIMPLE_ESCAPES[ch]) { out += SIMPLE_ESCAPES[ch]; continue; }
      var code = value.charCodeAt(i);
      if (code < 0x20) { out += '\\u' + code.toString(16).padStart(4, '0'); continue; }
      if (code >= 0xd800 && code <= 0xdbff) {
        var next = value.charCodeAt(i + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) throw new Error('lone high surrogate');
        out += ch + value[i + 1]; i++; continue;
      }
      if (code >= 0xdc00 && code <= 0xdfff) throw new Error('lone low surrogate');
      out += ch;
    }
    return out + '"';
  }
  function serialize(value) {
    if (value === null) return 'null';
    var type = typeof value;
    if (type === 'boolean') return value ? 'true' : 'false';
    if (type === 'number') return String(value);
    if (type === 'string') return escapeString(value);
    if (Array.isArray(value)) return '[' + value.map(serialize).join(',') + ']';
    if (type === 'object') {
      return '{' + Object.keys(value).sort().map(function (key) { return escapeString(key) + ':' + serialize(value[key]); }).join(',') + '}';
    }
    throw new Error('unsupported value type: ' + type);
  }

  // --- strict parse (subset of lib/parse.js): duplicate keys, floats, bounds, NFC, depth ---
  function parseStrict(text, options) {
    var maxDepth = (options && options.maxDepth) || 10;
    var index = 0;
    function fail(code) { throw Object.assign(new Error(code + ' at ' + index), { code: code }); }
    function ws() { while (index < text.length && /[ \t\n\r]/.test(text[index])) index++; }
    function parseValue(depth) {
      if (depth > maxDepth) fail('depth_exceeded');
      ws();
      var ch = text[index];
      if (ch === '{') return parseObject(depth);
      if (ch === '[') return parseArray(depth);
      if (ch === '"') return parseString();
      if (text.startsWith('true', index)) { index += 4; return true; }
      if (text.startsWith('false', index)) { index += 5; return false; }
      if (text.startsWith('null', index)) { index += 4; return null; }
      return parseNumber();
    }
    function parseObject(depth) {
      index++;
      var result = {};
      var seen = Object.create(null);
      ws();
      if (text[index] === '}') { index++; return result; }
      for (;;) {
        ws();
        if (text[index] !== '"') fail('expected_key');
        var key = parseString();
        if (seen[key]) fail('duplicate_key');
        seen[key] = true;
        ws();
        if (text[index] !== ':') fail('expected_colon');
        index++;
        result[key] = parseValue(depth + 1);
        ws();
        if (text[index] === ',') { index++; continue; }
        if (text[index] === '}') { index++; return result; }
        fail('expected_comma_or_end');
      }
    }
    function parseArray(depth) {
      index++;
      var result = [];
      ws();
      if (text[index] === ']') { index++; return result; }
      for (;;) {
        result.push(parseValue(depth + 1));
        ws();
        if (text[index] === ',') { index++; continue; }
        if (text[index] === ']') { index++; return result; }
        fail('expected_comma_or_end');
      }
    }
    function parseString() {
      var start = index;
      index++;
      var out = '';
      for (;;) {
        if (index >= text.length) fail('unterminated_string');
        var ch = text[index];
        if (ch === '"') { index++; break; }
        if (ch === '\\') {
          var escape = text[index + 1];
          var map = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
          if (map[escape] !== undefined) { out += map[escape]; index += 2; continue; }
          if (escape === 'u') {
            var hex = text.slice(index + 2, index + 6);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail('bad_unicode_escape');
            out += String.fromCharCode(parseInt(hex, 16));
            index += 6;
            continue;
          }
          fail('bad_escape');
        }
        if (ch.charCodeAt(0) < 0x20) fail('control_character');
        out += ch;
        index++;
      }
      if (out.normalize('NFC') !== out) fail('string_not_nfc');
      if (out !== out.normalize('NFC')) fail('string_not_nfc');
      return out;
    }
    function parseNumber() {
      var match = /^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?/.exec(text.slice(index));
      if (!match) fail('bad_number');
      if (match[2] || match[3]) fail('float_rejected');
      var value = Number(match[1]);
      if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_INT) fail('integer_out_of_range');
      index += match[0].length;
      return value;
    }
    var value = parseValue(0);
    ws();
    if (index !== text.length) fail('trailing_data');
    return value;
  }

  // --- bytes ---
  function base64ToBytes(value) {
    var binary = atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  function base64UrlToBytes(value) {
    return base64ToBytes(value.replace(/-/g, '+').replace(/_/g, '/'));
  }
  function bytesToBase64Url(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function utf8(value) { return new TextEncoder().encode(value); }

  async function verifyEd25519(publicKeyValue, messageBytes, signatureBytes) {
    if (!publicKeyValue.startsWith('ed25519:')) throw new Error('unsupported key format');
    var der = base64ToBytes(publicKeyValue.slice('ed25519:'.length));
    var key = await crypto.subtle.importKey('spki', der, { name: 'Ed25519' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'Ed25519' }, key, signatureBytes, messageBytes);
  }

  function decodeContainerSignature(value) {
    if (typeof value !== 'string' || !value.startsWith('base64url:')) throw new Error('signature must be base64url:');
    return base64UrlToBytes(value.slice('base64url:'.length));
  }

  async function dnsAnchor(host) {
    var response = await fetch('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent('_aifeed.' + host) + '&type=TXT', {
      headers: { accept: 'application/dns-json' }
    });
    if (!response.ok) throw new Error('DoH HTTP ' + response.status);
    var data = await response.json();
    var records = (data.Answer || []).map(function (answer) {
      return String(answer.data || '').replace(/^"|"$/g, '').replace(/"\s+"|" "/g, '');
    });
    for (var i = 0; i < records.length; i++) {
      var fields = {};
      records[i].split(';').forEach(function (part) {
        var eq = part.indexOf('=');
        if (eq > 0) fields[part.slice(0, eq).trim()] = part.slice(eq + 1).trim();
      });
      if (fields.v === 'aifeed1') return { record: records[i], fields: fields };
    }
    return null;
  }

  // --- UI ---
  var stepsRoot = document.getElementById('verify-steps');
  var reportRoot = document.getElementById('verify-report');
  var progress = document.getElementById('verify-progress');
  var steps = [];

  function resetSteps(labels) {
    steps = labels.map(function (label) { return { label: label, state: 'pending', note: '' }; });
    renderSteps();
  }
  function renderSteps() {
    if (!stepsRoot) return;
    stepsRoot.innerHTML = steps.map(function (step) {
      return '<li class="' + step.state + '">' + step.label + '<span class="state">' +
        (step.state === 'ok' ? 'PASS' : step.state === 'fail' ? 'FAIL' : step.state === 'warn' ? 'WARN' : '…') +
        '</span>' + (step.note ? '<div class="meta">' + step.note + '</div>' : '') + '</li>';
    }).join('');
  }
  function setStep(index, state, note) {
    steps[index].state = state;
    if (note) steps[index].note = note;
    renderSteps();
    if (progress) progress.value = (index + 1) / steps.length;
  }
  function escapeHtml(value) {
    return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  async function verify(origin) {
    var url = new URL(origin);
    var host = url.hostname;
    resetSteps(['Discovery', 'Strict parse', 'Domain binding', 'Ed25519 signature', 'DNS anchor', 'Permissions', 'Signed content', 'Delta index']);
    reportRoot.innerHTML = '';
    try {
      var manifestResponse = await fetch('https://' + host + '/.well-known/ai.json', { cache: 'no-store' });
      var signatureResponse = await fetch('https://' + host + '/.well-known/ai-signature.json', { cache: 'no-store' });
      if (!manifestResponse.ok || !signatureResponse.ok) throw new Error('manifest HTTP ' + manifestResponse.status);
      var manifestText = await manifestResponse.text();
      var signatureText = await signatureResponse.text();
      setStep(0, 'ok', host + '/.well-known/ai.json');

      var manifest = parseStrict(manifestText);
      var container = parseStrict(signatureText);
      setStep(1, 'ok', 'duplicate keys, floats, and bounds rejected before crypto');

      if (manifest.identity.domain.toLowerCase() !== host.toLowerCase()) {
        setStep(2, 'fail', 'manifest domain ' + manifest.identity.domain + ' ≠ ' + host);
        throw new Error('domain mismatch');
      }
      setStep(2, 'ok', manifest.identity.domain);

      var family = String(manifest.version).slice(0, 3);
      var separation = MANIFEST_SEPARATION[family];
      if (!separation) throw new Error('unsupported manifest version ' + manifest.version);
      var message = utf8(separation + serialize(manifest));
      var valid = false;
      try {
        valid = await verifyEd25519(manifest.identity.public_key, message, decodeContainerSignature(container.signature));
      } catch (cryptoError) {
        setStep(3, 'warn', 'WebCrypto Ed25519 unavailable: ' + cryptoError.message);
        throw cryptoError;
      }
      if (!valid) { setStep(3, 'fail', 'signature does not match'); throw new Error('bad signature'); }
      setStep(3, 'ok', 'Ed25519 over JCS bytes (' + family + ' separation)');

      var anchor = await dnsAnchor(host);
      if (!anchor) {
        setStep(4, 'warn', 'no _aifeed TXT record found');
      } else if (anchor.fields.pk && anchor.fields.pk !== manifest.identity.public_key) {
        setStep(4, 'fail', 'anchor key does not match the manifest');
      } else {
        setStep(4, 'ok', 'v=aifeed1 · fp=' + (anchor.fields.fp || 'n/a'));
      }

      var usage = (manifest.permissions && manifest.permissions.usage) || {};
      setStep(5, 'ok', 'attribution ' + ((manifest.permissions && manifest.permissions.attribution) || 'n/a'));

      var contentOk = false;
      var contentNote = 'not served';
      try {
        var contentResponse = await fetch('https://' + host + '/', { headers: { accept: 'text/aifeed+markdown' }, cache: 'no-store' });
        if (contentResponse.ok && String(contentResponse.headers.get('content-type')).includes('text/aifeed+markdown')) {
          var bodyBytes = new Uint8Array(await contentResponse.arrayBuffer());
          var inline = contentResponse.headers.get('x-aifeed-signature');
          if (inline && inline.startsWith('aimd1:')) {
            var pageContainer = parseStrict(new TextDecoder().decode(base64UrlToBytes(inline.slice('aimd1:'.length))));
            var pageUrl = 'https://' + host + '/';
            var pageMessage = concatBytes(utf8(AIMD_SEPARATION), utf8(pageUrl + '\n'), bodyBytes);
            contentOk = await verifyEd25519(manifest.identity.public_key, pageMessage, decodeContainerSignature(pageContainer.signature));
            contentNote = bodyBytes.length + ' bytes · ' + (contentOk ? 'signature verified' : 'signature mismatch');
          } else {
            contentNote = bodyBytes.length + ' bytes · no inline signature';
          }
        }
      } catch (contentError) {
        contentNote = contentError.message;
      }
      setStep(6, contentOk ? 'ok' : 'warn', contentNote);

      var indexNote = 'not served';
      var indexState = 'warn';
      try {
        var indexResponse = await fetch('https://' + host + '/.well-known/aifeed-index.json', { cache: 'no-store' });
        if (indexResponse.ok) {
          var index = parseStrict(await indexResponse.text());
          var entries = Array.isArray(index.entries) ? index.entries : [];
          indexState = 'ok';
          indexNote = entries.length + ' entries · ' + entries.slice(0, 3).map(function (entry) { return entry.title || entry.url; }).join(' · ');
        }
      } catch (indexError) {
        indexNote = indexError.message;
      }
      setStep(7, indexState, indexNote);

      reportRoot.innerHTML = [
        '<div class="report">',
        '<table>',
        '<tr><th>Origin</th><td>https://' + escapeHtml(host) + '</td></tr>',
        '<tr><th>Result</th><td>' + (contentOk ? 'VERIFIED' : 'VERIFIED (content not served)') + '</td></tr>',
        '<tr><th>Manifest version</th><td>' + escapeHtml(manifest.version) + '</td></tr>',
        '<tr><th>Public key</th><td><code>' + escapeHtml(manifest.identity.public_key.slice(0, 32)) + '…</code></td></tr>',
        '<tr><th>Revocation</th><td>' + escapeHtml((manifest.revocation && manifest.revocation.list_url) || 'n/a') + '</td></tr>',
        '</table>',
        '<h3>Permissions</h3>',
        '<table><thead><tr><th>Use</th><th>Decision</th></tr></thead><tbody>' +
          Object.keys(usage).map(function (key) {
            var allow = usage[key] === 'allow';
            return '<tr><td>' + escapeHtml(key) + '</td><td><span class="tag ' + (allow ? 'ok' : 'no') + '">' + escapeHtml(usage[key]) + '</span></td></tr>';
          }).join('') +
        '</tbody></table>',
        '</div>'
      ].join('');
    } catch (error) {
      reportRoot.innerHTML = '<div class="report"><p class="tag no">FAILED</p><p>' + escapeHtml(error.message) + '</p></div>';
    }
  }

  function concatBytes() {
    var total = 0;
    for (var i = 0; i < arguments.length; i++) total += arguments[i].length;
    var out = new Uint8Array(total);
    var offset = 0;
    for (var j = 0; j < arguments.length; j++) { out.set(arguments[j], offset); offset += arguments[j].length; }
    return out;
  }

  function run() {
    var input = document.getElementById('verify-url');
    if (!input) return;
    var value = input.value.trim();
    if (!value) return;
    if (!/^https?:\/\//.test(value)) value = 'https://' + value;
    verify(value).catch(function (error) {
      reportRoot.innerHTML = '<div class="report"><p class="tag no">FAILED</p><p>' + escapeHtml(error.message) + '</p></div>';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.getElementById('verify-run');
    if (button) button.addEventListener('click', run);
    document.querySelectorAll('.chips button[data-demo]').forEach(function (chip) {
      chip.addEventListener('click', function () {
        var input = document.getElementById('verify-url');
        input.value = chip.getAttribute('data-demo');
        run();
      });
    });
    var params = new URLSearchParams(location.search);
    if (params.get('url')) {
      document.getElementById('verify-url').value = params.get('url');
      run();
    }
  });
})();
