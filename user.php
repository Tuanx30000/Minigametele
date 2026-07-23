<?php
require_once 'config.php';
requireAuth();

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$users  = getJson(USERS_FILE);
$uname  = $_SESSION['user']['username'];

if (!isset($users[$uname])) {
    response(false, 'User không tồn tại');
}

switch ($action) {

    case 'profile':
        $u = $users[$uname];
        response(true, 'OK', [
            'username'   => $u['username'],
            'email'      => $u['email'],
            'balance'    => $u['balance'],
            'level'      => $u['level'],
            'created_at' => $u['created_at'],
            'last_login' => $u['last_login'],
        ]);
        break;

    case 'keys':
        $keyHist = getJson(KEY_FILE);
        $myKeys = $keyHist[$uname] ?? [];
        $now = new DateTime();
        $activeKeys = [];

        foreach ($myKeys as $k) {
            $isActive = false;
            $exp = $k['expires_at'] ?? '';
            if ($exp === 'Vĩnh viễn') {
                $isActive = true;
            } elseif ($exp) {
                try {
                    $isActive = (new DateTime($exp)) > $now;
                } catch (Exception $e) {}
            }
            $k['is_active'] = $isActive;
            $activeKeys[] = $k;
        }

        response(true, 'OK', ['keys' => $activeKeys]);
        break;

    default:
        response(false, 'Action không hợp lệ');
}
?>
