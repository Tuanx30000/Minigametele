<?php
require_once 'config.php';

// Admin authentication check
if (empty($_SESSION['admin_logged'])) {
    response(false, 'Chưa đăng nhập admin', ['code' => 'ADMIN_AUTH_REQUIRED']);
}

$action = $_POST['action'] ?? '';
$users  = getJson(USERS_FILE);
$topups = getJson(TOPUP_FILE);

switch ($action) {

    // ========== APPROVE / REJECT TOPUP ==========
    case 'approve':
    case 'reject':
        $username = trim($_POST['username'] ?? '');
        $txId     = trim($_POST['tx_id'] ?? '');
        $note     = trim($_POST['note'] ?? '');

        if (!isset($topups[$username])) {
            response(false, 'Không tìm thấy lịch sử nạp của user');
        }

        $found = false;
        foreach ($topups[$username] as &$tx) {
            if (($tx['tx_id'] ?? '') === $txId) {
                if (($tx['status'] ?? '') !== 'pending') {
                    response(false, 'Giao dịch này đã được xử lý trước đó');
                }
                $tx['status'] = $action === 'approve' ? 'approved' : 'rejected';
                $tx['note'] = $note;
                $tx['approved_at'] = date('Y-m-d H:i:s');
                $tx['approved_by'] = $_SESSION['admin_logged'];

                if ($action === 'approve') {
                    $totalAdd = ($tx['amount'] ?? 0) + ($tx['bonus'] ?? 0);
                    if (isset($users[$username])) {
                        $users[$username]['balance'] = ($users[$username]['balance'] ?? 0) + $totalAdd;
                    }
                }
                $found = true;
                break;
            }
        }

        if (!$found) {
            response(false, 'Không tìm thấy giao dịch');
        }

        saveJson(TOPUP_FILE, $topups);
        saveJson(USERS_FILE, $users);

        response(true, $action === 'approve' ? 'Đã duyệt nạp tiền' : 'Đã từ chối giao dịch');
        break;

    // ========== SET USER BALANCE ==========
    case 'set_balance':
        $username = trim($_POST['username'] ?? '');
        $balance  = (int)($_POST['balance'] ?? 0);

        if (!isset($users[$username])) {
            response(false, 'User không tồn tại');
        }

        $users[$username]['balance'] = max(0, $balance);
        saveJson(USERS_FILE, $users);

        response(true, 'Đã cập nhật số dư', ['new_balance' => $users[$username]['balance']]);
        break;

    // ========== DELETE USER ==========
    case 'delete_user':
        $username = trim($_POST['username'] ?? '');
        if (!isset($users[$username])) {
            response(false, 'User không tồn tại');
        }
        unset($users[$username]);
        saveJson(USERS_FILE, $users);
        response(true, 'Đã xóa user');
        break;

    default:
        response(false, 'Action không hợp lệ');
}
?>
