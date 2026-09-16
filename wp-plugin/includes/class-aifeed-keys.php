<?php
/**
 * Ed25519 key management for AIFeed (SPKI DER encoding, base64url fingerprints).
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Keys
{
    const OPTION_SECRET = 'aifeed_secret_key';
    const OPTION_PUBLIC = 'aifeed_public_key';
    const OPTION_FINGERPRINT = 'aifeed_fingerprint';
    const OPTION_KEY_ID = 'aifeed_key_id';
    const SPKI_PREFIX_HEX = '302a300506032b6570032100';

    public static function sodium_available()
    {
        return function_exists('sodium_crypto_sign_detached')
            && function_exists('sodium_crypto_sign_verify_detached')
            && function_exists('sodium_crypto_sign_keypair');
    }

    public static function has_keys()
    {
        return self::get_secret_key() !== '' && self::get_public_key() !== '';
    }

    public static function get_secret_key()
    {
        if (defined('AIFEED_SECRET_KEY') && AIFEED_SECRET_KEY) {
            return (string) AIFEED_SECRET_KEY;
        }
        $stored = get_option(self::OPTION_SECRET, '');
        return is_string($stored) ? $stored : '';
    }

    public static function get_public_key()
    {
        $stored = get_option(self::OPTION_PUBLIC, '');
        return is_string($stored) ? $stored : '';
    }

    public static function get_fingerprint()
    {
        $stored = get_option(self::OPTION_FINGERPRINT, '');
        return is_string($stored) ? $stored : '';
    }

    public static function get_key_id()
    {
        $stored = get_option(self::OPTION_KEY_ID, '');
        return is_string($stored) ? $stored : '';
    }

    public static function generate($key_id = '')
    {
        if (!self::sodium_available()) {
            return new WP_Error(
                'aifeed_sodium_missing',
                __('PHP sodium extension is required to generate signing keys.', 'aifeed')
            );
        }
        $keypair = sodium_crypto_sign_keypair();
        $secret = sodium_crypto_sign_secretkey($keypair);
        $public = sodium_crypto_sign_publickey($keypair);
        $der = hex2bin(self::SPKI_PREFIX_HEX) . $public;
        $public_value = 'ed25519:' . base64_encode($der);
        $fingerprint = 'sha256:' . self::base64url(hash('sha256', $der, true));
        if ($key_id === '') {
            $key_id = 'aifeed-' . gmdate('Y') . '-key1';
        }
        update_option(self::OPTION_SECRET, base64_encode($secret), false);
        update_option(self::OPTION_PUBLIC, $public_value, false);
        update_option(self::OPTION_FINGERPRINT, $fingerprint, false);
        update_option(self::OPTION_KEY_ID, $key_id, false);
        return array(
            'public_key' => $public_value,
            'fingerprint' => $fingerprint,
            'key_id' => $key_id,
        );
    }

    public static function public_key_raw($public_value = null)
    {
        if ($public_value === null) {
            $public_value = self::get_public_key();
        }
        if (!preg_match('#^ed25519:([A-Za-z0-9+/]{59}=)$#', (string) $public_value, $matches)) {
            return new WP_Error('aifeed_pk_format', __('Invalid public key encoding.', 'aifeed'));
        }
        $der = base64_decode($matches[1], true);
        if ($der === false || strlen($der) !== 44) {
            return new WP_Error('aifeed_pk_format', __('Invalid SPKI DER structure.', 'aifeed'));
        }
        return substr($der, 12);
    }

    public static function sign($message)
    {
        if (!self::sodium_available()) {
            return new WP_Error('aifeed_sodium_missing', __('PHP sodium extension is required for signing.', 'aifeed'));
        }
        $secret_b64 = self::get_secret_key();
        if ($secret_b64 === '') {
            return new WP_Error('aifeed_no_keys', __('No signing key configured.', 'aifeed'));
        }
        $secret = base64_decode($secret_b64, true);
        if ($secret === false || strlen($secret) !== SODIUM_CRYPTO_SIGN_SECRETKEYBYTES) {
            return new WP_Error('aifeed_secret_invalid', __('Stored signing key is invalid or corrupted.', 'aifeed'));
        }
        return sodium_crypto_sign_detached($message, $secret);
    }

    public static function base64url($bytes)
    {
        return rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=');
    }

    public static function delete_keys()
    {
        delete_option(self::OPTION_SECRET);
        delete_option(self::OPTION_PUBLIC);
        delete_option(self::OPTION_FINGERPRINT);
        delete_option(self::OPTION_KEY_ID);
    }
}
