<?php
/**
 * Serves /.well-known/ai.json and /.well-known/ai-signature.json.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Publisher
{
    public static function init()
    {
        add_action('template_redirect', array(__CLASS__, 'maybe_serve'), 1);
    }

    public static function maybe_serve()
    {
        $request_uri = isset($_SERVER['REQUEST_URI'])
            ? wp_unslash($_SERVER['REQUEST_URI']) // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- path only.
            : '';
        $path = wp_parse_url($request_uri, PHP_URL_PATH);
        if (!is_string($path)) {
            return;
        }

        if ($path === '/.well-known/ai.json') {
            self::serve(AIFeed_Signer::get_manifest_json());
        } elseif ($path === '/.well-known/ai-signature.json') {
            self::serve(AIFeed_Signer::get_signature_json());
        } elseif (self::is_reserved_aifeed_path($path)) {
            status_header(404);
            header('Content-Type: application/json; charset=utf-8');
            header('Cache-Control: no-store');
            echo '{"error":"not_found"}';
            exit;
        }
    }

    private static function is_reserved_aifeed_path($path)
    {
        if (strpos($path, '/.well-known/ai') !== 0) {
            return false;
        }
        if (class_exists('AIFeed_Mako')) {
            foreach (array(AIFeed_Mako::AIMD_INDEX_PATH, AIFeed_Mako::AIMD_INDEX_PATH . '.sig') as $owned) {
                if ($path === $owned) {
                    return false;
                }
            }
        }
        return true;
    }

    private static function serve($body)
    {
        $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';
        if ($method !== 'GET' && $method !== 'HEAD') {
            status_header(405);
            header('Allow: GET, HEAD');
            exit;
        }

        header('Content-Type: application/json; charset=utf-8');
        header('Access-Control-Allow-Origin: *');
        header('Cache-Control: public, max-age=3600, must-revalidate');

        if (!is_string($body) || $body === '') {
            status_header(404);
            echo '{"error":"not_published"}';
            exit;
        }

        status_header(200);
        echo $body; // phpcs:ignore WordPress.Security.EscapeOutput -- exact signed bytes must be served unmodified.
        exit;
    }
}
