<?php
/**
 * "AIFeed Verified" badge shortcode.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Badge
{
    public static function init()
    {
        add_shortcode('aifeed_badge', array(__CLASS__, 'shortcode'));
    }

    public static function shortcode($atts = array())
    {
        $settings = AIFeed_Admin::get_settings();
        if (empty($settings['badge_enabled']) || !AIFeed_Keys::has_keys()) {
            return '';
        }
        $domain = AIFeed_Manifest::domain();
        if ($domain === '') {
            return '';
        }
        $url = 'https://aifeed.md/validator/?domain=' . rawurlencode($domain);
        return sprintf(
            '<a class="aifeed-badge" rel="noopener nofollow" target="_blank" href="%s" title="%s">%s</a>',
            esc_url($url),
            esc_attr__('This site publishes a signed AIFeed declaration', 'aifeed'),
            esc_html__('AIFeed Verified', 'aifeed')
        );
    }
}
