<?php
/**
 * Differential test: PHP JCS + Ed25519 vs Node-generated fixtures.
 *
 * Usage (from the plugin directory): php tests/jcs-test.php
 *
 * @package AIFeed
 */

error_reporting(E_ALL);

define('ABSPATH', dirname(__DIR__) . '/');
require dirname(__DIR__) . '/includes/class-aifeed-jcs.php';

$failures = 0;

function aifeed_test_check($label, $actual, $expected)
{
    global $failures;
    if ($actual !== $expected) {
        $failures++;
        fwrite(STDERR, "FAIL " . $label . "\n  expected: " . $expected . "\n  actual:   " . $actual . "\n");
        return;
    }
    echo "ok " . $label . "\n";
}

$fixture_candidates = array(
    dirname(__DIR__, 2) . '/aifeed-protocol/tools/jcs-php-fixtures.json',
    dirname(__DIR__, 3) . '/aifeed-protocol/tools/jcs-php-fixtures.json',
);
$fixture_path = '';
foreach ($fixture_candidates as $candidate) {
    if (file_exists($candidate)) {
        $fixture_path = $candidate;
        break;
    }
}
if ($fixture_path === '') {
    fwrite(STDERR, "Cannot locate tools/jcs-php-fixtures.json (run: node tools/gen-vectors.js? no - run node tools/jcs-php-fixtures)\n");
    exit(2);
}
$fixtures = json_decode(file_get_contents($fixture_path), true);

aifeed_test_check(
    'key sorting (UTF-16 code units)',
    AIFeed_JCS::encode(array('b' => 1, 'a' => 2, 'A' => 3)),
    $fixtures['c1']
);

aifeed_test_check(
    'string escaping and unicode passthrough',
    AIFeed_JCS::encode(array(
        'a' => "x\"y\n",
        'u' => "caf\u{00e9}",
        'e' => "\u{1F600}",
        'c' => chr(1),
    )),
    $fixtures['c2']
);

$manifest_candidates = array(
    dirname(__DIR__, 2) . '/aifeed-protocol/conformance/vectors/positive/001-basic/ai.json',
    dirname(__DIR__, 3) . '/aifeed-protocol/conformance/vectors/positive/001-basic/ai.json',
);
$manifest_path = '';
foreach ($manifest_candidates as $candidate) {
    if (file_exists($candidate)) {
        $manifest_path = $candidate;
        break;
    }
}
if ($manifest_path === '') {
    fwrite(STDERR, "Cannot locate conformance vector 001-basic\n");
    exit(2);
}

$manifest = json_decode(file_get_contents($manifest_path), true);
$canonical = AIFeed_JCS::encode($manifest);
aifeed_test_check('vector 001 canonical length', (string) strlen($canonical), (string) $fixtures['c3length']);
aifeed_test_check('vector 001 canonical sha256', hash('sha256', $canonical), $fixtures['c3sha256']);

$signature_path = dirname($manifest_path) . '/ai-signature.json';
$container = json_decode(file_get_contents($signature_path), true);
if (!is_array($container) || !isset($container['signature'])) {
    fwrite(STDERR, "Cannot read signature container\n");
    exit(2);
}

if (function_exists('sodium_crypto_sign_verify_detached')) {
    $message = "aifeed.v0.1\n" . $canonical;
    $encoded = substr($container['signature'], strlen('base64url:'));
    $signature = base64_decode(strtr($encoded, '-_', '+/') . '==', true);
    $public_value = $manifest['identity']['public_key'];
    $der = base64_decode(substr($public_value, strlen('ed25519:')), true);
    $public_raw = substr($der, 12);
    aifeed_test_check(
        'Ed25519 verification of Node signature',
        sodium_crypto_sign_verify_detached($signature, $message, $public_raw) ? 'true' : 'false',
        'true'
    );
} else {
    echo "skip Ed25519 verification (sodium extension unavailable)\n";
}

exit($failures === 0 ? 0 : 1);
