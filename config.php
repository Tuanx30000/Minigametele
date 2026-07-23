<?php
session_start();
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

define('DATA_DIR', __DIR__ . '/../data/');
define('USERS_FILE', DATA_DIR . 'users.json');
define('TOPUP_FILE', DATA_DIR . 'topup_history.json');
define('KEY_FILE', DATA_DIR . 'key_history.json');

if (!is_dir(DATA_DIR)) mkdir(DATA_DIR, 0755, true);

function getJson($file) {
    if (!file_exists($file)) return [];
    $data = file_get_contents($file);
    return json_decode($data, true) ?: [];
}

function saveJson($file, $data) {
    file_put_contents($file, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function response($success, $message = '', $data = []) {
    echo json_encode(array_merge(['success' => $success, 'message' => $message], $data));
    exit;
}

function requireAuth() {
    if (empty($_SESSION['user'])) {
        response(false, 'Chưa đăng nhập', ['code' => 'AUTH_REQUIRED']);
    }
}

function generateKey($length = 16) {
    $chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    $key = '';
    for ($i = 0; $i < $length; $i++) {
        $key .= $chars[random_int(0, strlen($chars) - 1)];
    }
    return $key;
}

// Key pricing config
$KEY_PACKAGES = [
    '1 ngày'   => ['price' => 50000,  'hours' => 24],
    '3 ngày'   => ['price' => 120000, 'hours' => 72],
    '7 ngày'   => ['price' => 250000, 'hours' => 168],
    '30 ngày'  => ['price' => 800000, 'hours' => 720],
    'Vĩnh viễn' => ['price' => 2000000, 'hours' => -1],
];
?>
