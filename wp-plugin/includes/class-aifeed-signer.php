<?php
/**
 * Signs the manifest and stores the served bytes.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Signer
{
    const OPTION_MANIFEST_JSON = 'aifeed_manifest_json';
    const OPTION_SIGNATURE_JSON = 'aifeed_signature_json';
    const OPTION_SIGNED_AT = 'aifeed_signed_at';
    const OPTION_LAST_ERROR = 'aifeed_last_error';

    public static function sign_and_store()
    {
        if (!AIFeed_Keys::sodium_available()) {
            return self::fail(__('PHP sodium extension is unavailable.', 'aifeed'), 'aifeed_sodium_missing');
        }
        if (!AIFeed_Keys::has_keys()) {
            return self::fail(__('Generate signing keys first.', 'aifeed'), 'aifeed_no_keys');
        }

        $settings = AIFeed_Admin::get_settings();
        if ($settings['mode'] === 'manual' && trim((string) $settings['custom_manifest_json']) !== '') {
            $decoded = json_decode((string) $settings['custom_manifest_json'], true);
            if (!is_array($decoded)) {
                return self::fail(__('Custom manifest JSON is not valid JSON.', 'aifeed'), 'aifeed_custom_json_invalid');
            }
            if (!isset($decoded['identity']) || !is_array($decoded['identity'])) {
                return self::fail(__('Custom manifest is missing the identity section.', 'aifeed'), 'aifeed_custom_manifest');
            }
            if (!isset($decoded['identity']['public_key']) || $decoded['identity']['public_key'] !== AIFeed_Keys::get_public_key()) {
                return self::fail(__('Custom manifest public_key must match this site\'s signing key.', 'aifeed'), 'aifeed_custom_pk_mismatch');
            }
            $decoded['validity'] = array(
                'signed_at' => gmdate('Y-m-d\TH:i:s\Z'),
                'expires_at' => gmdate('Y-m-d\TH:i:s\Z', time() + YEAR_IN_SECONDS),
            );
            $manifest = $decoded;
        } else {
            $manifest = AIFeed_Manifest::build();
        }
        $manifest_errors = AIFeed_Manifest::validate($manifest);
        if (!empty($manifest_errors)) {
            return self::fail(implode('; ', $manifest_errors), 'aifeed_manifest_invalid');
        }

        $manifest_json = wp_json_encode($manifest, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($manifest_json)) {
            return self::fail(__('Failed to encode manifest JSON.', 'aifeed'), 'aifeed_encode_failed');
        }

        try {
            $canonical = AIFeed_JCS::encode($manifest);
        } catch (AIFeed_JCS_Exception $exception) {
            return self::fail($exception->getMessage(), 'aifeed_jcs_' . $exception->code_name);
        }

        $prefix = strpos((string) $manifest['version'], '0.2') === 0 ? "aifeed.v0.2\n" : "aifeed.v0.1\n";
        $message = $prefix . $canonical;
        $signature = AIFeed_Keys::sign($message);
        if (is_wp_error($signature)) {
            return self::fail($signature->get_error_message(), $signature->get_error_code());
        }

        $public_raw = AIFeed_Keys::public_key_raw();
        if (is_wp_error($public_raw)) {
            return self::fail($public_raw->get_error_message(), $public_raw->get_error_code());
        }

        if (!sodium_crypto_sign_verify_detached($signature, $message, $public_raw)) {
            return self::fail(__('Self-verification failed; output not written.', 'aifeed'), 'aifeed_self_verify');
        }

        $container = array(
            'algorithm' => 'ed25519',
            'canonicalization' => 'jcs-rfc8785',
            'signature' => 'base64url:' . AIFeed_Keys::base64url($signature),
            'raw_digest' => array(
                'sha-256' => base64_encode(hash('sha256', $manifest_json, true)),
                'applies_to' => 'raw-bytes',
            ),
        );
        $signature_json = wp_json_encode($container, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        if (!is_string($signature_json)) {
            return self::fail(__('Failed to encode signature JSON.', 'aifeed'), 'aifeed_encode_failed');
        }

        update_option(self::OPTION_MANIFEST_JSON, $manifest_json, false);
        update_option(self::OPTION_SIGNATURE_JSON, $signature_json, false);
        update_option(self::OPTION_SIGNED_AT, gmdate('Y-m-d\TH:i:s\Z'), false);
        delete_option(self::OPTION_LAST_ERROR);

        self::maybe_write_static($manifest_json, $signature_json);
        return true;
    }

    public static function maybe_write_static($manifest_json, $signature_json)
    {
        $settings = AIFeed_Admin::get_settings();
        if (empty($settings['write_static'])) {
            return true;
        }
        $dir = trailingslashit(ABSPATH) . '.well-known';
        if (!file_exists($dir) && !wp_mkdir_p($dir)) {
            update_option(self::OPTION_LAST_ERROR, 'cannot create .well-known directory', false);
            return false;
        }
        $manifest_ok = @file_put_contents($dir . '/ai.json', $manifest_json);
        $signature_ok = @file_put_contents($dir . '/ai-signature.json', $signature_json);
        if ($manifest_ok === false || $signature_ok === false) {
            update_option(self::OPTION_LAST_ERROR, 'cannot write .well-known files', false);
            return false;
        }
        return true;
    }

    public static function get_manifest_json()
    {
        $stored = get_option(self::OPTION_MANIFEST_JSON, '');
        return is_string($stored) ? $stored : '';
    }

    public static function get_signature_json()
    {
        $stored = get_option(self::OPTION_SIGNATURE_JSON, '');
        return is_string($stored) ? $stored : '';
    }

    public static function get_signed_at()
    {
        $stored = get_option(self::OPTION_SIGNED_AT, '');
        return is_string($stored) ? $stored : '';
    }

    public static function get_last_error()
    {
        $stored = get_option(self::OPTION_LAST_ERROR, '');
        return is_string($stored) ? $stored : '';
    }

    private static function fail($message, $code)
    {
        update_option(self::OPTION_LAST_ERROR, $message, false);
        return new WP_Error($code, $message);
    }
}
