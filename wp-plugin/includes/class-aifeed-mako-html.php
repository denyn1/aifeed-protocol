<?php
/**
 * Minimal, dependency-free HTML to Markdown conversion for MAKO documents.
 *
 * @package AIFeed
 */

if (!defined('ABSPATH')) {
    exit;
}

class AIFeed_Mako_Html
{
    const MAKO_TYPES = array('product', 'article', 'docs', 'landing', 'profile', 'listing', 'event', 'recipe', 'faq', 'custom');

    public static function convert($html)
    {
        $out = (string) $html;
        $out = preg_replace('/<!--.*?-->/s', ' ', $out);
        foreach (array('script', 'style', 'noscript', 'svg', 'template', 'iframe', 'head', 'nav', 'footer', 'aside', 'form', 'button', 'select', 'option') as $tag) {
            $out = preg_replace('#<' . $tag . '\b[^>]*>.*?</' . $tag . '>#is', ' ', $out);
            $out = preg_replace('#<' . $tag . '\b[^>]*/?>#is', ' ', $out);
        }

        $out = preg_replace_callback('#<pre\b[^>]*>\s*<code\b[^>]*>(.*?)</code>\s*</pre>#is', function ($matches) {
            $code = html_entity_decode(strip_tags($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            return "\n```\n" . rtrim($code) . "\n```\n\n";
        }, $out);
        $out = preg_replace_callback('#<pre\b[^>]*>(.*?)</pre>#is', function ($matches) {
            $code = html_entity_decode(strip_tags($matches[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8');
            return "\n```\n" . rtrim($code) . "\n```\n\n";
        }, $out);

        for ($level = 1; $level <= 6; $level++) {
            $out = preg_replace_callback('#<h' . $level . '\b[^>]*>(.*?)</h' . $level . '>#is', function ($matches) use ($level) {
                $text = self::inline_text($matches[1]);
                return $text === '' ? '' : "\n" . str_repeat('#', $level) . ' ' . $text . "\n\n";
            }, $out);
        }

        $out = preg_replace_callback('#<li\b[^>]*>(.*?)</li>#is', function ($matches) {
            $text = self::inline_text($matches[1]);
            return $text === '' ? '' : '- ' . $text . "\n";
        }, $out);
        $out = preg_replace('#</?(ul|ol)\b[^>]*>#i', "\n", $out);

        $out = preg_replace_callback('#<blockquote\b[^>]*>(.*?)</blockquote>#is', function ($matches) {
            $text = self::inline_text($matches[1]);
            return $text === '' ? '' : "\n> " . $text . "\n\n";
        }, $out);

        $out = preg_replace('#</?(p|div|section|header|article|main|figure|figcaption|table|thead|tbody|tr)\b[^>]*>#i', "\n\n", $out);
        $out = preg_replace('#</?(td|th)\b[^>]*>#i', ' | ', $out);
        $out = preg_replace('#<hr\b[^>]*/?>#i', "\n\n---\n\n", $out);
        $out = preg_replace('#<br\b[^>]*/?>#i', "\n", $out);

        $out = preg_replace('#<(strong|b)\b[^>]*>(.*?)</\1>#is', '**$2**', $out);
        $out = preg_replace('#<(em|i)\b[^>]*>(.*?)</\1>#is', '*$2*', $out);
        $out = preg_replace('#<code\b[^>]*>(.*?)</code>#is', '`$1`', $out);

        $out = preg_replace_callback('#<a\b[^>]*href=["\']([^"\']*)["\'][^>]*>(.*?)</a>#is', function ($matches) {
            $text = self::inline_text($matches[2]);
            if ($text === '') {
                return '';
            }
            return '[' . $text . '](' . trim($matches[1]) . ')';
        }, $out);
        $out = preg_replace_callback('#<img\b[^>]*>#is', function ($matches) {
            if (!preg_match('#src=["\']([^"\']+)["\']#i', $matches[0], $src)) {
                return '';
            }
            $alt = '';
            if (preg_match('#alt=["\']([^"\']*)["\']#i', $matches[0], $altMatch)) {
                $alt = trim($altMatch[1]);
            }
            return '![' . $alt . '](' . trim($src[1]) . ')';
        }, $out);

        $out = strip_tags($out);
        $out = html_entity_decode($out, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $out = preg_replace('/[ \t]+\n/', "\n", $out);
        $out = preg_replace('/\n{3,}/', "\n\n", $out);
        $out = preg_replace('/[ \t]{2,}/', ' ', $out);
        $out = preg_replace('/\n +/', "\n", $out);
        return trim($out);
    }

    public static function inline_text($html)
    {
        $text = strip_tags((string) $html);
        $text = html_entity_decode($text, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $text = preg_replace('/\s+/u', ' ', $text);
        return trim($text);
    }

    public static function classify_asset($url)
    {
        $clean = preg_replace('/[#?].*$/', '', (string) $url);
        if (!preg_match('/\.([A-Za-z0-9]{1,8})$/', $clean, $matches)) {
            return null;
        }
        $extension = strtolower($matches[1]);
        if (in_array($extension, array('jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'tiff'), true)) {
            return 'image';
        }
        if (in_array($extension, array('mp4', 'webm', 'mov', 'mkv', 'avi', 'm4v', 'm3u8'), true)) {
            return 'video';
        }
        if (in_array($extension, array('mp3', 'wav', 'ogg', 'oga', 'm4a', 'aac', 'flac'), true)) {
            return 'audio';
        }
        if (in_array($extension, array('pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'csv', 'xls', 'xlsx', 'ppt', 'pptx', 'epub'), true)) {
            return 'document';
        }
        if (in_array($extension, array('zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2'), true)) {
            return 'archive';
        }
        return null;
    }

    public static function extract_assets($html)
    {
        $assets = array();
        $seen = array();
        $push = function ($url, $type, $title = '', $alt = '') use (&$assets, &$seen) {
            $value = trim((string) $url);
            if ($value === '' || strpos($value, 'javascript:') === 0 || strpos($value, 'data:') === 0) {
                return;
            }
            $key = $value . '|' . $type;
            if (isset($seen[$key])) {
                return;
            }
            $seen[$key] = true;
            $asset = array('url' => $value, 'type' => $type);
            if ($title !== '') {
                $asset['title'] = mb_substr($title, 0, 500);
            }
            if ($alt !== '') {
                $asset['alt'] = mb_substr($alt, 0, 500);
            }
            $assets[] = $asset;
        };

        if (preg_match_all('/<img\b[^>]*>/i', (string) $html, $images)) {
            foreach ($images[0] as $tag) {
                if (!preg_match('/\bsrc=["\']([^"\']+)["\']/i', $tag, $src)) {
                    continue;
                }
                $alt = '';
                if (preg_match('/\balt=["\']([^"\']*)["\']/i', $tag, $altMatch)) {
                    $alt = $altMatch[1];
                }
                $push($src[1], 'image', $alt, $alt);
            }
        }
        foreach (array('video' => 'video', 'audio' => 'audio') as $tag => $fallback) {
            if (!preg_match_all('#<' . $tag . '\b[^>]*>.*?</' . $tag . '>|<' . $tag . '\b[^>]*/?>#is', (string) $html, $blocks)) {
                continue;
            }
            foreach ($blocks[0] as $block) {
                if (preg_match('#<' . $tag . '\b[^>]*\bsrc=["\']([^"\']+)["\']#i', $block, $src)) {
                    $push($src[1], self::classify_asset($src[1]) ?: $fallback, ucfirst($fallback), '');
                }
                if (preg_match_all('/<source\b[^>]*\bsrc=["\']([^"\']+)["\']/i', $block, $sources)) {
                    foreach ($sources[1] as $sourceUrl) {
                        $push($sourceUrl, self::classify_asset($sourceUrl) ?: $fallback, ucfirst($fallback), '');
                    }
                }
            }
        }
        if (preg_match_all('#<a\b[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)</a>#is', (string) $html, $links, PREG_SET_ORDER)) {
            foreach ($links as $link) {
                $type = self::classify_asset($link[1]);
                if ($type === null && preg_match('/\bdownload\b/i', $link[0])) {
                    $type = 'file';
                }
                if ($type === null) {
                    continue;
                }
                $text = self::inline_text($link[2]);
                $push($link[1], $type, $text !== '' ? $text : $link[1], $text);
            }
        }
        if (preg_match_all('#<(?:embed|object)\b[^>]*\b(?:src|data)=["\']([^"\']+)["\']#i', (string) $html, $objects)) {
            foreach ($objects[1] as $objectUrl) {
                $push($objectUrl, self::classify_asset($objectUrl) ?: 'file', 'Embed', '');
            }
        }
        return array_slice($assets, 0, 100);
    }

    public static function assets_section($assets)
    {
        if (empty($assets)) {
            return '';
        }
        $lines = array();
        foreach (array_slice($assets, 0, 25) as $asset) {
            $label = isset($asset['title']) && $asset['title'] !== '' ? $asset['title'] : $asset['url'];
            $lines[] = '- [' . $label . '](' . $asset['url'] . ') ' . "\u{2014}" . ' ' . $asset['type'];
        }
        return "\n## Media & Unduhan\n\n" . implode("\n", $lines) . "\n";
    }

    public static function estimate_tokens($text)
    {
        $words = preg_split('/\s+/u', trim((string) $text), -1, PREG_SPLIT_NO_EMPTY);
        $count = is_array($words) ? count($words) : 0;
        return max(1, (int) ceil($count * 1.33));
    }

    public static function truncate_to_tokens($text, $max_tokens)
    {
        $words = preg_split('/\s+/u', trim((string) $text), -1, PREG_SPLIT_NO_EMPTY);
        $max_words = (int) floor($max_tokens / 1.33);
        if (!is_array($words) || count($words) <= $max_words) {
            return array('text' => $text, 'truncated' => false);
        }
        $cut = implode(' ', array_slice($words, 0, $max_words));
        $last = max((int) mb_strrpos($cut, '. '), (int) mb_strrpos($cut, '! '), (int) mb_strrpos($cut, '? '));
        if ($last > mb_strlen($cut) * 0.5) {
            $cut = mb_substr($cut, 0, $last + 1);
        }
        return array('text' => $cut . "\u{2026}", 'truncated' => true);
    }

    public static function yaml_scalar($value)
    {
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_bool($value)) {
            return $value ? 'true' : 'false';
        }
        $encoded = wp_json_encode((string) $value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        return is_string($encoded) ? $encoded : '""';
    }

    public static function render_yaml($value, $indent = 0)
    {
        $pad = str_repeat(' ', $indent);
        $lines = array();
        if (is_array($value) && self::is_list($value)) {
            foreach ($value as $item) {
                if (is_array($item) && !self::is_list($item)) {
                    $entries = array();
                    foreach ($item as $key => $entry) {
                        if ($entry !== null) {
                            $entries[$key] = $entry;
                        }
                    }
                    if (empty($entries)) {
                        continue;
                    }
                    $keys = array_keys($entries);
                    $first_key = $keys[0];
                    if (is_array($entries[$first_key])) {
                        $lines[] = $pad . '- ' . $first_key . ':';
                        $lines[] = self::render_yaml($entries[$first_key], $indent + 4);
                    } else {
                        $lines[] = $pad . '- ' . $first_key . ': ' . self::yaml_scalar($entries[$first_key]);
                    }
                    for ($index = 1; $index < count($keys); $index++) {
                        $key = $keys[$index];
                        if (is_array($entries[$key])) {
                            $lines[] = $pad . '  ' . $key . ':';
                            $lines[] = self::render_yaml($entries[$key], $indent + 4);
                        } else {
                            $lines[] = $pad . '  ' . $key . ': ' . self::yaml_scalar($entries[$key]);
                        }
                    }
                } elseif (is_array($item)) {
                    $lines[] = $pad . '-';
                    $lines[] = self::render_yaml($item, $indent + 2);
                } else {
                    $lines[] = $pad . '- ' . self::yaml_scalar($item);
                }
            }
            return implode("\n", $lines);
        }
        foreach ($value as $key => $entry) {
            if ($entry === null) {
                continue;
            }
            if (is_array($entry)) {
                $nested = self::render_yaml($entry, $indent + 2);
                if (trim($nested) === '') {
                    continue;
                }
                $lines[] = $pad . $key . ':';
                $lines[] = $nested;
            } else {
                $lines[] = $pad . $key . ': ' . self::yaml_scalar($entry);
            }
        }
        return implode("\n", $lines);
    }

    private static function is_list($value)
    {
        if (!is_array($value)) {
            return false;
        }
        return array_keys($value) === range(0, count($value) - 1);
    }
}
