<?php
/**
 * Uninstall routine: removes options, derived MAKO caches, and scheduled events.
 * Post, page, and media content is never touched.
 *
 * @package AIFeed
 */

if (!defined('WP_UNINSTALL_PLUGIN')) {
    exit;
}

$options = array(
    'aifeed_secret_key',
    'aifeed_public_key',
    'aifeed_fingerprint',
    'aifeed_key_id',
    'aifeed_manifest_json',
    'aifeed_signature_json',
    'aifeed_signed_at',
    'aifeed_last_error',
    'aifeed_settings',
    'aifeed_pending_change',
);

$aifeed_cleanup_site = function () use ($options) {
    foreach ($options as $option) {
        delete_option($option);
    }

    // Derived MAKO data: per-post render/signature cache, the delta index transient,
    // and the llms.txt transient.
    delete_post_meta_by_key('_aifeed_mako_cache');
    delete_transient('aifeed_mako_index');
    delete_transient('aifeed_llms_txt');

    $timestamp = wp_next_scheduled('aifeed_resign_event');
    if ($timestamp) {
        wp_unschedule_event($timestamp, 'aifeed_resign_event');
    }
    wp_clear_scheduled_hook('aifeed_resign_event');
};

if (function_exists('is_multisite') && is_multisite()) {
    // phpcs:ignore WordPress.Security.NonceVerification -- uninstall context, no input.
    $site_ids = get_sites(array('fields' => 'ids', 'number' => 0));
    foreach ($site_ids as $site_id) {
        switch_to_blog((int) $site_id);
        $aifeed_cleanup_site();
        restore_current_blog();
    }
    // Network-level leftovers.
    delete_site_option('aifeed_network_settings');
} else {
    $aifeed_cleanup_site();
}

// Static files optionally written to the webroot (write_static=1). Best effort.
if (defined('ABSPATH')) {
    foreach (array(ABSPATH . '.well-known/ai.json', ABSPATH . '.well-known/ai-signature.json') as $static_file) {
        if (is_file($static_file)) {
            @unlink($static_file); // phpcs:ignore WordPress.PHP.NoSilencedErrors -- best-effort cleanup.
        }
    }
    if (function_exists('wp_cache_flush')) {
        wp_cache_flush();
    }
}
