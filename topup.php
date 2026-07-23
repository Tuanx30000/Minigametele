<?php
require_once 'config.php';
requireAuth();

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$users  = getJson(USERS_FILE);
$uname  = $_SESSION['user']['username'];

switch ($action) {

    // ========== CREATE TOPUP REQUEST ==========
    case 'create':
        $amount = (int)($_POST['amount'] ?? 0);
        $method = trim($_POST['method'] ?? '');
        $txId   = trim($_POST['tx_id'] ?? '');

        if ($amount < 10000) {
            response(false, 'Số tiền nạp tối thiểu 10,000đ');
        }
        if (empty($method)) {
            response(false, 'Vui lòng chọn phương thức thanh toán');
        }
        if (empty($txId)) {
            response(false, 'Vui lòng nhập mã giao dịch');
        }

        $topups = getJson(TOPUP_FILE);
        if (!isset($topups[$uname])) {
            $topups[$uname] = [];
        }

        // Check duplicate tx_id
        foreach ($topups as $user => $list) {
            foreach ($list as $t) {
                if (($t['tx_id'] ?? '') === $txId && ($t['status'] ?? '') !== 'rejected') {
                    response(false, 'Mã giao dịch đã tồn tại');
                }
            }
        }

        $bonus = 0;
        if ($amount >= 500000)  $bonus = (int)($amount * 0.10);
        elseif ($amount >= 200000) $bonus = (int)($amount * 0.05);

        $topups[$uname][] = [
            'tx_id'      => $txId,
            'amount'     => $amount,
            'bonus'      => $bonus,
            'method'     => $method,
            'status'     => 'pending',
            'note'       => '',
            'created_at' => date('Y-m-d H:i:s'),
            'approved_at'  => null,
            'approved_by'  => null,
        ];
        saveJson(TOPUP_FILE, $topups);

        response(true, 'Yêu cầu nạp tiền đã được gửi, vui lòng chờ admin duyệt', [
            'tx_id' => $txId,
            'bonus' => $bonus,
        ]);
        break;

    // ========== GET MY TOPUP HISTORY ==========
    case 'history':
        $topups = getJson(TOPUP_FILE);
        $myTopups = $topups[$uname] ?? [];
        usort($myTopups, fn($a, $b) => strcmp($b['created_at'] ?? '', $a['created_at'] ?? ''));
        response(true, 'OK', ['topups' => $myTopups]);
        break;

    default:
        response(false, 'Action không hợp lệ');
}
?>
