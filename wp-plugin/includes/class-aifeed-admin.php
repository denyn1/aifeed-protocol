<?php
/**
 * Settings screen, actions, and status for AIFeed.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Admin
{
    const OPTION_SETTINGS = 'aifeed_settings';

    public static function init()
    {
        add_action('admin_menu', array(__CLASS__, 'menu'));
        add_action('admin_init', array(__CLASS__, 'register_settings'));
        add_action('admin_post_aifeed_generate_keys', array(__CLASS__, 'handle_generate_keys'));
        add_action('admin_post_aifeed_sign_now', array(__CLASS__, 'handle_sign_now'));
        add_action('admin_enqueue_scripts', array(__CLASS__, 'enqueue'));
        add_action('admin_notices', array(__CLASS__, 'notices'));
    }

    public static function defaults()
    {
        return array(
            'type' => 'blog',
            'organization' => '',
            'contact' => '',
            'attribution' => 'required',
            'attribution_url' => '',
            'attribution_text' => '',
            'usage_allowed' => array('search', 'retrieval', 'input'),
            'requests_per_minute' => 60,
            'concurrent' => 2,
            'crawl_delay_seconds' => 1,
            'sitemap' => 'wp-sitemap.xml',
            'write_static' => 0,
            'badge_enabled' => 0,
            'mode' => 'auto',
            'profile' => '',
            'custom_manifest_json' => '',
        );
    }

    public static function get_settings()
    {
        $stored = get_option(self::OPTION_SETTINGS, array());
        if (!is_array($stored)) {
            $stored = array();
        }
        return array_merge(self::defaults(), $stored);
    }

    public static function sanitize_settings($input)
    {
        $defaults = self::defaults();
        $output = $defaults;
        if (!is_array($input)) {
            return $output;
        }

        $type = isset($input['type']) ? $input['type'] : '';
        $output['type'] = in_array($type, AIFeed_Manifest::TYPES, true) ? $type : $defaults['type'];
        $output['organization'] = isset($input['organization']) ? sanitize_text_field($input['organization']) : '';
        $output['contact'] = isset($input['contact']) ? sanitize_text_field($input['contact']) : '';

        $attribution = isset($input['attribution']) ? $input['attribution'] : 'required';
        $output['attribution'] = in_array($attribution, array('required', 'optional', 'none'), true) ? $attribution : 'required';
        $output['attribution_url'] = isset($input['attribution_url']) ? esc_url_raw($input['attribution_url']) : '';
        $output['attribution_text'] = isset($input['attribution_text']) ? sanitize_text_field($input['attribution_text']) : '';

        $allowed = array();
        if (isset($input['usage_allowed']) && is_array($input['usage_allowed'])) {
            foreach ($input['usage_allowed'] as $key) {
                if (in_array($key, AIFeed_Manifest::USAGE_KEYS, true)) {
                    $allowed[] = $key;
                }
            }
        }
        $output['usage_allowed'] = $allowed;

        $output['requests_per_minute'] = max(1, min(1000000, isset($input['requests_per_minute']) ? (int) $input['requests_per_minute'] : 60));
        $output['concurrent'] = max(1, min(1000, isset($input['concurrent']) ? (int) $input['concurrent'] : 2));
        $output['crawl_delay_seconds'] = max(0, min(3600, isset($input['crawl_delay_seconds']) ? (int) $input['crawl_delay_seconds'] : 1));
        $output['sitemap'] = (isset($input['sitemap']) && $input['sitemap'] === 'sitemap.xml') ? 'sitemap.xml' : 'wp-sitemap.xml';
        $output['write_static'] = empty($input['write_static']) ? 0 : 1;
        $output['badge_enabled'] = empty($input['badge_enabled']) ? 0 : 1;

        $mode = isset($input['mode']) ? $input['mode'] : 'auto';
        $output['mode'] = in_array($mode, array('auto', 'semi', 'manual'), true) ? $mode : 'auto';
        $profiles = AIFeed_Mode::profiles();
        $profile = isset($input['profile']) ? $input['profile'] : '';
        $output['profile'] = isset($profiles[$profile]) ? $profile : '';
        $output['custom_manifest_json'] = isset($input['custom_manifest_json'])
            ? trim((string) wp_unslash($input['custom_manifest_json']))
            : '';
        if ($output['mode'] === 'auto') {
            if ($output['profile'] === '') {
                $output['profile'] = AIFeed_Mode::detect_profile();
            }
            $output = AIFeed_Mode::apply_profile($output, $output['profile']);
        }

        return $output;
    }

    public static function register_settings()
    {
        register_setting('aifeed', self::OPTION_SETTINGS, array(
            'type' => 'array',
            'sanitize_callback' => array(__CLASS__, 'sanitize_settings'),
            'default' => self::defaults(),
        ));
    }

    public static function menu()
    {
        add_options_page(
            __('AIFeed', 'aifeed'),
            __('AIFeed', 'aifeed'),
            'manage_options',
            'aifeed',
            array(__CLASS__, 'render')
        );
    }

    public static function enqueue($hook)
    {
        if ($hook !== 'settings_page_aifeed') {
            return;
        }
        wp_enqueue_style('aifeed-admin', plugins_url('assets/admin.css', AIFEED_PLUGIN_FILE), array(), AIFEED_VERSION);
    }

    public static function notices()
    {
        if (!isset($_GET['aifeed_notice'])) {
            return;
        }
        $notice = sanitize_key(wp_unslash($_GET['aifeed_notice']));
        $messages = array(
            'keys_generated' => array('success', __('Signing keys generated. Publish a declaration to activate AIFeed.', 'aifeed')),
            'keys_error' => array('error', __('Key generation failed. Check that the PHP sodium extension is enabled.', 'aifeed')),
            'signed' => array('success', __('Manifest signed and published.', 'aifeed')),
            'sign_error' => array('error', AIFeed_Signer::get_last_error() !== '' ? AIFeed_Signer::get_last_error() : __('Signing failed.', 'aifeed')),
        );
        if (!isset($messages[$notice])) {
            return;
        }
        printf(
            '<div class="notice notice-%s is-dismissible"><p>%s</p></div>',
            esc_attr($messages[$notice][0]),
            esc_html($messages[$notice][1])
        );
    }

    public static function handle_generate_keys()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Insufficient permissions.', 'aifeed'));
        }
        check_admin_referer('aifeed_generate_keys');
        $result = AIFeed_Keys::generate();
        $notice = is_wp_error($result) ? 'keys_error' : 'keys_generated';
        wp_safe_redirect(add_query_arg('aifeed_notice', $notice, admin_url('options-general.php?page=aifeed')));
        exit;
    }

    public static function handle_sign_now()
    {
        if (!current_user_can('manage_options')) {
            wp_die(esc_html__('Insufficient permissions.', 'aifeed'));
        }
        check_admin_referer('aifeed_sign_now');
        $result = AIFeed_Signer::sign_and_store();
        $notice = is_wp_error($result) ? 'sign_error' : 'signed';
        wp_safe_redirect(add_query_arg('aifeed_notice', $notice, admin_url('options-general.php?page=aifeed')));
        exit;
    }

    public static function dns_record_value()
    {
        $domain = AIFeed_Manifest::domain();
        return sprintf(
            'v=aifeed1; pk=%s; fp=%s; manifest=https://%s/.well-known/ai.json',
            AIFeed_Keys::get_public_key(),
            AIFeed_Keys::get_fingerprint(),
            $domain
        );
    }

    public static function render()
    {
        if (!current_user_can('manage_options')) {
            return;
        }
        $settings = self::get_settings();
        $domain = AIFeed_Manifest::domain();
        $has_keys = AIFeed_Keys::has_keys();
        $sodium = AIFeed_Keys::sodium_available();
        $signed_at = AIFeed_Signer::get_signed_at();
        $last_error = AIFeed_Signer::get_last_error();
        ?>
        <div class="wrap aifeed-wrap">
            <h1><?php esc_html_e('AIFeed', 'aifeed'); ?></h1>
            <p class="aifeed-subtitle">
                <?php esc_html_e('Publish a signed, verifiable declaration of how AI systems may use this site\'s content.', 'aifeed'); ?>
            </p>

            <?php if (!$sodium) : ?>
                <div class="notice notice-error"><p>
                    <?php esc_html_e('The PHP sodium extension is required. Ask your host to enable it.', 'aifeed'); ?>
                </p></div>
            <?php endif; ?>

            <div class="aifeed-grid">
                <div class="aifeed-card">
                    <h2><?php esc_html_e('Status', 'aifeed'); ?></h2>
                    <table class="widefat striped">
                        <tbody>
                            <tr>
                                <td><?php esc_html_e('Domain', 'aifeed'); ?></td>
                                <td><code><?php echo esc_html($domain); ?></code></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e('Signing keys', 'aifeed'); ?></td>
                                <td><?php echo $has_keys ? esc_html__('Generated', 'aifeed') : esc_html__('Not generated', 'aifeed'); ?></td>
                            </tr>
                            <tr>
                                <td><?php esc_html_e('Published at', 'aifeed'); ?></td>
                                <td><?php echo $signed_at !== '' ? esc_html($signed_at) : esc_html__('Not published', 'aifeed'); ?></td>
                            </tr>
                            <?php if ($last_error !== '') : ?>
                                <tr>
                                    <td><?php esc_html_e('Last error', 'aifeed'); ?></td>
                                    <td class="aifeed-error"><?php echo esc_html($last_error); ?></td>
                                </tr>
                            <?php endif; ?>
                        </tbody>
                    </table>

                    <p class="aifeed-actions">
                        <?php if (!$has_keys) : ?>
                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>">
                                <input type="hidden" name="action" value="aifeed_generate_keys" />
                                <?php wp_nonce_field('aifeed_generate_keys'); ?>
                                <button type="submit" class="button button-primary"><?php esc_html_e('Generate signing keys', 'aifeed'); ?></button>
                            </form>
                        <?php else : ?>
                            <form method="post" action="<?php echo esc_url(admin_url('admin-post.php')); ?>" style="display:inline">
                                <input type="hidden" name="action" value="aifeed_sign_now" />
                                <?php wp_nonce_field('aifeed_sign_now'); ?>
                                <button type="submit" class="button button-primary"><?php esc_html_e('Sign and publish now', 'aifeed'); ?></button>
                            </form>
                            <a class="button" target="_blank" rel="noopener" href="<?php echo esc_url(home_url('/.well-known/ai.json')); ?>">
                                <?php esc_html_e('View ai.json', 'aifeed'); ?>
                            </a>
                            <a class="button" target="_blank" rel="noopener" href="<?php echo esc_url('https://aifeed.md/validator/?domain=' . rawurlencode($domain)); ?>">
                                <?php esc_html_e('Validate online', 'aifeed'); ?>
                            </a>
                        <?php endif; ?>
                    </p>
                </div>

                <div class="aifeed-card">
                    <h2><?php esc_html_e('DNS anchor', 'aifeed'); ?></h2>
                    <p><?php esc_html_e('Add this TXT record to your domain\'s DNS. It binds your signing key to the domain and enables strong verification.', 'aifeed'); ?></p>
                    <?php if ($has_keys) : ?>
                        <p><strong><?php esc_html_e('Name', 'aifeed'); ?></strong><br /><code>_aifeed.<?php echo esc_html($domain); ?></code></p>
                        <textarea readonly rows="3" class="large-text code"><?php echo esc_textarea(self::dns_record_value()); ?></textarea>
                    <?php else : ?>
                        <p><em><?php esc_html_e('Generate keys to see the DNS record.', 'aifeed'); ?></em></p>
                    <?php endif; ?>
                </div>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields('aifeed'); ?>
                <h2><?php esc_html_e('Declaration settings', 'aifeed'); ?></h2>
                <table class="form-table" role="presentation">
                    <tr>
                        <th scope="row"><label for="aifeed-mode"><?php esc_html_e('Operation mode', 'aifeed'); ?></label></th>
                        <td>
                            <select id="aifeed-mode" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[mode]">
                                <option value="auto" <?php selected($settings['mode'], 'auto'); ?>><?php esc_html_e('Automatic (zero-touch)', 'aifeed'); ?></option>
                                <option value="semi" <?php selected($settings['mode'], 'semi'); ?>><?php esc_html_e('Semi-automatic (review changes)', 'aifeed'); ?></option>
                                <option value="manual" <?php selected($settings['mode'], 'manual'); ?>><?php esc_html_e('Manual (full control)', 'aifeed'); ?></option>
                            </select>
                            <p class="description">
                                <?php esc_html_e('Automatic: keys, signing, re-signing, and profile updates happen without further action. Semi-automatic: site changes are queued and you review & re-sign. Manual: you control the manifest JSON yourself.', 'aifeed'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-profile"><?php esc_html_e('Profile', 'aifeed'); ?></label></th>
                        <td>
                            <select id="aifeed-profile" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[profile]">
                                <option value="" <?php selected($settings['profile'], ''); ?>><?php esc_html_e('Auto-detect for this site', 'aifeed'); ?></option>
                                <?php foreach (AIFeed_Mode::profiles() as $key => $profile) : ?>
                                    <option value="<?php echo esc_attr($key); ?>" <?php selected($settings['profile'], $key); ?>><?php echo esc_html($profile['label']); ?></option>
                                <?php endforeach; ?>
                            </select>
                            <p class="description">
                                <?php esc_html_e('A profile presets site type, allowed AI uses, and attribution. In Automatic mode it is applied at every signing; in Semi-automatic you apply it explicitly.', 'aifeed'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-custom-json"><?php esc_html_e('Custom manifest (Manual mode)', 'aifeed'); ?></label></th>
                        <td>
                            <textarea id="aifeed-custom-json" rows="6" class="large-text code" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[custom_manifest_json]" placeholder='{"identity": {"public_key": "...", ...}}'><?php echo esc_textarea($settings['custom_manifest_json']); ?></textarea>
                            <p class="description">
                                <?php esc_html_e('Optional. Used only in Manual mode; validity timestamps are refreshed automatically and identity.public_key must match this site\'s signing key. Leave empty to use the generated manifest.', 'aifeed'); ?>
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-type"><?php esc_html_e('Site type', 'aifeed'); ?></label></th>
                        <td>
                            <select id="aifeed-type" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[type]">
                                <?php foreach (AIFeed_Manifest::TYPES as $type) : ?>
                                    <option value="<?php echo esc_attr($type); ?>" <?php selected($settings['type'], $type); ?>><?php echo esc_html($type); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-organization"><?php esc_html_e('Organization', 'aifeed'); ?></label></th>
                        <td><input id="aifeed-organization" class="regular-text" type="text" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[organization]" value="<?php echo esc_attr($settings['organization']); ?>" /></td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-contact"><?php esc_html_e('Contact', 'aifeed'); ?></label></th>
                        <td>
                            <input id="aifeed-contact" class="regular-text" type="text" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[contact]" value="<?php echo esc_attr($settings['contact']); ?>" placeholder="mailto:you@example.com / https://example.com/contact" />
                            <p class="description"><?php esc_html_e('Email or https URL for AI operators to reach you. Left empty, your site URL is published — your admin email is never exposed automatically.', 'aifeed'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Allowed AI uses', 'aifeed'); ?></th>
                        <td>
                            <?php foreach (AIFeed_Manifest::USAGE_KEYS as $key) : ?>
                                <label class="aifeed-check">
                                    <input type="checkbox" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[usage_allowed][]" value="<?php echo esc_attr($key); ?>" <?php checked(in_array($key, $settings['usage_allowed'], true)); ?> />
                                    <?php echo esc_html($key); ?>
                                </label>
                            <?php endforeach; ?>
                            <p class="description"><?php esc_html_e('Unchecked uses are denied. "training" and "reproduce" deny by default.', 'aifeed'); ?></p>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-attribution"><?php esc_html_e('Attribution', 'aifeed'); ?></label></th>
                        <td>
                            <select id="aifeed-attribution" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[attribution]">
                                <?php foreach (array('required', 'optional', 'none') as $mode) : ?>
                                    <option value="<?php echo esc_attr($mode); ?>" <?php selected($settings['attribution'], $mode); ?>><?php echo esc_html($mode); ?></option>
                                <?php endforeach; ?>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Rate limits', 'aifeed'); ?></th>
                        <td>
                            <label><?php esc_html_e('Requests/min', 'aifeed'); ?> <input type="number" min="1" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[requests_per_minute]" value="<?php echo esc_attr((string) $settings['requests_per_minute']); ?>" /></label>
                            <label><?php esc_html_e('Concurrent', 'aifeed'); ?> <input type="number" min="1" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[concurrent]" value="<?php echo esc_attr((string) $settings['concurrent']); ?>" /></label>
                            <label><?php esc_html_e('Crawl delay (s)', 'aifeed'); ?> <input type="number" min="0" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[crawl_delay_seconds]" value="<?php echo esc_attr((string) $settings['crawl_delay_seconds']); ?>" /></label>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><label for="aifeed-sitemap"><?php esc_html_e('Sitemap', 'aifeed'); ?></label></th>
                        <td>
                            <select id="aifeed-sitemap" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[sitemap]">
                                <option value="wp-sitemap.xml" <?php selected($settings['sitemap'], 'wp-sitemap.xml'); ?>>/wp-sitemap.xml</option>
                                <option value="sitemap.xml" <?php selected($settings['sitemap'], 'sitemap.xml'); ?>>/sitemap.xml</option>
                            </select>
                        </td>
                    </tr>
                    <tr>
                        <th scope="row"><?php esc_html_e('Extras', 'aifeed'); ?></th>
                        <td>
                            <label class="aifeed-check">
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[write_static]" value="1" <?php checked($settings['write_static'], 1); ?> />
                                <?php esc_html_e('Also write physical files into the WordPress root .well-known directory', 'aifeed'); ?>
                            </label>
                            <label class="aifeed-check">
                                <input type="checkbox" name="<?php echo esc_attr(self::OPTION_SETTINGS); ?>[badge_enabled]" value="1" <?php checked($settings['badge_enabled'], 1); ?> />
                                <?php esc_html_e('Enable the [aifeed_badge] shortcode', 'aifeed'); ?>
                            </label>
                        </td>
                    </tr>
                </table>
                <?php submit_button(__('Save settings', 'aifeed')); ?>
            </form>

            <div class="aifeed-card">
                <h2><?php esc_html_e('How it works', 'aifeed'); ?></h2>
                <ol>
                    <li><?php esc_html_e('Generate keys, then sign and publish: ai.json becomes available at /.well-known/ai.json.', 'aifeed'); ?></li>
                    <li><?php esc_html_e('Add the DNS TXT record shown above for strong (DNS-anchored) verification.', 'aifeed'); ?></li>
                    <li><?php esc_html_e('The plugin re-signs automatically every month so the declaration never expires.', 'aifeed'); ?></li>
                    <li><?php esc_html_e('Keep backups of this site database: the signing key lives in the options table.', 'aifeed'); ?></li>
                </ol>
            </div>
        </div>
        <?php
    }
}
