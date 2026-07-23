<?php
require_once 'config.php';
requireAuth();

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$users  = getJson(USERS_FILE);
$uname  = $_SESSION['user']['username'];

if (!isset($users[$uname])) {
    response(false, 'User không tồn tại');
}

$KEY_PACKAGES = [
    '1 ngày'    => ['price' => 50000,  'hours' => 24],
    '3 ngày'    => ['price' => 120000, 'hours' => 72],
    '7 ngày'    => ['price' => 250000, 'hours' => 168],
    '30 ngày'   => ['price' => 800000, 'hours' => 720],
    'Vĩnh viễn' => ['price' => 2000000, 'hours' => -1],
];

switch ($action) {

    // ========== BUY KEY ==========
    case 'buy':
        $package = trim($_POST['package'] ?? '');
        $game    = trim($_POST['game'] ?? '');

        if (empty($game)) {
            response(false, 'Vui lòng chọn game');
        }
        if (!isset($KEY_PACKAGES[$package])) {
            response(false, 'Gói key không hợp lệ');
        }

        $pkg = $KEY_PACKAGES[$package];
        $price = $pkg['price'];

        if ($users[$uname]['balance'] < $price) {
            response(false, 'Số dư không đủ. Cần ' . number_format($price) . 'đ');
        }

        // Generate unique key
        $keyStr = generateKey(16);
        $keyHist = getJson(KEY_FILE);
        if (!isset($keyHist[$uname])) {
            $keyHist[$uname] = [];
        }

        // Check key collision
        $allKeys = [];
        foreach ($keyHist as $ulist) {
            foreach ($ulist as $k) {
                $allKeys[] = $k['key'];
            }
        }
        while (in_array($keyStr, $allKeys)) {
            $keyStr = generateKey(16);
        }

        $expiresAt = ($pkg['hours'] === -1) ? 'Vĩnh viễn' : date('Y-m-d H:i:s', time() + $pkg['hours'] * 3600);

        $keyData = [
            'key'         => $keyStr,
            'game'        => $game,
            'package'     => $package,
            'price'       => $price,
            'duration'    => $package,
            'expires_at'  => $expiresAt,
            'status'      => 'active',
            'created_at'  => date('Y-m-d H:i:s'),
            'activated_at'=> date('Y-m-d H:i:s'),
        ];

        $keyHist[$uname][] = $keyData;
        saveJson(KEY_FILE, $keyHist);

        // Deduct balance
        $users[$uname]['balance'] -= $price;
        $users[$uname]['keys'][$game] = $keyData;
        saveJson(USERS_FILE, $users);

        // Update session
        $_SESSION['user']['balance'] = $users[$uname]['balance'];

        response(true, 'Mua key thành công!', [
            'key'        => $keyStr,
            'game'       => $game,
            'expires_at' => $expiresAt,
            'balance'    => $users[$uname]['balance'],
        ]);
        break;

    // ========== VALIDATE KEY (nhập key vào game) ==========
    case 'validate':
        $game = trim($_POST['game'] ?? '');
        $inputKey = trim(strtoupper($_POST['key'] ?? ''));

        if (empty($game) || empty($inputKey)) {
            response(false, 'Vui lòng nhập đầy đủ thông tin');
        }

        $keyHist = getJson(KEY_FILE);
        $found = false;
        $owner = null;
        $keyData = null;

        foreach ($keyHist as $user => $list) {
            foreach ($list as $k) {
                if ($k['key'] === $inputKey && $k['game'] === $game) {
                    $found = true;
                    $owner = $user;
                    $keyData = $k;
                    break 2;
                }
            }
        }

        if (!$found) {
            response(false, 'Key không hợp lệ hoặc không thuộc game này');
        }

        // Check expiry
        $isActive = false;
        $exp = $keyData['expires_at'] ?? '';
        if ($exp === 'Vĩnh viễn') {
            $isActive = true;
        } elseif ($exp) {
            try {
                $isActive = (new DateTime($exp)) > new DateTime();
            } catch (Exception $e) {}
        }

        if (!$isActive) {
            response(false, 'Key đã hết hạn', ['expired' => true]);
        }

        if ($owner !== $uname) {
            response(false, 'Key này thuộc về tài khoản khác');
        }

        response(true, 'Key hợp lệ! Đang mở tool...', [
            'game'       => $game,
            'expires_at' => $exp,
            'package'    => $keyData['package'],
        ]);
        break;

    // ========== CHECK IF USER HAS ACTIVE KEY FOR GAME ==========
    case 'check':
        $game = trim($_POST['game'] ?? '');
        if (empty($game)) {
            response(false, 'Thiếu tên game');
        }

        $keyHist = getJson(KEY_FILE);
        $myKeys = $keyHist[$uname] ?? [];
        $now = new DateTime();

        foreach ($myKeys as $k) {
            if ($k['game'] !== $game) continue;

            $isActive = false;
            $exp = $k['expires_at'] ?? '';
            if ($exp === 'Vĩnh viễn') {
                $isActive = true;
            } elseif ($exp) {
                try {
                    $isActive = (new DateTime($exp)) > $now;
                } catch (Exception $e) {}
            }

            if ($isActive) {
                response(true, 'Bạn đã có key active cho game này', [
                    'has_key'    => true,
                    'key'        => $k['key'],
                    'expires_at' => $exp,
                    'package'    => $k['package'],
                ]);
            }
        }

        response(true, 'Chưa có key cho game này', ['has_key' => false]);
        break;

    default:
        response(false, 'Action không hợp lệ');
}
?>
