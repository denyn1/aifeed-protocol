<?php
/**
 * Standalone tests for the MAKO conversion + signing primitives (no WordPress).
 *
 * Run: php tests/mako-test.php
 */

define('ABSPATH', __DIR__);

class WP_Error
{
    private $code;
    private $message;

    public function __construct($code = '', $message = '')
    {
        $this->code = $code;
        $this->message = $message;
    }

    public function get_error_code()
    {
        return $this->code;
    }

    public function get_error_message()
    {
        return $this->message;
    }
}

if (!function_exists('get_option')) {
    $GLOBALS['__aifeed_test_options'] = array();
    function get_option($key, $default = '')
    {
        return array_key_exists($key, $GLOBALS['__aifeed_test_options']) ? $GLOBALS['__aifeed_test_options'][$key] : $default;
    }
    function update_option($key, $value, $autoload = null)
    {
        $GLOBALS['__aifeed_test_options'][$key] = $value;
        return true;
    }
    function delete_option($key)
    {
        unset($GLOBALS['__aifeed_test_options'][$key]);
        return true;
    }
    function wp_json_encode($value, $flags = 0)
    {
        return json_encode($value, $flags);
    }
    function apply_filters($tag, $value)
    {
        return $value;
    }
    function is_wp_error($thing)
    {
        return $thing instanceof WP_Error;
    }
    function __($text, $domain = null)
    {
        return $text;
    }
}

require_once __DIR__ . '/../includes/class-aifeed-keys.php';
require_once __DIR__ . '/../includes/class-aifeed-mako-html.php';
require_once __DIR__ . '/../includes/class-aifeed-mako.php';

$failures = array();

function check($condition, $label)
{
    global $failures;
    if ($condition) {
        echo "ok - $label\n";
    } else {
        $failures[] = $label;
        echo "FAIL - $label\n";
    }
}

$html = '<html><head><title>T</title></head><body><nav>Menu</nav><article><h1>Judul</h1>'
    . '<p>Isi <strong>tebal</strong> &amp; <a href="https://contoh.id">tautan</a>.</p>'
    . '<ul><li>Satu</li><li>Dua</li></ul><pre><code>aifeed mako sign</code></pre></article>'
    . '<footer>kaki</footer></body></html>';
$markdown = AIFeed_Mako_Html::convert($html);
check(strpos($markdown, '# Judul') === 0, 'converter renders heading at start');
check(strpos($markdown, '**tebal**') !== false, 'converter renders bold');
check(strpos($markdown, '[tautan](https://contoh.id)') !== false, 'converter renders links');
check(strpos($markdown, "- Satu\n- Dua") !== false, 'converter renders list items');
check(strpos($markdown, '```') !== false, 'converter renders code fences');
check(strpos($markdown, 'Menu') === false && strpos($markdown, 'kaki') === false, 'converter strips nav/footer');
check(strpos($markdown, '&amp;') === false && strpos($markdown, '&') !== false, 'converter decodes entities');

check(AIFeed_Mako_Html::estimate_tokens('satu dua tiga empat') === 6, 'token estimate uses word heuristic');

$truncated = AIFeed_Mako_Html::truncate_to_tokens(str_repeat('kata ', 2000), 100);
check($truncated['truncated'] === true, 'truncate marks truncated');
check(AIFeed_Mako_Html::estimate_tokens($truncated['text']) <= 105, 'truncated body respects token budget');

$yaml = AIFeed_Mako_Html::render_yaml(array(
    'mako' => '1.0',
    'tokens' => 10,
    'aifeed' => array('policy_version' => '0.2', 'usage' => array('training' => 'deny')),
    'tags' => array('aifeed', 'mako')
), 0);
check(strpos($yaml, 'mako: "1.0"') !== false, 'yaml quotes strings');
check(strpos($yaml, 'tokens: 10') !== false, 'yaml renders integers');
check(strpos($yaml, "  usage:\n    training: \"deny\"") !== false, 'yaml renders nested maps');
check(strpos($yaml, '  - "aifeed"') !== false, 'yaml renders lists');

$assetsHtml = '<article><p><a href="/laporan.pdf">Laporan</a></p><img src="/img.webp" alt="x">'
    . '<video controls><source src="/media/v.mp4"></video><a href="/arsip.zip" download>Arsip</a></article>';
