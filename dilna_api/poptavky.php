<?php
/* Minimal Dílna inquiry API for WEDOS PHP hosting. */

$allowedOrigins = array('https://b2b.skovem.cz', 'https://arkeeas.github.io');
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
$dataDir = __DIR__ . '/data';
$maxBodyBytes = 1048576;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function respond($status, $body)
{
    http_response_code($status);
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function allowed_origin($origin, $allowedOrigins)
{
    return in_array($origin, $allowedOrigins, true);
}

function safe_uid($uid)
{
    return is_string($uid) && preg_match('/^[A-Za-z0-9_-]{1,64}$/', $uid) === 1;
}

function read_json_body($maxBodyBytes)
{
    $length = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($length > $maxBodyBytes) {
        respond(413, array('stored' => false, 'code' => 'too_large'));
    }
    $raw = file_get_contents('php://input', false, null, 0, $maxBodyBytes + 1);
    if ($raw === false || strlen($raw) > $maxBodyBytes) {
        respond(413, array('stored' => false, 'code' => 'too_large'));
    }
    $body = json_decode($raw, true);
    if (!is_array($body) || json_last_error() !== JSON_ERROR_NONE) {
        respond(400, array('stored' => false, 'code' => 'invalid_json'));
    }
    return $body;
}

function ensure_data_dir($dataDir)
{
    if (!is_dir($dataDir) && !mkdir($dataDir, 0700, true) && !is_dir($dataDir)) {
        respond(500, array('stored' => false, 'code' => 'storage_unavailable'));
    }
    if (!is_writable($dataDir)) {
        respond(500, array('stored' => false, 'code' => 'storage_unavailable'));
    }
}

function doc_path($dataDir, $uid)
{
    return $dataDir . '/request-' . $uid . '.json';
}

function load_doc($path)
{
    if (!is_file($path)) {
        return null;
    }
    $raw = file_get_contents($path);
    if ($raw === false) {
        return null;
    }
    $value = json_decode($raw, true);
    return is_array($value) ? $value : null;
}

function save_doc_locked($path, $dataDir, $mutate)
{
    $lock = fopen($path . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) {
            fclose($lock);
        }
        return false;
    }
    @chmod($path . '.lock', 0600);
    $current = load_doc($path);
    $next = $mutate($current);
    if ($next === false) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return null;
    }
    $json = json_encode($next, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        flock($lock, LOCK_UN);
        fclose($lock);
        return false;
    }
    $tmp = tempnam($dataDir, '.inquiry-');
    if ($tmp === false || file_put_contents($tmp, $json, LOCK_EX) === false) {
        if ($tmp !== false && is_file($tmp)) {
            unlink($tmp);
        }
        flock($lock, LOCK_UN);
        fclose($lock);
        return false;
    }
    @chmod($tmp, 0600);
    $saved = rename($tmp, $path);
    if (!$saved && is_file($tmp)) {
        unlink($tmp);
    }
    flock($lock, LOCK_UN);
    fclose($lock);
    return $saved ? $next : false;
}

function valid_text($value, $maxLength, $required)
{
    if (!is_string($value)) {
        return false;
    }
    $value = trim($value);
    if (($required && $value === '') || strlen($value) > $maxLength) {
        return false;
    }
    return $value;
}

function allow_rate($dataDir)
{
    $ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
    $key = hash('sha256', $ip);
    $path = $dataDir . '/rate-' . $key . '.json';
    $lock = fopen($path . '.lock', 'c');
    if ($lock === false || !flock($lock, LOCK_EX)) {
        if (is_resource($lock)) {
            fclose($lock);
        }
        return false;
    }
    $times = array();
    if (is_file($path)) {
        $old = json_decode((string) file_get_contents($path), true);
        if (is_array($old)) {
            $times = $old;
        }
    }
    $now = time();
    $times = array_values(array_filter($times, function ($time) use ($now) {
        return is_int($time) && $time > $now - 3600;
    }));
    if (count($times) >= 12) {
        file_put_contents($path, json_encode($times), LOCK_EX);
        flock($lock, LOCK_UN);
        fclose($lock);
        return false;
    }
    $times[] = $now;
    $saved = file_put_contents($path, json_encode($times), LOCK_EX) !== false;
    @chmod($path, 0600);
    @chmod($path . '.lock', 0600);
    flock($lock, LOCK_UN);
    fclose($lock);
    return $saved;
}

