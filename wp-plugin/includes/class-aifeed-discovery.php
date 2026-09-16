<?php
/**
 * Advertises the AIFeed manifest so AI clients can discover it on first contact.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Discovery
{
    public static function init()
    {
        add_action('send_headers', array(__CLASS__, 'send_link_header'));
        add_action('wp_head', array(__CLASS__, 'print_link_element'), 1);
        add_filter('robots_txt', array(__CLASS__, 'robots_hint'), 10, 2);
    }

    private static function is_published()
    {
        return AIFeed_Signer::get_manifest_json() !== '';
    }

    public static function send_link_header()
    {
        if (!self::is_published()) {
            return;
        }
        header('Link: </.well-known/ai.json>; rel="ai-feed"; type="application/json"', false);
    }

    public static function print_link_element()
    {
        if (!self::is_published()) {
            return;
        }
        echo '<link rel="ai-feed" href="/.well-known/ai.json" type="application/json" />' . "\n";
    }

    public static function robots_hint($output, $public)
    {
        if (!self::is_published()) {
            return $output;
        }
        $url = home_url('/.well-known/ai.json');
        return rtrim($output, "\n") . "\n# AIFeed: " . $url . "\n";
    }
}
