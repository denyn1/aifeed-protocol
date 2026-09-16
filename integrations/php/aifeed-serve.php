<?php
/**
 * AIFeed server integration for plain PHP (no WordPress required).
 *
 * Usage (front controller / router):
 *   require __DIR__ . '/aifeed-serve.php';
 *   if (aifeed_serve(__DIR__ . '/public', ['mako' => true])) {
 *       exit; // served by AIFeed (manifest, index, AIFeed Markdown, llms.txt)
 *   }
 *   // ... your normal application ...
 *
 * Works with PHP 7.2+; no dependencies.
 */

if (!function_exists('aifeed_serve')) {
    function aifeed_parse_frontmatter_fields($text)
    {
        $fields = array();
        if (!preg_match('#^---\r?\n(.*?)\r?\n---#s', $text, $match)) {
            return $fields;
        }
        foreach (preg_split('/\r?\n/', $match[1]) as $line) {
            if (!preg_match('#^([A-Za-z0-9_-]+):\s*(.*)$#', trim($line), $kv)) {
                continue;
            }
            $key = $kv[1];
            $value = trim(preg_replace('/\s+#.*$/', '', $kv[2]));
            if (strlen($value) >= 2 && $value[0] === '"' && substr($value, -1) === '"') {
                $value = substr($value, 1, -1);
            }
            if ($key === 'tokens') {
                $fields['tokens'] = (int) $value;
            } elseif (in_array($key, array('type', 'language', 'aimd', 'mako'), true)) {
                $fields[$key] = $value;
            }
        }
        return $fields;
    }

    function aifeed_safe_join($root, $relative)
    {
        $target = realpath($root . DIRECTORY_SEPARATOR . $relative);
        $base = realpath($root);
        if ($target === false || $base === false) {
            return null;
        }
        if ($target !== $base && strpos($target, $base . DIRECTORY_SEPARATOR) !== 0) {
            return null;
        }
        return $target;
    }

    function aifeed_send_file($filePath, $contentType, $cacheSeconds = 3600)
    {
        if (!is_file($filePath)) {
            return false;
        }
        header('Content-Type: ' . $contentType);
        header('Cache-Control: public, max-age=' . (int) $cacheSeconds . ', must-revalidate');
        http_response_code(200);
        if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'HEAD') {
            readfile($filePath);
        }
        return true;
    }

    function aifeed_serve($root, $options = array())
    {
        $root = rtrim($root, '/\\');
        $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
        if ($method !== 'GET' && $method !== 'HEAD') {
            return false;
        }
        $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        if (!is_string($path)) {
            return false;
        }

        $aimd = !isset($options['aimd']) || $options['aimd'];
        $mako = !empty($options['mako']);
        $wellKnown = array(
            '/.well-known/ai.json' => array('ai.json', $aimd || $mako),
            '/.well-known/ai-signature.json' => array('ai-signature.json', $aimd || $mako),
            '/.well-known/aifeed-index.json' => array('aifeed-index.json', $aimd),
            '/.well-known/aifeed-index.json.sig' => array('aifeed-index.json.sig', $aimd),
            '/.well-known/mako-index.json' => array('mako-index.json', $mako),
            '/.well-known/mako-index.json.sig' => array('mako-index.json.sig', $mako),
        );
        foreach ($wellKnown as $route => $spec) {
            if ($path !== $route) {
                continue;
            }
            if (!$spec[1]) {
                return false;
            }
            return aifeed_send_file($root . '/.well-known/' . $spec[0], 'application/json; charset=utf-8', 3600);
        }

        if ($path === '/llms.txt') {
            if (aifeed_send_file($root . '/llms.txt', 'text/plain; charset=utf-8', 3600)) {
                return true;
            }
        }

        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';
        $profile = null;
        if ($aimd && strpos($accept, 'text/aifeed+markdown') !== false) {
            $profile = 'aimd';
        } elseif ($mako && strpos($accept, 'text/mako+markdown') !== false) {
            $profile = 'mako';
        }
        if ($profile === null) {
            return false;
        }

        $suffix = $profile === 'mako' ? '.mako.md' : '.aifeed.md';
        $clean = trim($path, '/');
        $candidates = $clean === ''
            ? array('index' . $suffix)
            : array($clean . $suffix, $clean . '/index' . $suffix);
        $mdPath = null;
        foreach ($candidates as $candidate) {
            $resolved = aifeed_safe_join($root, $candidate);
            if ($resolved !== null && is_file($resolved)) {
                $mdPath = $resolved;
                break;
            }
        }
        if ($mdPath === null) {
            return false;
        }

        $body = file_get_contents($mdPath);
        $fields = aifeed_parse_frontmatter_fields($body);
        header('Content-Type: ' . ($profile === 'aimd' ? 'text/aifeed+markdown' : 'text/mako+markdown') . '; charset=utf-8');
        header('Vary: Accept');
        header('X-Mako-Version: 1.0');
        header('X-Mako-Tokens: ' . (int) ($fields['tokens'] ?? 0));
        header('X-Mako-Type: ' . ($fields['type'] ?? 'custom'));
        header('X-Mako-Lang: ' . ($fields['language'] ?? ''));
        header('X-Aifeed-Profile: ' . $profile);
        header('Cache-Control: public, max-age=3600, must-revalidate');

        $signaturePath = $mdPath . '.sig';
        if (is_file($signaturePath)) {
            $container = trim(file_get_contents($signaturePath));
            header('X-Aifeed-Signature: ' . ($profile === 'mako' ? 'mako1:' : 'aimd1:') . rtrim(strtr(base64_encode($container), '+/', '-_'), '='));
        }

        http_response_code(200);
        if ($method !== 'HEAD') {
            echo $body;
        }
        return true;
    }
}
