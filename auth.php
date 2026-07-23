<?php
require_once 'config.php';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

switch ($action) {

    // ========== REGISTER ==========
    case 'register':
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $email    = trim($_POST['email'] ?? '');

        if (!preg_match('/^[a-zA-Z0-9_]{6,12}$/', $username)) {
            response(false, 'Tên đăng nhập 6-12 ký tự, chỉ chữ, số, gạch dưới');
        }
        if (strlen($password) < 8) {
            response(false, 'Mật khẩu tối thiểu 8 ký tự');
        }
        if ($email && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            response(false, 'Email không hợp lệ');
        }

        $users = getJson(USERS_FILE);
        if (isset($users[$username])) {
            response(false, 'Tên đăng nhập đã tồn tại');
        }

        $users[$username] = [
            'username'    => $username,
            'password'    => password_hash($password, PASSWORD_BCRYPT),
            'email'       => $email,
            'balance'     => 0,
            'level'       => 'Thành viên',
            'created_at'  => date('Y-m-d H:i:s'),
            'last_login'  => date('Y-m-d H:i:s'),
            'keys'        => [],
        ];
        saveJson(USERS_FILE, $users);

        response(true, 'Đăng ký thành công');
        break;

    // ========== LOGIN ==========
    case 'login':
        $username = trim($_POST['username'] ?? '');
        $password = $_POST['password'] ?? '';
        $remember = !empty($_POST['remember']);

        $users = getJson(USERS_FILE);
        if (!isset($users[$username])) {
            response(false, 'Tài khoản không tồn tại');
        }

        if (!password_verify($password, $users[$username]['password'])) {
            response(false, 'Mật khẩu không đúng');
        }

        $users[$username]['last_login'] = date('Y-m-d H:i:s');
        saveJson(USERS_FILE, $users);

        $_SESSION['user'] = [
            'username' => $username,
            'level'    => $users[$username]['level'],
            'balance'  => $users[$username]['balance'],
        ];

        if ($remember) {
            $token = bin2hex(random_bytes(32));
            setcookie('tuanx3000_token', $token, time() + 86400 * 30, '/', '', false, true);
        }

        response(true, 'Đăng nhập thành công', [
            'username' => $username,
            'balance'  => $users[$username]['balance'],
            'level'    => $users[$username]['level'],
        ]);
        break;

    // ========== LOGOUT ==========
    case 'logout':
        session_destroy();
        setcookie('tuanx3000_token', '', time() - 3600, '/');
        response(true, 'Đã đăng xuất');
        break;

    // ========== CHECK SESSION ==========
    case 'check':
        if (!empty($_SESSION['user'])) {
            $users = getJson(USERS_FILE);
            $u = $users[$_SESSION['user']['username']] ?? null;
            if ($u) {
                response(true, 'Đã đăng nhập', [
                    'username' => $u['username'],
                    'balance'  => $u['balance'],
                    'level'    => $u['level'],
                ]);
            }
        }
        response(false, 'Chưa đăng nhập');
        break;

    default:
        response(false, 'Action không hợp lệ');
}
?>
