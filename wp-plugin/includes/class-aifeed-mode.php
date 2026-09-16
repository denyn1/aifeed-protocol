<?php
/**
 * Operation modes: automatic, semi-automatic, and manual declaration management.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Mode
{
    const OPTION_PENDING = 'aifeed_pending_change';

    public static function profiles()
    {
        return array(
            'blog' => array(
                'label' => 'Blog / personal',
                'type' => 'blog',
                'usage' => array('search', 'retrieval', 'input', 'quote', 'summarize'),
                'attribution' => 'required',
            ),
            'news' => array(
                'label' => 'Berita / media',
                'type' => 'news',
                'usage' => array('search', 'retrieval', 'input', 'quote', 'summarize', 'translate'),
                'attribution' => 'required',
            ),
            'ecommerce' => array(
                'label' => 'E-commerce / toko',
                'type' => 'ecommerce',
                'usage' => array('search', 'retrieval', 'input', 'quote', 'summarize', 'translate', 'embed'),
                'attribution' => 'required',
            ),
            'marketplace' => array(
                'label' => 'Marketplace / multi-penjual',
                'type' => 'marketplace',
                'usage' => array('search', 'retrieval', 'input', 'quote', 'summarize', 'translate', 'embed'),
                'attribution' => 'required',
            ),
            'government' => array(
                'label' => 'Pemerintah / layanan publik',
                'type' => 'government',
                'usage' => array('search', 'retrieval', 'input', 'quote', 'summarize', 'reproduce', 'translate', 'embed'),
                'attribution' => 'optional',
            ),
            'open' => array(
                'label' => 'Terbuka (non-komersial)',
                'type' => 'blog',
                'usage' => array('search', 'retrieval', 'input', 'quote', 'summarize', 'translate', 'embed'),
                'attribution' => 'optional',
            ),
            'restrictive' => array(
                'label' => 'Restriktif (hampir semua ditolak)',
                'type' => 'other',
                'usage' => array('search'),
                'attribution' => 'required',
            ),
        );
    }

    public static function detect_profile()
    {
        if (class_exists('WooCommerce')) {
            return 'ecommerce';
        }
        return 'blog';
    }

    public static function apply_profile($settings, $profile_key)
    {
        $profiles = self::profiles();
        if (!isset($profiles[$profile_key])) {
            return $settings;
        }
        $profile = $profiles[$profile_key];
        $settings['type'] = $profile['type'];
        $settings['usage_allowed'] = $profile['usage'];
        $settings['attribution'] = $profile['attribution'];
        return $settings;
    }

    public static function pending()
    {
        $stored = get_option(self::OPTION_PENDING, '');
        return is_string($stored) ? $stored : '';
    }

    public static function mark_pending($trigger)
    {
        update_option(self::OPTION_PENDING, gmdate('Y-m-d\TH:i:s\Z') . '|' . $trigger, false);
    }

    public static function clear_pending()
    {
        delete_option(self::OPTION_PENDING);
    }

    public static function on_change($trigger)
    {
        $settings = AIFeed_Admin::get_settings();
        if ($settings['mode'] === 'auto') {
            if (!AIFeed_Keys::has_keys()) {
                $generated = AIFeed_Keys::generate();
                if (is_wp_error($generated)) {
                    return;
                }
            }
            self::auto_profile();
            AIFeed_Signer::sign_and_store();
        } elseif ($settings['mode'] === 'semi') {
            self::mark_pending($trigger);
        }
    }

    public static function auto_profile()
    {
        $settings = AIFeed_Admin::get_settings();
        if ($settings['profile'] === '') {
            $settings['profile'] = self::detect_profile();
        }
        $settings = self::apply_profile($settings, $settings['profile']);
        update_option('aifeed_settings', $settings, false);
        return $settings;
    }

    public static function handle_apply_pending()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Insufficient permissions.', 'aifeed'));
        }
        check_admin_referer('aifeed_apply_pending');
        AIFeed_Signer::sign_and_store();
        self::clear_pending();
        wp_safe_redirect(add_query_arg('aifeed_notice', 'signed', admin_url('options-general.php?page=aifeed')));
        exit;
    }

    public static function init()
    {
        add_action('updated_option', array(__CLASS__, 'watch_option'), 10, 3);
        add_action('activated_plugin', array(__CLASS__, 'watch_plugin'));
        add_action('deactivated_plugin', array(__CLASS__, 'watch_plugin'));
        add_action('admin_post_aifeed_apply_pending', array(__CLASS__, 'handle_apply_pending'));
        add_action('admin_notices', array(__CLASS__, 'pending_notice'));
    }

    public static function watch_option($option, $old_value, $value)
    {
        if (strpos($option, 'aifeed_') === 0) {
            return;
        }
        $watched = array('blogname', 'blogdescription', 'home', 'siteurl', 'WPLANG');
        if (!in_array($option, $watched, true)) {
            return;
        }
        if ($old_value === $value) {
            return;
        }
        self::on_change('option:' . $option);
    }

    public static function watch_plugin($plugin)
    {
        self::on_change('plugin:' . $plugin);
    }

    public static function pending_notice()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $pending = self::pending();
        if ($pending === '') {
            return;
        }
        $parts = explode('|', $pending, 2);
        $trigger = isset($parts[1]) ? $parts[1] : '';
        printf(
            '<div class="notice notice-warning"><p><strong>AIFeed:</strong> %s <em>%s</em></p><p><a class="button button-primary" href="%s">%s</a></p></div>',
            esc_html__('Site changes detected that may affect your declaration:', 'aifeed'),
            esc_html($trigger),
            esc_url(wp_nonce_url(admin_url('admin-post.php?action=aifeed_apply_pending'), 'aifeed_apply_pending')),
            esc_html__('Review & re-sign now', 'aifeed')
        );
    }
}
