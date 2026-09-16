<?php
/**
 * Builds and validates the AIFeed manifest from WordPress site data.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Manifest
{
    const TYPES = array(
        'ecommerce', 'news', 'education', 'government', 'saas', 'portfolio',
        'community', 'docs', 'nonprofit', 'personal', 'blog', 'media',
        'marketplace', 'other',
    );

    const USAGE_KEYS = array(
        'search', 'retrieval', 'input', 'training', 'quote',
        'summarize', 'reproduce', 'translate', 'modify', 'embed', 'commercial_use',
    );

    public static function domain()
    {
        $host = wp_parse_url(home_url(), PHP_URL_HOST);
        if (!is_string($host) || $host === '') {
            return '';
        }
        return strtolower(rtrim($host, '.'));
    }

    public static function locale()
    {
        $locale = str_replace('_', '-', get_locale());
        if (preg_match('#^[a-z]{2,3}(-[A-Z][a-zA-Z]{0,7})?$#', $locale)) {
            return $locale;
        }
        return 'en';
    }

    public static function language()
    {
        $parts = explode('-', self::locale());
        return strtolower($parts[0]);
    }

    public static function contact($configured)
    {
        if (is_string($configured) && $configured !== '') {
            $contact = $configured;
            if (strpos($contact, 'mailto:') !== 0 && strpos($contact, 'https://') !== 0) {
                $contact = 'mailto:' . $contact;
            }
            return $contact;
        }
        // Privacy-first default: never publish the admin email implicitly.
        // Site operators may still configure an explicit mailto:/https:// contact.
        $home = function_exists('home_url') ? home_url('/') : ('https://' . self::domain() . '/');
        if (strpos($home, 'https://') !== 0) {
            $home = 'https://' . self::domain() . '/';
        }
        return $home;
    }

    public static function build()
    {
        $settings = AIFeed_Admin::get_settings();
        $domain = self::domain();
        $now = gmdate('Y-m-d\TH:i:s\Z');

        $usage = array();
        $allowed = is_array($settings['usage_allowed']) ? $settings['usage_allowed'] : array();
        foreach (self::USAGE_KEYS as $key) {
            $usage[$key] = in_array($key, $allowed, true) ? 'allow' : 'deny';
        }

        $identity = array(
            'domain' => $domain,
            'name' => wp_strip_all_tags(get_bloginfo('name')) !== '' ? wp_strip_all_tags(get_bloginfo('name')) : $domain,
            'type' => in_array($settings['type'], self::TYPES, true) ? $settings['type'] : 'other',
            'locale' => self::locale(),
            'contact' => self::contact($settings['contact']),
            'public_key' => AIFeed_Keys::get_public_key(),
            'key_id' => AIFeed_Keys::get_key_id(),
            'signature_url' => '/.well-known/ai-signature.json',
        );

        $organization = trim((string) $settings['organization']);
        if ($organization !== '') {
            $identity['organization'] = $organization;
        }

        $permissions = array(
            'default' => 'deny',
            'usage' => $usage,
            'attribution' => in_array($settings['attribution'], array('required', 'optional', 'none'), true)
                ? $settings['attribution'] : 'required',
        );
        if ($settings['attribution_url'] !== '') {
            $permissions['attribution_url'] = esc_url_raw($settings['attribution_url']);
        }
        if ($settings['attribution_text'] !== '') {
            $permissions['attribution_text'] = wp_strip_all_tags($settings['attribution_text']);
        }

        $content = array(
            'llms_txt' => '/llms.txt',
            'sitemap' => $settings['sitemap'] === 'sitemap.xml' ? '/sitemap.xml' : '/wp-sitemap.xml',
            'languages' => array(self::language()),
        );
        if (class_exists('AIFeed_Mako') && AIFeed_Mako::enabled()) {
            $dual = AIFeed_Mako::dual_stack();
            $content['profile'] = $dual ? 'both' : 'aifeed-md';
            $content['index_url'] = AIFeed_Mako::AIMD_INDEX_PATH;
            if ($dual) {
                $content['mako'] = array(
                    'index_url' => AIFeed_Mako::INDEX_PATH,
                    'signature' => AIFeed_Keys::sodium_available() && AIFeed_Keys::has_keys() ? 'required' : 'optional',
                    'overrides' => 'restrict-only',
                );
            }
        }

        $manifest = array(
            'version' => '0.2',
            'identity' => $identity,
            'validity' => array(
                'signed_at' => $now,
                'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + YEAR_IN_SECONDS),
            ),
            'content' => $content,
            'permissions' => $permissions,
            'limits' => array(
                'requests_per_minute' => (int) $settings['requests_per_minute'],
                'concurrent' => (int) $settings['concurrent'],
                'crawl_delay_seconds' => (int) $settings['crawl_delay_seconds'],
            ),
            'revocation' => array(
                'list_url' => 'https://aifeed.md/revoke/v1/' . $domain . '.json',
                'maximum_check_interval_hours' => 24,
            ),
            'metadata' => array(
                'generated_at' => $now,
                'generated_by' => 'aifeed-wp-plugin/' . AIFEED_VERSION,
            ),
        );

        return apply_filters('aifeed_manifest', $manifest);
    }

    public static function validate($manifest)
    {
        $errors = array();

        foreach (array('version', 'identity', 'validity', 'content', 'permissions', 'revocation', 'metadata') as $key) {
            if (!isset($manifest[$key])) {
                $errors[] = 'missing required section: ' . $key;
            }
        }
        if (!empty($errors)) {
            return $errors;
        }

        if (!preg_match('#^0\.[12](\.[0-9]+)?$#', (string) $manifest['version'])) {
            $errors[] = 'version must be 0.1.x or 0.2.x';
        }
        if (strpos((string) $manifest['version'], '0.2') === 0 && isset($manifest['content']['profile'])) {
            if (!in_array($manifest['content']['profile'], array('mako', 'aifeed-md', 'both'), true)) {
                $errors[] = 'content.profile must be mako, aifeed-md, or both';
            }
        }
        if (strpos((string) $manifest['version'], '0.2') === 0 && isset($manifest['content']['index_url'])) {
            if (strpos((string) $manifest['content']['index_url'], '/') !== 0) {
                $errors[] = 'content.index_url must be a path';
            }
        }
        if (strpos((string) $manifest['version'], '0.2') === 0 && isset($manifest['content']['mako'])) {
            $mako = $manifest['content']['mako'];
            if (!is_array($mako)) {
                $errors[] = 'content.mako must be an object';
            } else {
                foreach ($mako as $key => $value) {
                    if (strpos($key, 'x_') === 0) {
                        continue;
                    }
                    if (!in_array($key, array('index_url', 'signature', 'overrides', 'embedding'), true)) {
                        $errors[] = 'unknown content.mako property: ' . $key;
                    }
                }
                if (isset($mako['index_url']) && strpos((string) $mako['index_url'], '/') !== 0) {
                    $errors[] = 'content.mako.index_url must be a path';
                }
                if (isset($mako['signature']) && !in_array($mako['signature'], array('required', 'optional'), true)) {
                    $errors[] = 'content.mako.signature must be required or optional';
                }
                if (isset($mako['overrides']) && !in_array($mako['overrides'], array('restrict-only', 'bidirectional'), true)) {
                    $errors[] = 'content.mako.overrides must be restrict-only or bidirectional';
                }
            }
        }

        $identity = $manifest['identity'];
        if (!preg_match('#^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$#', (string) $identity['domain'])) {
            $errors[] = 'identity.domain must be a lowercase hostname';
        }
        if (!in_array($identity['type'], self::TYPES, true)) {
            $errors[] = 'identity.type is not in the allowed enum';
        }
        if (!preg_match('#^[a-z]{2,3}(-[A-Z][a-zA-Z]{0,7})?$#', (string) $identity['locale'])) {
            $errors[] = 'identity.locale must be a BCP 47 tag';
        }
        if (!preg_match('#^(mailto:|https://)\S+$#', (string) $identity['contact'])) {
            $errors[] = 'identity.contact must be mailto: or https://';
        }
        if (!preg_match('#^ed25519:[A-Za-z0-9+/]{59}=$#', (string) $identity['public_key'])) {
            $errors[] = 'identity.public_key must be SPKI DER base64 with the ed25519: prefix';
        }
        if (strpos((string) $identity['signature_url'], '/') !== 0) {
            $errors[] = 'identity.signature_url must be a path starting with /';
        }

        $permissions = $manifest['permissions'];
        if (!in_array($permissions['default'], array('allow', 'deny'), true)) {
            $errors[] = 'permissions.default must be allow or deny';
        }
        if (!in_array($permissions['attribution'], array('required', 'optional', 'none'), true)) {
            $errors[] = 'permissions.attribution is invalid';
        }
        foreach ($permissions['usage'] as $key => $value) {
            if (!in_array($value, array('allow', 'deny'), true)) {
                $errors[] = 'permissions.usage.' . $key . ' must be allow or deny';
            }
        }

        $revocation = $manifest['revocation'];
        if (!preg_match('#^https://aifeed\.md/revoke/v1/#', (string) $revocation['list_url'])) {
            $errors[] = 'revocation.list_url must be the canonical aifeed.md URL';
        }

        if (strpos((string) $manifest['version'], '0.2') === 0 && isset($manifest['rotation'])) {
            $errors = array_merge($errors, self::validate_rotation($manifest['rotation']));
        }

        return $errors;
    }

    private static function validate_rotation($rotation)
    {
        $errors = array();
        if (!is_array($rotation)) {
            return array('rotation must be an object');
        }
        foreach ($rotation as $key => $value) {
            if (strpos($key, 'x_') === 0) {
                continue;
            }
            if (!in_array($key, array('successor_fp', 'predecessor_fp', 'effective_at', 'grace_until', 'supersedes_at'), true)) {
                $errors[] = 'unknown rotation property: ' . $key;
            }
        }
        $successor = isset($rotation['successor_fp']) ? $rotation['successor_fp'] : null;
        $predecessor = isset($rotation['predecessor_fp']) ? $rotation['predecessor_fp'] : null;
        if ($successor !== null && $predecessor !== null) {
            $errors[] = 'rotation must not carry successor_fp and predecessor_fp together';
        } elseif ($successor === null && $predecessor === null) {
            $errors[] = 'rotation requires successor_fp or predecessor_fp';
        } elseif ($successor !== null) {
            if (!preg_match('#^sha256:[A-Za-z0-9_-]{43}$#', (string) $successor)) {
                $errors[] = 'rotation.successor_fp must be a sha256 fingerprint';
            }
            if (!isset($rotation['effective_at']) || !isset($rotation['grace_until'])) {
                $errors[] = 'successor_fp requires effective_at and grace_until';
            } else {
                $effective = strtotime((string) $rotation['effective_at']);
                $grace = strtotime((string) $rotation['grace_until']);
                if ($effective === false || $grace === false) {
                    $errors[] = 'rotation timestamps must be UTC instants';
                } elseif ($grace - $effective < 3600) {
                    $errors[] = 'grace_until must exceed effective_at by at least 1 hour';
                }
            }
        } else {
            if (!preg_match('#^sha256:[A-Za-z0-9_-]{43}$#', (string) $predecessor)) {
                $errors[] = 'rotation.predecessor_fp must be a sha256 fingerprint';
            }
            if (!isset($rotation['supersedes_at'])) {
                $errors[] = 'predecessor_fp requires supersedes_at';
            }
        }
        return $errors;
    }
}
