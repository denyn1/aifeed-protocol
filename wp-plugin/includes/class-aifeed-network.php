<?php
/**
 * Multisite network tools: apply profiles and re-sign every site in bulk.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Network
{
    public static function init()
    {
        if (!is_multisite()) {
            return;
        }
        add_action('network_admin_menu', array(__CLASS__, 'menu'));
        add_action('network_admin_edit_aifeed_network_apply', array(__CLASS__, 'handle_apply_all'));
    }

    public static function menu()
    {
        add_submenu_page(
            'settings.php',
            __('AIFeed Network', 'aifeed'),
            __('AIFeed', 'aifeed'),
            'manage_network_options',
            'aifeed-network',
            array(__CLASS__, 'render')
        );
    }

    public static function handle_apply_all()
    {
        if (!current_user_can('manage_network_options')) {
            wp_die(esc_html__('Insufficient permissions.', 'aifeed'));
        }
        check_admin_referer('aifeed_network_apply');
        $processed = self::apply_all();
        wp_safe_redirect(add_query_arg(
            array('page' => 'aifeed-network', 'aifeed_applied' => $processed),
            network_admin_url('settings.php')
        ));
        exit;
    }

    public static function apply_all()
    {
        $processed = 0;
        foreach (get_sites(array('number' => 0)) as $site) {
            switch_to_blog($site->blog_id);
            if (!class_exists('AIFeed_Keys')) {
                restore_current_blog();
                continue;
            }
            if (!AIFeed_Keys::has_keys()) {
                $generated = AIFeed_Keys::generate();
                if (is_wp_error($generated)) {
                    restore_current_blog();
                    continue;
                }
            }
            AIFeed_Mode::auto_profile();
            $signed = AIFeed_Signer::sign_and_store();
            if (!is_wp_error($signed)) {
                $processed++;
            }
            restore_current_blog();
        }
        return $processed;
    }

    public static function render()
    {
        if (!current_user_can('manage_network_options')) {
            return;
        }
        $sites = get_sites(array('number' => 0));
        $applied = isset($_GET['aifeed_applied']) ? (int) $_GET['aifeed_applied'] : -1;
        ?>
        <div class="wrap">
            <h1><?php esc_html_e('AIFeed Network', 'aifeed'); ?></h1>
            <?php if ($applied >= 0) : ?>
                <div class="notice notice-success is-dismissible"><p>
                    <?php echo esc_html(sprintf(__('Declarations applied and signed for %d site(s).', 'aifeed'), $applied)); ?>
                </p></div>
            <?php endif; ?>
            <p><?php esc_html_e('Bulk apply the detected profile (or the configured profile) and re-sign the declaration for every site in this network.', 'aifeed'); ?></p>
            <form method="post" action="<?php echo esc_url(network_admin_url('edit.php?action=aifeed_network_apply')); ?>">
                <?php wp_nonce_field('aifeed_network_apply'); ?>
                <table class="widefat striped">
                    <thead>
                        <tr>
                            <th><?php esc_html_e('Site', 'aifeed'); ?></th>
                            <th><?php esc_html_e('Domain', 'aifeed'); ?></th>
                            <th><?php esc_html_e('Mode', 'aifeed'); ?></th>
                            <th><?php esc_html_e('Profile', 'aifeed'); ?></th>
                            <th><?php esc_html_e('Signed', 'aifeed'); ?></th>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ($sites as $site) : ?>
                            <?php switch_to_blog($site->blog_id); ?>
                            <?php
                            $settings = AIFeed_Admin::get_settings();
                            $signed_at = AIFeed_Signer::get_signed_at();
                            ?>
                            <tr>
                                <td><?php echo esc_html(get_bloginfo('name')); ?></td>
                                <td><code><?php echo esc_html(AIFeed_Manifest::domain()); ?></code></td>
                                <td><?php echo esc_html($settings['mode']); ?></td>
                                <td><?php echo esc_html($settings['profile'] !== '' ? $settings['profile'] : '(auto-detected)'); ?></td>
                                <td><?php echo $signed_at !== '' ? esc_html($signed_at) : esc_html__('not yet', 'aifeed'); ?></td>
                            </tr>
                            <?php restore_current_blog(); ?>
                        <?php endforeach; ?>
                    </tbody>
                </table>
                <?php submit_button(__('Apply & sign all sites', 'aifeed'), 'primary', 'submit', true); ?>
            </form>
        </div>
        <?php
    }
}
