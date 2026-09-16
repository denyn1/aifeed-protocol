<?php
/**
 * Plugin Name:       AIFeed
 * Plugin URI:        https://aifeed.md/
 * Description:       Publishes a signed AIFeed declaration at /.well-known/ai.json and serves per-page markdown to AI agents in both native AIFeed Markdown (text/aifeed+markdown) and MAKO (text/mako+markdown) formats.
 * Version:           1.0.0-draft
 * Requires at least: 6.0
 * Requires PHP:      7.2
 * Author:            AIFeed Protocol Contributors
 * License:           MIT
 * License URI:       https://opensource.org/licenses/MIT
 * Text Domain:       aifeed
 */

if (!defined('ABSPATH')) {
    exit;
}

define('AIFEED_VERSION', '1.0.0-draft');
define('AIFEED_PLUGIN_FILE', __FILE__);
define('AIFEED_PLUGIN_DIR', plugin_dir_path(__FILE__));

require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-jcs.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-keys.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-mako-html.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-manifest.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-signer.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-mako.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-publisher.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-discovery.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-badge.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-mode.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-network.php';
require_once AIFEED_PLUGIN_DIR . 'includes/class-aifeed-admin.php';

register_activation_hook(__FILE__, 'aifeed_activate');
register_deactivation_hook(__FILE__, 'aifeed_deactivate');

function aifeed_activate()
{
    if (!wp_next_scheduled('aifeed_resign_event')) {
        wp_schedule_event(time() + HOUR_IN_SECONDS, 'monthly', 'aifeed_resign_event');
    }
    if (class_exists('AIFeed_Admin')) {
        $settings = AIFeed_Admin::get_settings();
        if ($settings['profile'] === '') {
            $settings['profile'] = AIFeed_Mode::detect_profile();
        }
        $settings = AIFeed_Mode::apply_profile($settings, $settings['profile']);
        update_option('aifeed_settings', $settings, false);
        if (AIFeed_Keys::sodium_available()) {
            if (!AIFeed_Keys::has_keys()) {
                AIFeed_Keys::generate();
            }
            if (AIFeed_Keys::has_keys()) {
                AIFeed_Signer::sign_and_store();
            }
        }
    }
}

function aifeed_deactivate()
{
    $timestamp = wp_next_scheduled('aifeed_resign_event');
    if ($timestamp) {
        wp_unschedule_event($timestamp, 'aifeed_resign_event');
    }
}

add_action('plugins_loaded', 'aifeed_bootstrap');
add_filter('cron_schedules', 'aifeed_cron_schedules');

function aifeed_cron_schedules($schedules)
{
    if (!isset($schedules['monthly'])) {
        $schedules['monthly'] = array(
            'interval' => 30 * DAY_IN_SECONDS,
            'display' => __('Every month', 'aifeed'),
        );
    }
    return $schedules;
}

function aifeed_bootstrap()
{
    load_plugin_textdomain('aifeed', false, dirname(plugin_basename(__FILE__)) . '/languages');
    AIFeed_Publisher::init();
    AIFeed_Mako::init();
    AIFeed_Discovery::init();
    AIFeed_Badge::init();
    AIFeed_Mode::init();
    AIFeed_Network::init();
    AIFeed_Admin::init();
    add_action('aifeed_resign_event', array('AIFeed_Signer', 'sign_and_store'));
}