function mail_inquiry($item)
{
    if (!function_exists('mail')) {
        return false;
    }
    $customer = $item['customer'];
    $email = $customer['email'];
    $subject = 'Nova poptavka Dílna ' . $item['id'];
    $json = json_encode($item, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $body = "Nova poptavka z konfiguratoru\n\n" . $json . "\n";
    $headers = array(
        'From: SKOVEM <info@skovem.cz>',
        'Reply-To: ' . $email,
        'Content-Type: text/plain; charset=UTF-8',
        'X-Mailer: SKOVEM Dílna'
    );
    return @mail('info@skovem.cz', $subject, $body, implode("\r\n", $headers), '-finfo@skovem.cz');
}

if (allowed_origin($origin, $allowedOrigins)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}

if ($method === 'OPTIONS') {
    if (!allowed_origin($origin, $allowedOrigins)
        || !isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD'])
        || strtoupper($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_METHOD']) !== 'POST') {
        respond(403, array('code' => 'origin_denied'));
    }
    header('Access-Control-Allow-Methods: POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Access-Control-Max-Age: 600');
    http_response_code(204);
    exit;
}

if ($method === 'POST') {
    if (!allowed_origin($origin, $allowedOrigins)) {
        respond(403, array('stored' => false, 'code' => 'origin_denied'));
    }
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'])[0])) : '';
    if ($contentType !== 'application/json') {
        respond(415, array('stored' => false, 'code' => 'content_type'));
    }
    $body = read_json_body($maxBodyBytes);
    $uid = isset($body['uid']) ? $body['uid'] : null;
    $incoming = isset($body['item']) ? $body['item'] : null;
    if (!safe_uid($uid) || !is_array($incoming) || !isset($incoming['customer']) || !is_array($incoming['customer'])) {
        respond(400, array('stored' => false, 'code' => 'invalid_request'));
    }
    $id = valid_text(isset($incoming['id']) ? $incoming['id'] : null, 32, true);
    $name = valid_text(isset($incoming['customer']['name']) ? $incoming['customer']['name'] : null, 160, true);
    $email = valid_text(isset($incoming['customer']['email']) ? $incoming['customer']['email'] : null, 254, true);
    $phone = valid_text(isset($incoming['customer']['phone']) ? $incoming['customer']['phone'] : '', 80, false);
    $address = valid_text(isset($incoming['customer']['address']) ? $incoming['customer']['address'] : '', 500, false);
    $note = valid_text(isset($incoming['note']) ? $incoming['note'] : '', 4000, false);
    $config = isset($incoming['config']) ? $incoming['config'] : null;
    $pricesValid = true;
    foreach (array('price', 'vat', 'total') as $priceKey) {
        if (isset($incoming[$priceKey]) && (!is_numeric($incoming[$priceKey]) || (float) $incoming[$priceKey] < 0 || (float) $incoming[$priceKey] > 1000000000)) {
            $pricesValid = false;
        }
    }
    if ($id === false || preg_match('/^[PSZA][0-9]{6}-[A-Z0-9]{3,6}$/', $id) !== 1
        || $name === false || $email === false || filter_var($email, FILTER_VALIDATE_EMAIL) === false
        || $phone === false || $address === false || $note === false || !is_array($config) || !$pricesValid) {
        respond(400, array('stored' => false, 'code' => 'invalid_request'));
    }
    ensure_data_dir($dataDir);
    if (!allow_rate($dataDir)) {
        respond(429, array('stored' => false, 'code' => 'rate_limited'));
    }
    $now = gmdate('c');
    $item = $incoming;
    $item['id'] = $id;
    $item['created'] = $now;
    $item['status'] = 'nova';
    $item['customer'] = array('name' => $name, 'email' => $email, 'phone' => $phone, 'address' => $address);
    $item['note'] = $note;
    $item['config'] = $config;
    $item['emailSkipped'] = strtolower($name) === 'test';
    $path = doc_path($dataDir, $uid);
    $saved = save_doc_locked($path, $dataDir, function ($current) use ($uid, $item, $now) {
        $doc = is_array($current) ? $current : array('uid' => $uid, 'items' => array());
        if (!isset($doc['items']) || !is_array($doc['items']) || count($doc['items']) >= 500) {
            return false;
        }
        $doc['uid'] = $uid;
        $doc['updated'] = $now;
        $doc['items'][] = $item;
        return $doc;
    });
    if ($saved === null) {
        respond(409, array('stored' => false, 'code' => 'inquiry_limit'));
    }
    if ($saved === false) {
        respond(500, array('stored' => false, 'code' => 'storage_failed'));
    }
    $emailSkipped = strtolower($name) === 'test';
    $emailAccepted = $emailSkipped ? false : mail_inquiry($item);
    respond(201, array('stored' => true, 'emailAccepted' => $emailAccepted, 'emailSkipped' => $emailSkipped, 'id' => $item['id']));
}

if ($method === 'GET') {
    ensure_data_dir($dataDir);
    $op = isset($_GET['op']) ? $_GET['op'] : 'list';
    if ($op === 'doc') {
        $uid = isset($_GET['uid']) ? $_GET['uid'] : null;
        if (!safe_uid($uid)) {
            respond(400, array('code' => 'invalid_uid'));
        }
        $doc = load_doc(doc_path($dataDir, $uid));
        respond(200, array('id' => $uid, 'exists' => is_array($doc), 'data' => $doc));
    }
    if ($op !== 'list') {
        respond(400, array('code' => 'invalid_operation'));
    }
    $docs = array();
    foreach (glob($dataDir . '/request-*.json') as $path) {
        $uid = substr(basename($path), 8, -5);
        if (!safe_uid($uid)) {
            continue;
        }
        $doc = load_doc($path);
        if (is_array($doc)) {
            $docs[] = array('id' => $uid, 'data' => $doc);
        }
    }
    usort($docs, function ($a, $b) {
        return strcmp(isset($b['data']['updated']) ? $b['data']['updated'] : '', isset($a['data']['updated']) ? $a['data']['updated'] : '');
    });
    respond(200, array('docs' => $docs, 'size' => count($docs), 'empty' => count($docs) === 0));
}

if ($method === 'PATCH') {
    $body = read_json_body($maxBodyBytes);
    $uid = isset($body['uid']) ? $body['uid'] : null;
    $items = isset($body['items']) ? $body['items'] : null;
    if (!safe_uid($uid) || !is_array($items)) {
        respond(400, array('code' => 'invalid_request'));
    }
    ensure_data_dir($dataDir);
    $path = doc_path($dataDir, $uid);
    $saved = save_doc_locked($path, $dataDir, function ($current) use ($items) {
        if (!is_array($current) || !isset($current['items']) || !is_array($current['items']) || count($items) !== count($current['items'])) {
            return false;
        }
        $statuses = array('nova', 'reseni', 'hotovo', 'zamitnuto');
        $requested = array();
        foreach ($items as $item) {
            if (!is_array($item) || !isset($item['id']) || !is_string($item['id'])
                || preg_match('/^[PSZA][0-9]{6}-[A-Z0-9]{3,6}$/', $item['id']) !== 1
                || !isset($item['status']) || !in_array($item['status'], $statuses, true)) {
                return false;
            }
            $requested[$item['id']] = $item['status'];
        }
        foreach ($current['items'] as &$savedItem) {
            if (!isset($savedItem['id']) || !array_key_exists($savedItem['id'], $requested)) {
                unset($savedItem);
                return false;
            }
            $savedItem['status'] = $requested[$savedItem['id']];
        }
        unset($savedItem);
        $current['updated'] = gmdate('c');
        return $current;
    });
    if ($saved === null) {
        respond(404, array('code' => 'not_found'));
    }
    if ($saved === false) {
        respond(400, array('code' => 'update_failed'));
    }
    respond(200, array('stored' => true));
}

respond(405, array('code' => 'method_not_allowed'));