$assets = AIFeed_Mako_Html::extract_assets($assetsHtml);
check(count($assets) === 4, 'extract_assets finds document, image, video, archive');
$byUrl = array();
foreach ($assets as $asset) {
    $byUrl[$asset['url']] = $asset['type'];
}
check(isset($byUrl['/laporan.pdf']) && $byUrl['/laporan.pdf'] === 'document', 'document classified');
check(isset($byUrl['/img.webp']) && $byUrl['/img.webp'] === 'image', 'image classified');
check(isset($byUrl['/media/v.mp4']) && $byUrl['/media/v.mp4'] === 'video', 'video source classified');
check(isset($byUrl['/arsip.zip']) && $byUrl['/arsip.zip'] === 'archive', 'archive classified');
$section = AIFeed_Mako_Html::assets_section($assets);
check(strpos($section, '## Media & Unduhan') !== false, 'assets section rendered');
check(strpos($section, '- [Laporan](/laporan.pdf)') !== false, 'assets section links the document');
$assetsYaml = AIFeed_Mako_Html::render_yaml(array('aifeed' => array('assets' => $assets)), 0);
check(strpos($assetsYaml, '- url: "/laporan.pdf"') !== false, 'yaml renders list of maps inline');
check(strpos($assetsYaml, '  type: "document"') !== false, 'yaml renders nested list map fields');

if (AIFeed_Keys::sodium_available()) {
    AIFeed_Keys::generate('test-key');
    $url = 'https://contoh.id/artikel/satu';
    $body = "---\nmako: \"1.0\"\ntype: article\nentity: \"X\"\nupdated: 2026-09-15\ntokens: 5\nlanguage: id\n---\n\nIsi artikel.\n";
    $container = AIFeed_Mako::build_container($url, $body, 'mako');
    check(!is_wp_error($container), 'build_container succeeds');
    if (!is_wp_error($container)) {
        check($container['context'] === 'mako', 'container context is mako');
        check($container['key_fingerprint'] === AIFeed_Keys::get_fingerprint(), 'fingerprint matches key store');
        check($container['raw_digest']['sha-256'] === base64_encode(hash('sha256', $body, true)), 'raw_digest matches body');

        $public_raw = AIFeed_Keys::public_key_raw();
        $signature = base64_decode(strtr(substr($container['signature'], strlen('base64url:')), '-_', '+/') . '==');
        $message = AIFeed_Mako::signed_bytes($url, $body, 'mako');
        check(sodium_crypto_sign_verify_detached($signature, $message, $public_raw), 'signature verifies over signed bytes');

        $tampered = $body . "tambahan";
        check(!sodium_crypto_sign_verify_detached($signature, AIFeed_Mako::signed_bytes($url, $tampered, 'mako'), $public_raw), 'tampered body fails verification');
        check(!sodium_crypto_sign_verify_detached($signature, AIFeed_Mako::signed_bytes('https://contoh.id/lain', $body, 'mako'), $public_raw), 'cross-URL replay fails verification');
    }

    $index_container = AIFeed_Mako::build_container('https://contoh.id/.well-known/mako-index.json', '{}', 'mako-index');
    check(!is_wp_error($index_container) && $index_container['context'] === 'mako-index', 'index container uses mako-index context');

    $aimd_container = AIFeed_Mako::build_container($url, $body, 'aimd');
    check(!is_wp_error($aimd_container) && $aimd_container['context'] === 'aimd', 'AIMD container uses aimd context');
    if (!is_wp_error($aimd_container)) {
        $aimd_signature = base64_decode(strtr(substr($aimd_container['signature'], strlen('base64url:')), '-_', '+/') . '==');
        $aimd_message = AIFeed_Mako::signed_bytes($url, $body, 'aimd');
        check(sodium_crypto_sign_verify_detached($aimd_signature, $aimd_message, $public_raw), 'AIMD signature verifies over aimd separation');
        check(AIFeed_Mako::signed_bytes($url, $body, 'aimd') !== AIFeed_Mako::signed_bytes($url, $body, 'mako'), 'AIFeed Markdown and MAKO separations differ');
    }
    $aimd_index_container = AIFeed_Mako::build_container('https://contoh.id/.well-known/aifeed-index.json', '{}', 'aimd-index');
    check(!is_wp_error($aimd_index_container) && $aimd_index_container['context'] === 'aimd-index', 'AIMD index container uses aimd-index context');
} else {
    echo "skip - sodium unavailable, signing tests skipped\n";
}

if (!empty($failures)) {
    echo "\n" . count($failures) . " failure(s)\n";
    exit(1);
}
echo "\nall MAKO plugin tests passed\n";
exit(0);
