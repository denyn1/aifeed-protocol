<?php
/**
 * AIFeed Markdown + MAKO trust layer for WordPress.
 *
 * Serves per-page markdown via content negotiation:
 *   - AIFeed Markdown  (Accept: text/aifeed+markdown, native AIFeed profile)
 *   - MAKO  (Accept: text/mako+markdown, compatibility profile)
 * The same signed bytes serve both; each media type carries its own signature
 * context (aimd / mako) and the delta index is published at both paths.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Mako
{
    const SEPARATION = "aifeed.mako.v0.2\n";
    const INDEX_SEPARATION = "aifeed.mako-index.v0.2\n";
    const AIMD_SEPARATION = "aifeed.aimd.v1\n";
    const AIMD_INDEX_SEPARATION = "aifeed.aimd-index.v1\n";
    const MEDIA_TYPE_MAKO = 'text/mako+markdown';
    const MEDIA_TYPE_AIMD = 'text/aifeed+markdown';
    const META_CACHE = '_aifeed_mako_cache';
    const TRANSIENT_INDEX = 'aifeed_mako_index';
    const INDEX_PATH = '/.well-known/mako-index.json';
    const AIMD_INDEX_PATH = '/.well-known/aifeed-index.json';
    const PAYLOAD_VERSION = 3;

    public static function init()
    {
        add_action('template_redirect', array(__CLASS__, 'maybe_serve'), 2);
        add_action('wp_head', array(__CLASS__, 'add_link_alternate'), 5);
        add_action('admin_notices', array(__CLASS__, 'admin_notices'));
        add_action('save_post', array(__CLASS__, 'invalidate_post_cache'), 10, 1);
    }

    public static function enabled()
    {
        return (bool) apply_filters('aifeed_mako_enabled', true);
    }

    public static function external_generator_active()
    {
        $detected = defined('MAKO_VERSION') || class_exists('Mako\\Plugin') || function_exists('mako_middleware');
        return (bool) apply_filters('aifeed_mako_external_generator', $detected);
    }

    public static function should_serve()
    {
        return self::enabled() && !self::external_generator_active();
    }

    public static function dual_stack()
    {
        return (bool) apply_filters('aifeed_dual_stack', true);
    }

    public static function admin_notices()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        if (self::external_generator_active()) {
            echo '<div class="notice notice-info"><p><strong>AIFeed:</strong> MAKO generation is delegated to the detected mako-wp integration; AIFeed continues to publish the signed manifest and permission policy.</p></div>';
            return;
        }
        if (self::enabled() && !AIFeed_Keys::sodium_available()) {
            echo '<div class="notice notice-warning"><p><strong>AIFeed:</strong> PHP sodium is unavailable, so MAKO documents are served unsigned. Enable the sodium extension to sign MAKO responses.</p></div>';
        }
    }

    public static function invalidate_post_cache($post_id)
    {
        delete_post_meta($post_id, self::META_CACHE);
        delete_transient(self::TRANSIENT_INDEX);
        delete_transient('aifeed_llms_txt');
    }

    public static function add_link_alternate()
    {
        if (!self::enabled() || !is_singular()) {
            return;
        }
        $url = get_permalink();
        if (is_string($url) && $url !== '') {
            echo '<link rel="alternate" type="text/aifeed+markdown" href="' . esc_url($url) . '">' . "\n";
            if (self::dual_stack()) {
                echo '<link rel="alternate" type="text/mako+markdown" href="' . esc_url($url) . '">' . "\n";
            }
        }
    }

    public static function render_post($post)
    {
        $settings = AIFeed_Admin::get_settings();
        // Global shared-hosting guard: bound CPU spent in the_content filters
        // (shortcodes/oEmbed) per request. Filterable for large publishers.
        $max_source = (int) apply_filters('aifeed_mako_max_source_bytes', 512 * 1024);
        $source = isset($post->post_content) ? $post->post_content : '';
        if ($max_source > 0 && strlen($source) > $max_source) {
            $source = substr($source, 0, $max_source);
        }
        $html = apply_filters('the_content', $source);
        $assets = apply_filters('aifeed_mako_assets', AIFeed_Mako_Html::extract_assets($html), $post);
        $body = AIFeed_Mako_Html::convert($html);
        $dual = self::dual_stack();
        $max_tokens = $dual
            ? (int) apply_filters('aifeed_mako_max_tokens', 1000)
            : (int) apply_filters('aifeed_aimd_max_tokens', 4000);
        if ($max_tokens > 0) {
            $truncated = AIFeed_Mako_Html::truncate_to_tokens($body, $max_tokens);
            $body = $truncated['text'];
        }
        $body .= AIFeed_Mako_Html::assets_section($assets);

        $type_map = array('post' => 'article', 'page' => 'landing', 'product' => 'product');
        $type = isset($type_map[$post->post_type]) ? $type_map[$post->post_type] : 'article';
        $type = (string) apply_filters('aifeed_mako_type', $type, $post);
        if (!in_array($type, AIFeed_Mako_Html::MAKO_TYPES, true)) {
            $type = 'article';
        }

        $title = wp_strip_all_tags(get_the_title($post));
        if ($title === '') {
            $title = 'Untitled';
        }

        $fields = array(
            'aimd' => '1.0',
        );
        if ($dual) {
            $fields['mako'] = '1.0';
        }
        $fields['type'] = $type;
        $fields['entity'] = $title;
        $fields['updated'] = mysql2date('Y-m-d', $post->post_modified_gmt, false);
        $fields['tokens'] = AIFeed_Mako_Html::estimate_tokens($body);
        $fields['language'] = AIFeed_Manifest::language();
        $canonical = get_permalink($post);
        if (is_string($canonical) && $canonical !== '') {
            $fields['canonical'] = $canonical;
        }
        $excerpt = wp_strip_all_tags(get_the_excerpt($post));
        if ($excerpt !== '') {
            $fields['summary'] = mb_substr($excerpt, 0, 160);
        }

        $allowed = is_array($settings['usage_allowed']) ? $settings['usage_allowed'] : array();
        $usage = array();
        foreach (array('training', 'summarize', 'reproduce', 'modify', 'commercial_use', 'embed') as $key) {
            $usage[$key] = in_array($key, $allowed, true) ? 'allow' : 'deny';
        }
        if (!in_array('training', $allowed, true)) {
            $usage['training'] = 'deny';
        }
        $aifeed = array(
            'policy_version' => '0.2',
            'usage' => $usage,
            'attribution' => in_array($settings['attribution'], array('required', 'optional', 'none'), true) ? $settings['attribution'] : 'required',
            'limits' => array(
                'requests_per_minute' => (int) $settings['requests_per_minute'],
                'concurrent' => (int) $settings['concurrent'],
                'crawl_delay_seconds' => (int) $settings['crawl_delay_seconds'],
            ),
        );
        if (!empty($assets)) {
            $aifeed['assets'] = $assets;
        }
        $fields['aifeed'] = $aifeed;

        $alternates = apply_filters('aifeed_aimd_alternates', array(), $post);
        if (is_array($alternates) && !empty($alternates)) {
            $clean_alternates = array();
            foreach (array_slice($alternates, 0, 20) as $alternate) {
                if (is_array($alternate) && isset($alternate['url'], $alternate['lang'])) {
                    $clean_alternates[] = array(
                        'url' => (string) $alternate['url'],
                        'lang' => (string) $alternate['lang'],
                    );
                }
            }
            if (!empty($clean_alternates)) {
                $fields['alternates'] = $clean_alternates;
            }
        }

        $text = "---\n" . AIFeed_Mako_Html::render_yaml($fields, 0) . "\n---\n\n" . $body . "\n";

        $tags = array();
        if (function_exists('get_the_tags')) {
            $post_tags = get_the_tags($post);
            if (is_array($post_tags)) {
                foreach ($post_tags as $tag) {
                    if (isset($tag->name)) {
                        $tags[] = $tag->name;
                    }
                    if (count($tags) >= 10) {
                        break;
                    }
                }
            }
        }
        $related = apply_filters('aifeed_mako_related', array(), $post);
        if (!is_array($related)) {
            $related = array();
        }
        $related = array_slice(array_map('strval', $related), 0, 20);

        return array(
            'text' => $text,
            'type' => $type,
            'tokens' => $fields['tokens'],
            'updated' => $fields['updated'],
            'canonical' => isset($fields['canonical']) ? $fields['canonical'] : '',
            'title' => $title,
            'summary' => isset($fields['summary']) ? $fields['summary'] : '',
            'tags' => $tags,
            'lang' => $fields['language'],
            'related' => $related
        );
    }

    public static function signed_bytes($url, $body, $context = 'mako')
    {
        $separations = array(
            'mako' => self::SEPARATION,
            'mako-index' => self::INDEX_SEPARATION,
            'aimd' => self::AIMD_SEPARATION,
            'aimd-index' => self::AIMD_INDEX_SEPARATION,
        );
        $separation = isset($separations[$context]) ? $separations[$context] : self::SEPARATION;
        return $separation . $url . "\n" . $body;
    }

    public static function build_container($url, $body, $context = 'mako')
    {
        if (!AIFeed_Keys::sodium_available() || !AIFeed_Keys::has_keys()) {
            return new WP_Error('aifeed_mako_unsigned', __('Content signing requires sodium and generated keys.', 'aifeed'));
        }
        $message = self::signed_bytes($url, $body, $context);
        $signature = AIFeed_Keys::sign($message);
        if (is_wp_error($signature)) {
            return $signature;
        }
        $public_raw = AIFeed_Keys::public_key_raw();
        if (is_wp_error($public_raw)) {
            return $public_raw;
        }
        if (!sodium_crypto_sign_verify_detached($signature, $message, $public_raw)) {
            return new WP_Error('aifeed_mako_self_verify', __('MAKO self-verification failed.', 'aifeed'));
        }
        return array(
            'algorithm' => 'ed25519',
            'context' => $context,
            'url' => $url,
            'key_fingerprint' => AIFeed_Keys::get_fingerprint(),
            'signed_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'signature' => 'base64url:' . AIFeed_Keys::base64url($signature),
            'raw_digest' => array(
                'sha-256' => base64_encode(hash('sha256', $body, true)),
                'applies_to' => 'raw-bytes',
            ),
        );
    }

    public static function post_payload($post)
    {
        $settings = AIFeed_Admin::get_settings();
        $cache_token = md5(wp_json_encode(array(
            'modified' => $post->post_modified_gmt,
            'settings' => $settings,
            'version' => AIFEED_VERSION,
            'payload' => self::PAYLOAD_VERSION,
        )));
        $cached = get_post_meta($post->ID, self::META_CACHE, true);
        if (is_array($cached) && isset($cached['token']) && $cached['token'] === $cache_token) {
            return $cached;
        }

        $rendered = self::render_post($post);
        $url = get_permalink($post);
        if (!is_string($url) || $url === '') {
            return new WP_Error('aifeed_mako_no_url', __('Post has no permalink.', 'aifeed'));
        }
        $payload = array(
            'token' => $cache_token,
            'text' => $rendered['text'],
            'type' => $rendered['type'],
            'tokens' => $rendered['tokens'],
            'updated' => $rendered['updated'],
            'url' => $url,
            'title' => $rendered['title'],
            'summary' => $rendered['summary'],
            'tags' => $rendered['tags'],
            'lang' => $rendered['lang'],
            'related' => $rendered['related']
        );
        $payload['containers'] = array();
        $contexts = self::dual_stack() ? array('mako', 'aimd') : array('aimd');
        foreach ($contexts as $context) {
            $container = self::build_container($url, $rendered['text'], $context);
            if (!is_wp_error($container)) {
                $payload['containers'][$context] = $container;
            }
        }
        if (isset($payload['containers']['mako'])) {
            $payload['container'] = $payload['containers']['mako'];
        }
        update_post_meta($post->ID, self::META_CACHE, $payload);
        return $payload;
    }

    public static function maybe_serve()
    {
        if (!self::enabled()) {
            return;
        }
        $request_uri = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : ''; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- path only.
        $path = wp_parse_url($request_uri, PHP_URL_PATH);
        if (!is_string($path)) {
            return;
        }

        if ($path === '/llms.txt') {
            self::serve_llms_txt();
        }
        if ($path === self::AIMD_INDEX_PATH) {
            self::serve_index(false, 'aimd');
        } elseif ($path === self::AIMD_INDEX_PATH . '.sig') {
            self::serve_index(true, 'aimd');
        }
        if ($path === self::INDEX_PATH || $path === self::INDEX_PATH . '.sig') {
            if (!self::dual_stack()) {
                return;
            }
            if ($path === self::INDEX_PATH) {
                self::serve_index(false, 'mako');
            } else {
                self::serve_index(true, 'mako');
            }
        }

        if (!self::should_serve()) {
            return;
        }
        $accept = isset($_SERVER['HTTP_ACCEPT']) ? (string) $_SERVER['HTTP_ACCEPT'] : '';
        if (strpos($accept, self::MEDIA_TYPE_AIMD) !== false) {
            $profile = 'aimd';
        } elseif (strpos($accept, self::MEDIA_TYPE_MAKO) !== false && self::dual_stack()) {
            $profile = 'mako';
        } else {
            return;
        }
        if (!is_singular()) {
            return;
        }
        $post = get_queried_object();
        if (!$post instanceof WP_Post) {
            return;
        }
        $payload = self::post_payload($post);
        if (is_wp_error($payload)) {
            return;
        }
        self::send_mako($payload, $profile);
    }

    private static function send_mako($payload, $profile = 'mako')
    {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
        $media_type = $profile === 'aimd' ? self::MEDIA_TYPE_AIMD : self::MEDIA_TYPE_MAKO;
        header('Content-Type: ' . $media_type . '; charset=utf-8');
        header('X-Mako-Version: 1.0');
        header('X-Mako-Tokens: ' . (int) $payload['tokens']);
        header('X-Mako-Type: ' . $payload['type']);
        header('X-Mako-Lang: ' . AIFeed_Manifest::language());
        header('X-Aifeed-Profile: ' . $profile);
        header('Vary: Accept');
        header('ETag: "' . $profile . '-' . substr(md5($payload['text']), 0, 16) . '"');
        header('Cache-Control: public, max-age=3600, must-revalidate');
        $container = isset($payload['containers'][$profile])
            ? $payload['containers'][$profile]
            : (isset($payload['container']) ? $payload['container'] : null);
        if (is_array($container)) {
            $encoded = wp_json_encode($container, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
            if (is_string($encoded)) {
                $prefix = $profile === 'aimd' ? 'aimd1:' : 'mako1:';
                header('X-Aifeed-Signature: ' . $prefix . AIFeed_Keys::base64url($encoded));
            }
        }
        status_header(200);
        if ($method === 'HEAD') {
            exit;
        }
        echo $payload['text']; // phpcs:ignore WordPress.Security.EscapeOutput -- exact signed bytes must be served unmodified.
        exit;
    }

    public static function index_payload()
    {
        $cached = get_transient(self::TRANSIENT_INDEX);
        if (is_array($cached) && isset($cached['json'])) {
            return $cached;
        }
        $limit = (int) apply_filters('aifeed_mako_index_limit', 200);
        $posts = get_posts(array(
            'numberposts' => $limit,
            'post_status' => 'publish',
            'post_type' => apply_filters('aifeed_mako_post_types', array('post', 'page')),
            'orderby' => 'modified',
            'order' => 'DESC',
        ));
        $entries = array();
        foreach ($posts as $post) {
            $payload = self::post_payload($post);
            if (is_wp_error($payload)) {
                continue;
            }
            $url_path = wp_parse_url($payload['url'], PHP_URL_PATH);
            if (!is_string($url_path) || $url_path === '') {
                continue;
            }
            $entry = array(
                'url' => $url_path,
                'type' => $payload['type'],
                'tokens' => (int) $payload['tokens'],
                'updated' => $payload['updated'],
                'etag' => '"mako-' . substr(md5($payload['text']), 0, 16) . '"',
                'sha-256' => base64_encode(hash('sha256', $payload['text'], true)),
            );
            if (isset($payload['title']) && is_string($payload['title']) && $payload['title'] !== '') {
                $entry['title'] = mb_substr($payload['title'], 0, 500);
            }
            if (isset($payload['summary']) && is_string($payload['summary']) && $payload['summary'] !== '') {
                $entry['summary'] = mb_substr($payload['summary'], 0, 160);
            }
            if (isset($payload['tags']) && is_array($payload['tags']) && !empty($payload['tags'])) {
                $entry['tags'] = array_slice($payload['tags'], 0, 10);
            }
            if (isset($payload['lang']) && is_string($payload['lang']) && $payload['lang'] !== '') {
                $entry['lang'] = $payload['lang'];
            }
            if (isset($payload['related']) && is_array($payload['related']) && !empty($payload['related'])) {
                $entry['related'] = array_slice($payload['related'], 0, 20);
            }
            $entries[] = $entry;
        }
        usort($entries, function ($a, $b) {
            return strcmp($a['url'], $b['url']);
        });

        $settings = AIFeed_Admin::get_settings();
        $site = array(
            'name' => wp_strip_all_tags(get_bloginfo('name')) !== '' ? wp_strip_all_tags(get_bloginfo('name')) : AIFeed_Manifest::domain(),
            'type' => in_array($settings['type'], AIFeed_Manifest::TYPES, true) ? $settings['type'] : 'other',
            'languages' => array(AIFeed_Manifest::language()),
            'updated_at' => gmdate('Y-m-d\TH:i:s\Z'),
        );
        $tagline = wp_strip_all_tags(get_bloginfo('description'));
        if ($tagline !== '') {
            $site['description'] = mb_substr($tagline, 0, 500);
        }
        $index = array(
            'version' => '0.2',
            'domain' => AIFeed_Manifest::domain(),
            'site' => $site,
            'generated_at' => gmdate('Y-m-d\TH:i:s\Z'),
            'page' => 1,
            'page_count' => 1,
            'entries' => $entries,
        );
        $json = wp_json_encode($index, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($json)) {
            return new WP_Error('aifeed_mako_index_encode', __('Failed to encode MAKO index.', 'aifeed'));
        }
        $json .= "\n";
        $payload = array('json' => $json, 'signature' => null, 'signatures' => array());
        if (AIFeed_Keys::sodium_available() && AIFeed_Keys::has_keys()) {
            $targets = array(
                'aimd-index' => home_url(self::AIMD_INDEX_PATH),
            );
            if (self::dual_stack()) {
                $targets['mako-index'] = home_url(self::INDEX_PATH);
            }
            foreach ($targets as $context => $index_url) {
                $container = self::build_container($index_url, $json, $context);
                if (is_wp_error($container)) {
                    continue;
                }
                $encoded = wp_json_encode($container, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                if (!is_string($encoded)) {
                    continue;
                }
                $key = $context === 'aimd-index' ? 'aimd' : 'mako';
                $payload['signatures'][$key] = $encoded;
            }
            if (isset($payload['signatures']['mako'])) {
                $payload['signature'] = $payload['signatures']['mako'];
            }
        }
        set_transient(self::TRANSIENT_INDEX, $payload, HOUR_IN_SECONDS);
        return $payload;
    }

    public static function llms_payload()
    {
        $cached = get_transient('aifeed_llms_txt');
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }
        $name = wp_strip_all_tags(get_bloginfo('name'));
        if ($name === '') {
            $name = AIFeed_Manifest::domain();
        }
        $lines = array('# ' . $name, '');
        $description = wp_strip_all_tags(get_bloginfo('description'));
        if ($description !== '') {
            $lines[] = '> ' . $description;
            $lines[] = '';
        }
        $limit = (int) apply_filters('aifeed_llms_limit', 200);
        foreach (array('Posts' => 'post', 'Pages' => 'page') as $label => $post_type) {
            $items = get_posts(array(
                'numberposts' => $limit,
                'post_status' => 'publish',
                'post_type' => $post_type,
                'orderby' => 'modified',
                'order' => 'DESC',
            ));
            if (empty($items)) {
                continue;
            }
            $lines[] = '## ' . $label;
            $lines[] = '';
            foreach ($items as $item) {
                $summary = wp_strip_all_tags(get_the_excerpt($item));
                $suffix = $summary !== '' ? ': ' . preg_replace('/\s+/', ' ', $summary) : '';
                $lines[] = '- [' . wp_strip_all_tags(get_the_title($item)) . '](' . get_permalink($item) . ')' . $suffix;
            }
            $lines[] = '';
        }
        $lines[] = '## Metadata';
        $lines[] = '';
        $lines[] = '- AIFeed manifest: ' . home_url('/.well-known/ai.json');
        $lines[] = '';
        $text = implode("\n", $lines);
        set_transient('aifeed_llms_txt', $text, HOUR_IN_SECONDS);
        return $text;
    }

    private static function serve_llms_txt()
    {
        if (!self::enabled() || AIFeed_Signer::get_manifest_json() === '') {
            return;
        }
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
        if ($method !== 'GET' && $method !== 'HEAD') {
            status_header(405);
            header('Allow: GET, HEAD');
            exit;
        }
        header('Content-Type: text/plain; charset=utf-8');
        header('Cache-Control: public, max-age=3600, must-revalidate');
        status_header(200);
        if ($method !== 'HEAD') {
            echo self::llms_payload(); // phpcs:ignore WordPress.Security.EscapeOutput -- discovery text, escaped per line above.
        }
        exit;
    }

    private static function serve_index($signature_only, $profile = 'mako')
    {
        $payload = self::index_payload();
        if (is_wp_error($payload)) {
            status_header(500);
            header('Content-Type: application/json; charset=utf-8');
            echo '{"error":"index_unavailable"}';
            exit;
        }
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
        if ($method !== 'GET' && $method !== 'HEAD') {
            status_header(405);
            header('Allow: GET, HEAD');
            exit;
        }
        header('Content-Type: application/json; charset=utf-8');
        header('Cache-Control: public, max-age=3600, must-revalidate');
        if ($signature_only) {
            $signature = isset($payload['signatures'][$profile])
                ? $payload['signatures'][$profile]
                : (isset($payload['signature']) ? $payload['signature'] : null);
            if (!is_string($signature) || $signature === '') {
                status_header(404);
                echo '{"error":"signature_unavailable"}';
                exit;
            }
            status_header(200);
            if ($method !== 'HEAD') {
                echo $signature; // phpcs:ignore WordPress.Security.EscapeOutput -- exact signed bytes.
            }
            exit;
        }
        status_header(200);
        if ($method !== 'HEAD') {
            echo $payload['json']; // phpcs:ignore WordPress.Security.EscapeOutput -- exact signed bytes.
        }
        exit;
    }
}
