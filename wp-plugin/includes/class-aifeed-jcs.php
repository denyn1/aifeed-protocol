<?php
/**
 * JCS (RFC 8785) canonicalization for AIFeed manifests.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_JCS_Exception extends Exception
{
    /** @var string */
    public $code_name;

    public function __construct($code_name, $message)
    {
        parent::__construct($message);
        $this->code_name = $code_name;
    }
}

class AIFeed_JCS
{
    public static function encode($value)
    {
        return self::encode_value($value);
    }

    private static function encode_value($value)
    {
        if ($value === null) {
            return 'null';
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            throw new AIFeed_JCS_Exception('float_not_allowed', 'floating point numbers are not allowed in AIFeed JSON');
        }
        if (is_string($value)) {
            return self::encode_string($value);
        }
        if (is_array($value)) {
            if (self::is_list($value)) {
                $parts = array();
                foreach ($value as $item) {
                    $parts[] = self::encode_value($item);
                }
                return '[' . implode(',', $parts) . ']';
            }
            $keys = array_keys($value);
            usort($keys, array('AIFeed_JCS', 'compare_keys'));
            $parts = array();
            foreach ($keys as $key) {
                $parts[] = self::encode_string((string) $key) . ':' . self::encode_value($value[$key]);
            }
            return '{' . implode(',', $parts) . '}';
        }
        throw new AIFeed_JCS_Exception('unsupported_type', 'unsupported value type in AIFeed JSON');
    }

    private static function is_list($value)
    {
        $index = 0;
        foreach ($value as $key => $unused) {
            if ($key !== $index) {
                return false;
            }
            $index++;
        }
        return true;
    }

    public static function compare_keys($a, $b)
    {
        if ($a === $b) {
            return 0;
        }
        if (function_exists('mb_convert_encoding')) {
            $ua = mb_convert_encoding((string) $a, 'UTF-16BE', 'UTF-8');
            $ub = mb_convert_encoding((string) $b, 'UTF-16BE', 'UTF-8');
            if ($ua !== false && $ub !== false) {
                return strcmp($ua, $ub);
            }
        }
        return strcmp((string) $a, (string) $b);
    }

    private static function encode_string($value)
    {
        $out = '"';
        $length = strlen($value);
        for ($i = 0; $i < $length; $i++) {
            $char = $value[$i];
            $ord = ord($char);
            if ($char === '"') {
                $out .= '\\"';
                continue;
            }
            if ($char === '\\') {
                $out .= '\\\\';
                continue;
            }
            if ($char === "\x08") {
                $out .= '\\b';
                continue;
            }
            if ($char === "\x0c") {
                $out .= '\\f';
                continue;
            }
            if ($char === "\n") {
                $out .= '\\n';
                continue;
            }
            if ($char === "\r") {
                $out .= '\\r';
                continue;
            }
            if ($char === "\t") {
                $out .= '\\t';
                continue;
            }
            if ($ord < 0x20) {
                $out .= sprintf('\\u%04x', $ord);
                continue;
            }
            $out .= $char;
        }
        return $out . '"';
    }
}
