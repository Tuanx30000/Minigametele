<?php
session_start();

define('tuanx3000', '');
define('loanhtuan1', '');

if (isset($_POST['do_login'])) {
    if ($_POST['a_user'] === ADMIN_USER && $_POST['a_pass'] === ADMIN_PASS) {
        $_SESSION['admin_logged'] = true;
        $_SESSION['admin_time']   = time();
    } else {
        $loginErr = 'Sai tài khoản hoặc mật khẩu!';
    }
}
if (isset($_GET['logout'])) {
    session_destroy();
    header("Location: admin_web.php");
    exit;
}

if (isset($_SESSION['admin_logged']) && (time() - ($_SESSION['admin_time'] ?? 0)) > 7200) {
    session_destroy();
    header("Location: admin_web.php");
    exit;
}
if (isset($_SESSION['admin_logged'])) $_SESSION['admin_time'] = time();

$isLogged = !empty($_SESSION['admin_logged']);

$usersFile  = __DIR__ . '/users.json';
$topupFile  = __DIR__ . '/topup_history.json';
$keyFile    = __DIR__ . '/key_history.json';

$users    = file_exists($usersFile) ? (json_decode(file_get_contents($usersFile), true) ?? []) : [];
$topups   = file_exists($topupFile) ? (json_decode(file_get_contents($topupFile), true) ?? []) : [];
$keyHist  = file_exists($keyFile)   ? (json_decode(file_get_contents($keyFile),   true) ?? []) : [];

$totalUsers    = count($users);
$totalBalance  = array_sum(array_column($users, 'balance'));
$pendingList   = [];
$allTopups     = [];
$totalRevenue  = 0;
$todayRevenue  = 0;
$totalKeys     = 0;
$pendingCount  = 0;
$todayStr = date('Y-m-d');

// Revenue by day (last 14 days)
$revenueByDay = [];
for ($i = 13; $i >= 0; $i--) {
    $revenueByDay[date('Y-m-d', strtotime("-$i days"))] = 0;
}

// Users by day (last 14 days)
$usersByDay = [];
for ($i = 13; $i >= 0; $i--) {
    $usersByDay[date('Y-m-d', strtotime("-$i days"))] = 0;
}

foreach ($topups as $uname => $list) {
    foreach ($list as $item) {
        $item['_user'] = $uname;
        $allTopups[]   = $item;
        if (($item['status'] ?? '') === 'pending') {
            $pendingList[] = $item;
            $pendingCount++;
        }
        if (($item['status'] ?? '') === 'approved') {
            $amt = ($item['amount'] ?? 0) + ($item['bonus'] ?? 0);
            $totalRevenue += $amt;
            $day = substr($item['created_at'] ?? '', 0, 10);
            if (isset($revenueByDay[$day])) $revenueByDay[$day] += $amt;
            if ($day === $todayStr) $todayRevenue += $amt;
        }
    }
}

foreach ($users as $uname => $udata) {
    $day = substr($udata['created_at'] ?? '', 0, 10);
    if (isset($usersByDay[$day])) $usersByDay[$day]++;
}

$allKeys = [];
foreach ($keyHist as $uname => $list) {
    foreach ($list as $item) {
        $item['_user'] = $uname;
        $allKeys[]     = $item;
        $totalKeys++;
    }
}

usort($allTopups,   fn($a,$b) => strcmp($b['created_at']??'', $a['created_at']??''));
usort($allKeys,     fn($a,$b) => strcmp($b['created_at']??'', $a['created_at']??''));
usort($pendingList, fn($a,$b) => strcmp($a['created_at']??'', $b['created_at']??''));

// Key stats
$keyStats = [];
foreach ($allKeys as $k) {
    $dur = $k['duration'] ?? 'N/A';
    if (!isset($keyStats[$dur])) $keyStats[$dur] = ['count'=>0,'revenue'=>0];
    $keyStats[$dur]['count']++;
    $keyStats[$dur]['revenue'] += $k['price'] ?? 0;
}

// Top users
$userRevenue = [];
foreach ($topups as $uname => $list) {
    $total = 0;
    foreach ($list as $item) {
        if (($item['status']??'') === 'approved') $total += $item['amount']??0;
    }
    if ($total > 0) $userRevenue[$uname] = $total;
}
arsort($userRevenue);
$topUsers = array_slice($userRevenue, 0, 5, true);

$stCounts = ['approved'=>0,'pending'=>0,'rejected'=>0];
foreach ($allTopups as $t) $stCounts[$t['status']??'pending'] = ($stCounts[$t['status']??'pending']??0)+1;

// Chart data as JSON
$chartRevenueLabels = json_encode(array_map(fn($d) => date('d/m', strtotime($d)), array_keys($revenueByDay)));
$chartRevenueData   = json_encode(array_values($revenueByDay));
$chartUserLabels    = json_encode(array_map(fn($d) => date('d/m', strtotime($d)), array_keys($usersByDay)));
$chartUserData      = json_encode(array_values($usersByDay));
$chartKeyLabels     = json_encode(array_keys($keyStats));
$chartKeyData       = json_encode(array_map(fn($s) => $s['count'], array_values($keyStats)));
$chartStatusLabels  = json_encode(['Đã duyệt','Chờ duyệt','Từ chối']);
$chartStatusData    = json_encode([$stCounts['approved'],$stCounts['pending'],$stCounts['rejected']]);
?>
<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0,maximum-scale=1.0,user-scalable=no">
<title>Admin — Thomas × Akiyori</title>
<link rel="icon" href="favicon1.png?v=2">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<style>
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --bg:         #080b12;
  --surface:    #0f1420;
  --surface-2:  #151c2e;
  --surface-3:  #1c2540;
  --border:     #1e2a42;
  --border-2:   #2a3a5c;
  --text:       #e8edf8;
  --text-2:     #7a8db0;
  --text-3:     #3d4f6e;
  --accent:     #4f8aff;
  --accent-glow:rgba(79,138,255,.18);
  --green:      #2de8a0;
  --green-bg:   rgba(45,232,160,.08);
  --green-bd:   rgba(45,232,160,.2);
  --red:        #ff5b72;
  --red-bg:     rgba(255,91,114,.08);
  --red-bd:     rgba(255,91,114,.2);
  --amber:      #ffbe3d;
  --amber-bg:   rgba(255,190,61,.08);
  --amber-bd:   rgba(255,190,61,.2);
  --blue:       #4f8aff;
  --blue-bg:    rgba(79,138,255,.08);
  --blue-bd:    rgba(79,138,255,.2);
  --purple:     #a78bfa;
  --purple-bg:  rgba(167,139,250,.08);
  --purple-bd:  rgba(167,139,250,.2);
  --radius:     12px;
  --radius-sm:  8px;
  --shadow:     0 2px 8px rgba(0,0,0,.4);
  --shadow-md:  0 8px 32px rgba(0,0,0,.5);
}

body {
  background: var(--bg);
  font-family: 'Space Grotesk', sans-serif;
  color: var(--text);
  min-height: 100vh;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  background-image:
    radial-gradient(ellipse 80% 50% at 20% -10%, rgba(79,138,255,.07) 0%, transparent 60%),
    radial-gradient(ellipse 60% 40% at 80% 100%, rgba(45,232,160,.05) 0%, transparent 60%);
}

/* ── LOGIN ── */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.login-card {
  width: 100%;
  max-width: 380px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 20px;
  padding: 40px 32px 32px;
  box-shadow: var(--shadow-md), 0 0 0 1px rgba(79,138,255,.05);
  position: relative;
  overflow: hidden;
}

.login-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(79,138,255,.4), transparent);
}

.login-brand {
  text-align: center;
  margin-bottom: 32px;
}

.login-brand-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, var(--accent), #7c3aed);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 16px;
  color: #fff;
  font-size: 22px;
  box-shadow: 0 8px 24px rgba(79,138,255,.3);
}

.login-brand-name {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -.3px;
}

.login-brand-sub {
  font-size: 12px;
  color: var(--text-3);
  font-family: 'Space Mono', monospace;
  margin-top: 3px;
}

.field-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 7px;
  display: block;
  letter-spacing: .5px;
  text-transform: uppercase;
}

.field-input {
  width: 100%;
  padding: 11px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  color: var(--text);
  background: var(--surface-2);
  outline: none;
  transition: all .2s;
  margin-bottom: 16px;
}

.field-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.field-input::placeholder { color: var(--text-3); }

.btn-primary {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, var(--accent), #6366f1);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all .2s;
  letter-spacing: .3px;
  box-shadow: 0 4px 16px rgba(79,138,255,.3);
}
.btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(79,138,255,.4); }
.btn-primary:active { transform: translateY(0); }

.login-error {
  background: var(--red-bg);
  border: 1px solid var(--red-bd);
  border-radius: var(--radius-sm);
  padding: 10px 14px;
  font-size: 12px;
  color: var(--red);
  margin-bottom: 16px;
}

/* ── HEADER ── */
.admin-header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(8,11,18,.9);
  backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--border);
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.header-brand {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 10px;
  letter-spacing: -.2px;
}

.header-logo {
  width: 28px;
  height: 28px;
  background: linear-gradient(135deg, var(--accent), #7c3aed);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  color: #fff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.pending-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: var(--amber-bg);
  border: 1px solid var(--amber-bd);
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  color: var(--amber);
  letter-spacing: .2px;
}

.pending-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--amber);
  animation: blink 1.4s ease-in-out infinite;
}

@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }

.logout-link {
  font-size: 12px;
  color: var(--text-2);
  text-decoration: none;
  font-weight: 600;
  padding: 6px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  transition: all .15s;
  letter-spacing: .2px;
}
.logout-link:hover { border-color: var(--border-2); color: var(--text); background: var(--surface-2); }

/* ── BODY ── */
.admin-body {
  max-width: 1140px;
  margin: 0 auto;
  padding: 28px 20px 60px;
}

/* ── STATS ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 12px;
}
@media (min-width: 640px) {
  .stats-grid { grid-template-columns: repeat(4, 1fr); }
}

.stats-grid-2 {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 18px 20px;
  position: relative;
  overflow: hidden;
  transition: border-color .2s;
}
.stat-card:hover { border-color: var(--border-2); }

.stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--accent), transparent);
  opacity: 0;
  transition: opacity .2s;
}
.stat-card:hover::before { opacity: 1; }

.stat-card.accent-green::before { background: linear-gradient(90deg, var(--green), transparent); }
.stat-card.accent-amber::before { background: linear-gradient(90deg, var(--amber), transparent); }
.stat-card.accent-red::before   { background: linear-gradient(90deg, var(--red), transparent); }
.stat-card.accent-purple::before { background: linear-gradient(90deg, var(--purple), transparent); }

.stat-card.highlight {
  background: linear-gradient(135deg, rgba(79,138,255,.12), rgba(99,102,241,.08));
  border-color: rgba(79,138,255,.3);
}
.stat-card.highlight::before { opacity: 1; }

.stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  margin-bottom: 12px;
}
.stat-icon.blue   { background: var(--blue-bg);   color: var(--blue);   border: 1px solid var(--blue-bd); }
.stat-icon.green  { background: var(--green-bg);  color: var(--green);  border: 1px solid var(--green-bd); }
.stat-icon.amber  { background: var(--amber-bg);  color: var(--amber);  border: 1px solid var(--amber-bd); }
.stat-icon.red    { background: var(--red-bg);    color: var(--red);    border: 1px solid var(--red-bd); }
.stat-icon.purple { background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-bd); }

.stat-label {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
  letter-spacing: .5px;
  text-transform: uppercase;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -.5px;
  line-height: 1;
}

.stat-value.danger { color: var(--red); }

/* ── CHARTS SECTION ── */
.charts-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 24px;
}
@media (min-width: 800px) {
  .charts-grid { grid-template-columns: 2fr 1fr; }
  .charts-grid-2 { grid-template-columns: 1fr 1fr; }
}

.charts-grid-2 {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 20px 16px;
  position: relative;
  overflow: hidden;
}

.chart-card::after {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(79,138,255,.2), transparent);
}

.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}

.chart-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.chart-title-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.chart-subtitle {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 500;
}

.chart-total {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  letter-spacing: -.3px;
}

.chart-total-sub {
  font-size: 10px;
  color: var(--text-3);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: .4px;
}

.chart-container { position: relative; }

/* ── ALERT ── */
.pending-alert {
  background: linear-gradient(135deg, var(--amber-bg), transparent);
  border: 1px solid var(--amber-bd);
  border-radius: var(--radius);
  padding: 13px 18px;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
  font-size: 13px;
  color: var(--amber);
  font-weight: 500;
}

/* ── TABS ── */
.tab-bar {
  display: flex;
  gap: 2px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 4px;
  margin-bottom: 20px;
  overflow-x: auto;
  scrollbar-width: none;
}
.tab-bar::-webkit-scrollbar { display: none; }

.tab-btn {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 8px;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  border: none;
  background: transparent;
  color: var(--text-3);
  transition: all .15s;
  white-space: nowrap;
  letter-spacing: .2px;
}

.tab-btn.active {
  background: var(--surface-3);
  color: var(--text);
  border: 1px solid var(--border-2);
}

.tab-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  background: var(--red);
  color: #fff;
  border-radius: 50%;
  font-size: 9px;
  font-weight: 700;
  margin-left: 5px;
  vertical-align: middle;
}

/* ── SECTION ── */
.section-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  letter-spacing: -.1px;
}

.section-count {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 500;
  font-family: 'Space Mono', monospace;
}

/* ── TABLE ── */
.table-wrap {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  margin-bottom: 16px;
  overflow-x: auto;
}

table { width: 100%; border-collapse: collapse; min-width: 560px; }

thead th {
  padding: 11px 16px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  text-align: left;
  border-bottom: 1px solid var(--border);
  background: var(--surface-2);
  white-space: nowrap;
  letter-spacing: .6px;
  text-transform: uppercase;
}

tbody td {
  padding: 13px 16px;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  vertical-align: middle;
}

tbody tr:last-child td { border-bottom: none; }
tbody tr:hover td { background: rgba(79,138,255,.03); }

/* ── BADGES ── */
.badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 3px 9px;
  border-radius: 20px;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  letter-spacing: .2px;
}

.badge-green  { background: var(--green-bg);  color: var(--green);  border: 1px solid var(--green-bd); }
.badge-red    { background: var(--red-bg);    color: var(--red);    border: 1px solid var(--red-bd); }
.badge-amber  { background: var(--amber-bg);  color: var(--amber);  border: 1px solid var(--amber-bd); }
.badge-blue   { background: var(--blue-bg);   color: var(--blue);   border: 1px solid var(--blue-bd); }
.badge-purple { background: var(--purple-bg); color: var(--purple); border: 1px solid var(--purple-bd); }

.badge-dot { width: 5px; height: 5px; border-radius: 50%; background: currentColor; }
.badge-dot.blink { animation: blink 1.4s ease-in-out infinite; }

/* ── MONEY ── */
.money { font-family: 'Space Mono', monospace; font-size: 12px; font-weight: 700; }
.money-green  { color: var(--green); }
.money-amber  { color: var(--amber); }
.money-red    { color: var(--red); }

/* ── CODE ── */
.code-val {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: var(--text-2);
  background: var(--bg);
  border: 1px solid var(--border);
  padding: 3px 8px;
  border-radius: 5px;
  display: inline-block;
  letter-spacing: .3px;
}

/* ── AVATAR ── */
.avatar {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--surface-3), var(--surface-2));
  border: 1px solid var(--border-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  vertical-align: middle;
  margin-right: 9px;
  flex-shrink: 0;
}

/* ── ACTIONS ── */
.action-row { display: flex; gap: 6px; }

.btn-sm {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 11px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid;
  font-family: 'Space Grotesk', sans-serif;
  transition: all .15s;
  white-space: nowrap;
  letter-spacing: .2px;
}

.btn-approve { background: var(--green-bg); border-color: var(--green-bd); color: var(--green); }
.btn-approve:hover { background: rgba(45,232,160,.15); }
.btn-reject  { background: var(--red-bg);   border-color: var(--red-bd);   color: var(--red); }
.btn-reject:hover  { background: rgba(255,91,114,.15); }
.btn-neutral { background: var(--surface-2); border-color: var(--border-2); color: var(--text-2); }
.btn-neutral:hover { color: var(--text); border-color: var(--accent); }
.btn-edit    { background: var(--amber-bg);  border-color: var(--amber-bd);  color: var(--amber); font-size: 10px; padding: 3px 8px; margin-left: 6px; }

.btn-sm:disabled { opacity: .35; cursor: not-allowed; }

/* ── SEARCH ── */
.search-wrap { position: relative; margin-bottom: 12px; }

.search-input {
  width: 100%;
  padding: 10px 14px 10px 38px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px;
  background: var(--surface-2);
  color: var(--text);
  outline: none;
  transition: all .2s;
}
.search-input:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-glow); }
.search-input::placeholder { color: var(--text-3); }

.search-ico { position: absolute; left: 13px; top: 50%; transform: translateY(-50%); color: var(--text-3); font-size: 12px; }

/* ── REFRESH ── */
.refresh-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all .15s;
  font-family: 'Space Grotesk', sans-serif;
}
.refresh-btn:hover { border-color: var(--border-2); color: var(--text); }
.refresh-btn.spin i { animation: spin .6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

/* ── EMPTY ── */
.empty-row td { text-align: center; padding: 40px; color: var(--text-3); font-size: 13px; }

/* ── TAB CONTENT ── */
.tab-content { display: none; }
.tab-content.active { display: block; }

/* ── TOAST ── */
.toast {
  position: fixed;
  top: 68px;
  right: 20px;
  z-index: 9999;
  padding: 11px 18px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  opacity: 0;
  transform: translateY(-6px);
  transition: all .25s;
  pointer-events: none;
  box-shadow: var(--shadow-md);
  letter-spacing: .2px;
}
.toast.show { opacity: 1; transform: translateY(0); }
.toast-ok  { background: var(--green-bg);  border: 1px solid var(--green-bd);  color: var(--green); }
.toast-err { background: var(--red-bg);    border: 1px solid var(--red-bd);    color: var(--red); }

/* ── STATS TAB SPECIFICS ── */
.stats-row-3 {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}

/* ── LEGEND ── */
.legend { display: flex; gap: 14px; flex-wrap: wrap; }
.legend-item { display: flex; align-items: center; gap: 5px; font-size: 11px; color: var(--text-2); font-weight: 500; }
.legend-dot  { width: 8px; height: 8px; border-radius: 2px; flex-shrink: 0; }
</style>
</head>
<body>

<?php if (!$isLogged): ?>
<div class="login-page">
  <div class="login-card">
    <div class="login-brand">
      <div class="login-brand-icon">
        <i class="fa-solid fa-shield-halved"></i>
      </div>
      <div class="login-brand-name">Admin Panel</div>
      <div class="login-brand-sub">Thomas × Akiyori</div>
    </div>
    <?php if (!empty($loginErr)): ?>
    <div class="login-error"><i class="fa-solid fa-circle-exclamation"></i> <?= htmlspecialchars($loginErr) ?></div>
    <?php endif; ?>
    <form method="POST">
      <label class="field-label">Tên đăng nhập</label>
      <input type="text" name="a_user" class="field-input" placeholder="admin" autocomplete="off" required>
      <label class="field-label">Mật khẩu</label>
      <input type="password" name="a_pass" class="field-input" placeholder="••••••••" required>
      <button type="submit" name="do_login" class="btn-primary">Đăng nhập</button>
    </form>
  </div>
</div>

<?php else: ?>

<header class="admin-header">
  <div class="header-brand">
    <div class="header-logo"><i class="fa-solid fa-shield-halved"></i></div>
    Admin Panel
    <span style="color:var(--text-3);font-weight:400;font-size:12px">Thomas × Akiyori</span>
  </div>
  <div class="header-right">
    <?php if ($pendingCount > 0): ?>
    <div class="pending-pill">
      <span class="pending-pill-dot"></span>
      <?= $pendingCount ?> chờ duyệt
    </div>
    <?php endif; ?>
    <a href="?logout=1" class="logout-link" onclick="return confirm('Đăng xuất?')">Đăng xuất</a>
  </div>
</header>

<div class="admin-body">

  <!-- Stats Row 1 -->
  <div class="stats-grid">
    <div class="stat-card accent-blue">
      <div class="stat-icon blue"><i class="fa-solid fa-users"></i></div>
      <div class="stat-label">Người dùng</div>
      <div class="stat-value"><?= $totalUsers ?></div>
    </div>
    <div class="stat-card accent-purple">
      <div class="stat-icon purple"><i class="fa-solid fa-key"></i></div>
      <div class="stat-label">Key đã bán</div>
      <div class="stat-value"><?= $totalKeys ?></div>
    </div>
    <div class="stat-card <?= $pendingCount > 0 ? 'accent-red' : '' ?>">
      <div class="stat-icon <?= $pendingCount > 0 ? 'red' : 'amber' ?>"><i class="fa-solid fa-clock"></i></div>
      <div class="stat-label">Chờ duyệt</div>
      <div class="stat-value <?= $pendingCount > 0 ? 'danger' : '' ?>"><?= $pendingCount ?></div>
    </div>
    <div class="stat-card accent-green">
      <div class="stat-icon green"><i class="fa-solid fa-wallet"></i></div>
      <div class="stat-label">Số dư user</div>
      <div class="stat-value" style="font-size:17px"><?= number_format($totalBalance) ?>đ</div>
    </div>
  </div>

  <!-- Stats Row 2 -->
  <div class="stats-grid-2">
    <div class="stat-card highlight">
      <div class="stat-icon blue"><i class="fa-solid fa-calendar-day"></i></div>
      <div class="stat-label">Doanh thu hôm nay</div>
      <div class="stat-value" style="font-size:19px"><?= number_format($todayRevenue) ?>đ</div>
    </div>
    <div class="stat-card accent-amber">
      <div class="stat-icon amber"><i class="fa-solid fa-chart-line"></i></div>
      <div class="stat-label">Tổng doanh thu</div>
      <div class="stat-value" style="font-size:19px"><?= number_format($totalRevenue) ?>đ</div>
    </div>
  </div>

  <!-- Charts -->
  <div class="charts-grid">
    <!-- Revenue Chart -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <div class="chart-title">
            <span class="chart-title-dot" style="background:var(--accent)"></span>
            Doanh thu 14 ngày
          </div>
          <div class="chart-subtitle" style="margin-top:2px">Tổng theo ngày (VNĐ)</div>
        </div>
        <div style="text-align:right">
          <div class="chart-total"><?= number_format($totalRevenue) ?>đ</div>
          <div class="chart-total-sub">Tổng cộng</div>
        </div>
      </div>
      <div class="chart-container" style="height:180px">
        <canvas id="revenueChart"></canvas>
      </div>
    </div>

    <!-- Status Donut -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <div class="chart-title">
            <span class="chart-title-dot" style="background:var(--green)"></span>
            Trạng thái GD
          </div>
          <div class="chart-subtitle" style="margin-top:2px">Phân tích giao dịch</div>
        </div>
      </div>
      <div class="chart-container" style="height:140px">
        <canvas id="statusChart"></canvas>
      </div>
      <div class="legend" style="margin-top:12px">
        <div class="legend-item"><span class="legend-dot" style="background:var(--green)"></span> Duyệt (<?= $stCounts['approved'] ?>)</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--amber)"></span> Chờ (<?= $stCounts['pending'] ?>)</div>
        <div class="legend-item"><span class="legend-dot" style="background:var(--red)"></span> Từ chối (<?= $stCounts['rejected'] ?>)</div>
      </div>
    </div>
  </div>

  <div class="charts-grid-2">
    <!-- User Growth Chart -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <div class="chart-title">
            <span class="chart-title-dot" style="background:var(--purple)"></span>
            Người dùng mới
          </div>
          <div class="chart-subtitle" style="margin-top:2px">Đăng ký trong 14 ngày</div>
        </div>
        <div style="text-align:right">
          <div class="chart-total"><?= $totalUsers ?></div>
          <div class="chart-total-sub">Tổng users</div>
        </div>
      </div>
      <div class="chart-container" style="height:160px">
        <canvas id="userChart"></canvas>
      </div>
    </div>

    <!-- Key Package Chart -->
    <div class="chart-card">
      <div class="chart-header">
        <div>
          <div class="chart-title">
            <span class="chart-title-dot" style="background:var(--amber)"></span>
            Gói key bán ra
          </div>
          <div class="chart-subtitle" style="margin-top:2px">Phân bổ theo gói</div>
        </div>
        <div style="text-align:right">
          <div class="chart-total"><?= $totalKeys ?></div>
          <div class="chart-total-sub">Tổng key</div>
        </div>
      </div>
      <div class="chart-container" style="height:160px">
        <canvas id="keyChart"></canvas>
      </div>
    </div>
  </div>

  <?php if ($pendingCount > 0): ?>
  <div class="pending-alert">
    <i class="fa-solid fa-bell"></i>
    Có <?= $pendingCount ?> giao dịch đang chờ duyệt — xem tab "Duyệt nạp tiền"
  </div>
  <?php endif; ?>

  <!-- Tabs -->
  <div class="tab-bar">
    <button class="tab-btn active" data-tab="pending">
      Duyệt nạp tiền
      <?php if ($pendingCount > 0): ?><span class="tab-badge"><?= $pendingCount ?></span><?php endif; ?>
    </button>
    <button class="tab-btn" data-tab="users">Người dùng</button>
    <button class="tab-btn" data-tab="topups">Lịch sử nạp</button>
    <button class="tab-btn" data-tab="keys">Quản lý key</button>
    <button class="tab-btn" data-tab="stats">Thống kê</button>
  </div>

  <!-- TAB: DUYỆT NẠP TIỀN -->
  <div class="tab-content active" id="tab-pending">
    <?php
    $pendingTx = [];
    foreach ($topups as $uname => $list) {
        foreach ($list as $item) {
            if (($item['status'] ?? '') === 'pending') {
                $item['_user'] = $uname;
                $pendingTx[] = $item;
            }
        }
    }
    usort($pendingTx, fn($a,$b) => strcmp($a['created_at']??'', $b['created_at']??''));
    ?>
    <div class="section-title">
      Giao dịch chờ duyệt
      <div style="display:flex;align-items:center;gap:8px">
        <span class="section-count"><?= count($pendingTx) ?> giao dịch</span>
        <button class="refresh-btn" onclick="this.classList.add('spin');setTimeout(()=>location.reload(),400)">
          <i class="fa-solid fa-rotate-right"></i> Làm mới
        </button>
      </div>
    </div>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Người dùng</th><th>Mã giao dịch</th><th>Ngân hàng</th>
            <th>Số tiền</th><th>Thưởng</th><th>Thời gian</th><th>Thao tác</th>
          </tr>
        </thead>
        <tbody>
          <?php if (empty($pendingTx)): ?>
          <tr class="empty-row"><td colspan="7">Không có giao dịch nào đang chờ duyệt</td></tr>
          <?php else: foreach ($pendingTx as $tx): ?>
          <tr id="row_<?= htmlspecialchars($tx['tx_id'] ?? '') ?>">
            <td>
              <div style="display:flex;align-items:center">
                <span class="avatar"><?= strtoupper(mb_substr($tx['_user'],0,1)) ?></span>
                <?= htmlspecialchars($tx['_user']) ?>
              </div>
            </td>
            <td><span class="code-val"><?= htmlspecialchars($tx['tx_id'] ?? 'N/A') ?></span></td>
            <td style="color:var(--text-2)"><?= htmlspecialchars($tx['method'] ?? 'N/A') ?></td>
            <td><span class="money money-green">+<?= number_format($tx['amount'] ?? 0) ?>đ</span></td>
            <td>
              <?php if (($tx['bonus'] ?? 0) > 0): ?>
                <span class="money money-amber">+<?= number_format($tx['bonus']) ?>đ</span>
              <?php else: ?><span style="color:var(--text-3)">—</span><?php endif; ?>
            </td>
            <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-3)">
              <?= htmlspecialchars($tx['created_at'] ?? 'N/A') ?>
            </td>
            <td>
              <div class="action-row">
                <button class="btn-sm btn-approve" id="abtn_<?= htmlspecialchars($tx['tx_id']??'') ?>"
                  onclick="handleTopup('approve','<?= htmlspecialchars(addslashes($tx['_user'])) ?>','<?= htmlspecialchars(addslashes($tx['tx_id']??'')) ?>')">
                  <i class="fa-solid fa-check"></i> Duyệt
                </button>
                <button class="btn-sm btn-reject" id="rbtn_<?= htmlspecialchars($tx['tx_id']??'') ?>"
                  onclick="handleTopup('reject','<?= htmlspecialchars(addslashes($tx['_user'])) ?>','<?= htmlspecialchars(addslashes($tx['tx_id']??'')) ?>')">
                  <i class="fa-solid fa-xmark"></i> Từ chối
                </button>
              </div>
            </td>
          </tr>
          <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: NGƯỜI DÙNG -->
  <div class="tab-content" id="tab-users">
    <div class="section-title">
      Tất cả người dùng
      <span class="section-count"><?= $totalUsers ?> tài khoản</span>
    </div>
    <div class="search-wrap">
      <i class="fa-solid fa-magnifying-glass search-ico"></i>
      <input type="text" class="search-input" id="searchUser" placeholder="Tìm theo tên đăng nhập...">
    </div>
    <div class="table-wrap">
      <table id="userTable">
        <thead>
          <tr><th>#</th><th>Tên đăng nhập</th><th>Số dư</th><th>Cấp độ</th><th>Ngày tham gia</th><th>Đăng nhập cuối</th><th>Thao tác</th></tr>
        </thead>
        <tbody>
          <?php if (empty($users)): ?>
          <tr class="empty-row"><td colspan="7">Chưa có người dùng nào</td></tr>
          <?php else: $idx=1; foreach ($users as $uname => $udata): ?>
          <tr class="user-row" data-name="<?= strtolower(htmlspecialchars($uname)) ?>">
            <td style="color:var(--text-3);font-family:'Space Mono',monospace;font-size:10px"><?= $idx++ ?></td>
            <td>
              <div style="display:flex;align-items:center">
                <span class="avatar"><?= strtoupper(mb_substr($uname,0,1)) ?></span>
                <span style="font-weight:600"><?= htmlspecialchars($uname) ?></span>
              </div>
            </td>
            <td>
              <span class="money money-amber" id="bal_<?= htmlspecialchars($uname) ?>"><?= number_format($udata['balance'] ?? 0) ?>đ</span>
              <button class="btn-sm btn-edit" onclick="editBalance('<?= htmlspecialchars(addslashes($uname)) ?>',<?= (int)($udata['balance']??0) ?>)">Sửa</button>
            </td>
            <td><span class="badge badge-blue"><?= htmlspecialchars($udata['level'] ?? 'Thành viên') ?></span></td>
            <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-3)"><?= htmlspecialchars($udata['created_at'] ?? 'N/A') ?></td>
            <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-2)"><?= htmlspecialchars($udata['last_login'] ?? 'N/A') ?></td>
            <td>
              <button class="btn-sm btn-neutral" onclick="viewUserDetail('<?= htmlspecialchars(addslashes($uname)) ?>')">
                <i class="fa-solid fa-eye"></i> Xem
              </button>
            </td>
          </tr>
          <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: LỊCH SỬ NẠP -->
  <div class="tab-content" id="tab-topups">
    <div class="section-title">Lịch sử nạp tiền <span class="section-count"><?= count($allTopups) ?> giao dịch</span></div>
    <div class="search-wrap">
      <i class="fa-solid fa-magnifying-glass search-ico"></i>
      <input type="text" class="search-input" id="searchTopup" placeholder="Tìm theo tên đăng nhập hoặc mã giao dịch...">
    </div>
    <div class="table-wrap">
      <table id="topupTable">
        <thead>
          <tr><th>Người dùng</th><th>Mã giao dịch</th><th>Ngân hàng</th><th>Số tiền</th><th>Thưởng</th><th>Trạng thái</th><th>Thời gian</th></tr>
        </thead>
        <tbody>
          <?php if (empty($allTopups)): ?>
          <tr class="empty-row"><td colspan="7">Chưa có giao dịch nào</td></tr>
          <?php else: foreach ($allTopups as $tx):
            $st=$tx['status']??'pending';
            $cls=$st==='approved'?'badge-green':($st==='rejected'?'badge-red':'badge-amber');
            $lbl=$st==='approved'?'Đã duyệt':($st==='rejected'?'Từ chối':'Chờ duyệt');
          ?>
          <tr class="topup-row" data-search="<?= strtolower(htmlspecialchars($tx['_user'].'|'.($tx['tx_id']??''))) ?>">
            <td><div style="display:flex;align-items:center"><span class="avatar"><?= strtoupper(mb_substr($tx['_user'],0,1)) ?></span><?= htmlspecialchars($tx['_user']) ?></div></td>
            <td><span class="code-val"><?= htmlspecialchars($tx['tx_id'] ?? 'N/A') ?></span></td>
            <td style="color:var(--text-2)"><?= htmlspecialchars($tx['method'] ?? 'N/A') ?></td>
            <td><span class="money money-green">+<?= number_format($tx['amount'] ?? 0) ?>đ</span></td>
            <td><?php if(($tx['bonus']??0)>0): ?><span class="money money-amber">+<?= number_format($tx['bonus']) ?>đ</span><?php else: ?><span style="color:var(--text-3)">—</span><?php endif; ?></td>
            <td><span class="badge <?= $cls ?>"><span class="badge-dot <?= $st==='pending'?'blink':'' ?>"></span><?= $lbl ?></span></td>
            <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-3)"><?= htmlspecialchars($tx['created_at'] ?? 'N/A') ?></td>
          </tr>
          <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: QUẢN LÝ KEY -->
  <div class="tab-content" id="tab-keys">
    <div class="section-title">Key đã bán <span class="section-count"><?= count($allKeys) ?> key</span></div>
    <div class="search-wrap">
      <i class="fa-solid fa-magnifying-glass search-ico"></i>
      <input type="text" class="search-input" id="searchKey" placeholder="Tìm theo tên đăng nhập hoặc key...">
    </div>
    <div class="table-wrap">
      <table id="keyTable">
        <thead>
          <tr><th>Người dùng</th><th>Key</th><th>Gói</th><th>Giá</th><th>Trạng thái</th><th>Ngày mua</th><th>Hết hạn</th></tr>
        </thead>
        <tbody>
          <?php if (empty($allKeys)): ?>
          <tr class="empty-row"><td colspan="7">Chưa có key nào được bán</td></tr>
          <?php else:
          $now = new DateTime();
          foreach ($allKeys as $kitem):
            $exp=$kitem['expires_at']??'';
            $isActive=false;
            if($exp&&$exp!=='Vĩnh viễn'){try{$isActive=(new DateTime($exp))>$now;}catch(Exception $e){}}
            else if($exp==='Vĩnh viễn') $isActive=true;
          ?>
          <tr class="key-row" data-search="<?= strtolower(htmlspecialchars($kitem['_user'].'|'.($kitem['key']??''))) ?>">
            <td><div style="display:flex;align-items:center"><span class="avatar"><?= strtoupper(mb_substr($kitem['_user'],0,1)) ?></span><?= htmlspecialchars($kitem['_user']) ?></div></td>
            <td><span class="code-val"><?= htmlspecialchars($kitem['key'] ?? 'N/A') ?></span></td>
            <td style="font-weight:600"><?= htmlspecialchars($kitem['duration'] ?? 'N/A') ?></td>
            <td><span class="money money-amber"><?= number_format($kitem['price'] ?? 0) ?>đ</span></td>
            <td><span class="badge <?= $isActive?'badge-green':'badge-red' ?>"><span class="badge-dot <?= $isActive?'blink':'' ?>"></span><?= $isActive?'Đang dùng':'Hết hạn' ?></span></td>
            <td style="font-family:'Space Mono',monospace;font-size:10px;color:var(--text-3)"><?= htmlspecialchars($kitem['created_at'] ?? 'N/A') ?></td>
            <td style="font-family:'Space Mono',monospace;font-size:10px;color:<?= $isActive?'var(--green)':'var(--red)' ?>"><?= htmlspecialchars($exp?:'N/A') ?></td>
          </tr>
          <?php endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

  <!-- TAB: THỐNG KÊ -->
  <div class="tab-content" id="tab-stats">

    <div class="stats-grid-2" style="margin-bottom:12px">
      <div class="stat-card highlight">
        <div class="stat-icon blue"><i class="fa-solid fa-calendar-day"></i></div>
        <div class="stat-label">Doanh thu hôm nay</div>
        <div class="stat-value" style="font-size:19px"><?= number_format($todayRevenue) ?>đ</div>
      </div>
      <div class="stat-card accent-amber">
        <div class="stat-icon amber"><i class="fa-solid fa-chart-line"></i></div>
        <div class="stat-label">Tổng doanh thu</div>
        <div class="stat-value" style="font-size:19px"><?= number_format($totalRevenue) ?>đ</div>
      </div>
    </div>

    <div class="stats-row-3">
      <div class="stat-card accent-green">
        <div class="stat-icon green"><i class="fa-solid fa-check"></i></div>
        <div class="stat-label">Đã duyệt</div>
        <div class="stat-value" style="color:var(--green)"><?= $stCounts['approved'] ?></div>
      </div>
      <div class="stat-card accent-amber">
        <div class="stat-icon amber"><i class="fa-solid fa-clock"></i></div>
        <div class="stat-label">Chờ duyệt</div>
        <div class="stat-value" style="color:var(--amber)"><?= $stCounts['pending'] ?></div>
      </div>
      <div class="stat-card accent-red">
        <div class="stat-icon red"><i class="fa-solid fa-xmark"></i></div>
        <div class="stat-label">Từ chối</div>
        <div class="stat-value" style="color:var(--red)"><?= $stCounts['rejected'] ?></div>
      </div>
    </div>

    <!-- Charts in Stats -->
    <div class="charts-grid" style="margin-bottom:20px">
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title"><span class="chart-title-dot" style="background:var(--accent)"></span>Doanh thu theo ngày</div>
        </div>
        <div class="chart-container" style="height:200px"><canvas id="revenueChart2"></canvas></div>
      </div>
      <div class="chart-card">
        <div class="chart-header">
          <div class="chart-title"><span class="chart-title-dot" style="background:var(--purple)"></span>Người dùng mới</div>
        </div>
        <div class="chart-container" style="height:200px"><canvas id="userChart2"></canvas></div>
      </div>
    </div>

    <div class="section-title">Doanh thu theo gói key</div>
    <div class="table-wrap" style="margin-bottom:20px">
      <table>
        <thead><tr><th>Gói</th><th>Số key đã bán</th><th>Doanh thu</th></tr></thead>
        <tbody>
          <?php if (empty($keyStats)): ?>
          <tr class="empty-row"><td colspan="3">Chưa có dữ liệu</td></tr>
          <?php else: foreach ($keyStats as $dur => $stat): ?>
          <tr>
            <td style="font-weight:600"><?= htmlspecialchars($dur) ?></td>
            <td>
              <span class="badge badge-purple"><?= $stat['count'] ?> key</span>
            </td>
            <td><span class="money money-amber"><?= number_format($stat['revenue']) ?>đ</span></td>
          </tr>
          <?php endforeach;?>
          <tr style="border-top:2px solid var(--border-2);background:var(--bg)">
            <td style="font-weight:700">Tổng cộng</td>
            <td style="font-weight:700"><?= $totalKeys ?> key</td>
            <td><span class="money money-green" style="font-size:13px"><?= number_format($totalRevenue) ?>đ</span></td>
          </tr>
          <?php endif; ?>
        </tbody>
      </table>
    </div>

    <div class="section-title">Top người dùng nạp nhiều nhất</div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>#</th><th>Tên đăng nhập</th><th>Tổng nạp</th><th>Số dư hiện tại</th></tr></thead>
        <tbody>
          <?php if (empty($topUsers)): ?>
          <tr class="empty-row"><td colspan="4">Chưa có dữ liệu</td></tr>
          <?php else: $rank=1; foreach ($topUsers as $uname => $rev): ?>
          <tr>
            <td style="font-size:16px"><?= $rank===1?'🥇':($rank===2?'🥈':($rank===3?'🥉':'#'.$rank)) ?></td>
            <td><div style="display:flex;align-items:center"><span class="avatar"><?= strtoupper(mb_substr($uname,0,1)) ?></span><span style="font-weight:600"><?= htmlspecialchars($uname) ?></span></div></td>
            <td><span class="money money-green"><?= number_format($rev) ?>đ</span></td>
            <td><span class="money money-amber"><?= number_format($users[$uname]['balance'] ?? 0) ?>đ</span></td>
          </tr>
          <?php $rank++; endforeach; endif; ?>
        </tbody>
      </table>
    </div>
  </div>

</div><!-- end admin-body -->

<div class="toast" id="toast"></div>

<script>
// Chart.js global defaults
Chart.defaults.color = '#3d4f6e';
Chart.defaults.borderColor = '#1e2a42';
Chart.defaults.font.family = "'Space Grotesk', sans-serif";

const revLabels  = <?= $chartRevenueLabels ?>;
const revData    = <?= $chartRevenueData ?>;
const userLabels = <?= $chartUserLabels ?>;
const userData   = <?= $chartUserData ?>;
const keyLabels  = <?= $chartKeyLabels ?>;
const keyData    = <?= $chartKeyData ?>;
const stLabels   = <?= $chartStatusLabels ?>;
const stData     = <?= $chartStatusData ?>;

function makeGradient(ctx, color1, color2) {
  const g = ctx.createLinearGradient(0, 0, 0, 200);
  g.addColorStop(0, color1);
  g.addColorStop(1, color2);
  return g;
}

function buildAreaChart(id, labels, data, color, label) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const grad = makeGradient(ctx, color.replace('1)', '.18)').replace('rgb','rgba'), color.replace('1)', '0)').replace('rgb','rgba'));
  new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        borderWidth: 2,
        fill: true,
        backgroundColor: grad,
        pointBackgroundColor: color,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1420',
          borderColor: '#1e2a42',
          borderWidth: 1,
          titleColor: '#7a8db0',
          bodyColor: '#e8edf8',
          padding: 10,
          callbacks: {
            label: ctx => label + ': ' + (ctx.parsed.y || 0).toLocaleString('vi-VN') + (label.includes('thu') ? 'đ' : '')
          }
        }
      },
      scales: {
        x: {
          grid: { color: 'rgba(30,42,66,.6)' },
          ticks: { font: { size: 10 }, maxRotation: 0 }
        },
        y: {
          grid: { color: 'rgba(30,42,66,.6)' },
          ticks: {
            font: { size: 10 },
            callback: v => label.includes('thu') ? (v/1000)+'k' : v
          },
          beginAtZero: true
        }
      }
    }
  });
}

function buildBarChart(id, labels, data, color, label) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label,
        data,
        backgroundColor: color.replace('1)', '.15)').replace('rgb','rgba'),
        borderColor: color,
        borderWidth: 1.5,
        borderRadius: 6,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1420',
          borderColor: '#1e2a42',
          borderWidth: 1,
          titleColor: '#7a8db0',
          bodyColor: '#e8edf8',
          padding: 10,
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 }, maxRotation: 30 } },
        y: { grid: { color: 'rgba(30,42,66,.6)' }, beginAtZero: true, ticks: { font: { size: 10 }, stepSize: 1 } }
      }
    }
  });
}

// Status donut
function buildDonut(id, labels, data, colors) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  new Chart(canvas.getContext('2d'), {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors, borderColor: '#0f1420', borderWidth: 3, hoverOffset: 6 }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0f1420',
          borderColor: '#1e2a42',
          borderWidth: 1,
          titleColor: '#7a8db0',
          bodyColor: '#e8edf8',
          padding: 10,
        }
      }
    }
  });
}

// Build charts on page load
buildAreaChart('revenueChart',  revLabels,  revData,  'rgb(79,138,255)',  'Doanh thu');
buildAreaChart('revenueChart2', revLabels,  revData,  'rgb(79,138,255)',  'Doanh thu');
buildAreaChart('userChart',     userLabels, userData, 'rgb(167,139,250)', 'Người dùng mới');
buildAreaChart('userChart2',    userLabels, userData, 'rgb(167,139,250)', 'Người dùng mới');
buildDonut('statusChart',  stLabels, stData, ['#2de8a0','#ffbe3d','#ff5b72']);
buildBarChart('keyChart', keyLabels, keyData, 'rgb(255,190,61)', 'Key');

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    document.getElementById('tab-' + this.dataset.tab).classList.add('active');
  });
});

// Toast
function showToast(msg, isErr = false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + (isErr ? 'toast-err' : 'toast-ok') + ' show';
  setTimeout(() => t.classList.remove('show'), 3000);
}

// Approve / Reject
function handleTopup(action, username, txId) {
  const isApprove = action === 'approve';
  Swal.fire({
    icon: isApprove ? 'question' : 'warning',
    title: isApprove ? 'Xác nhận duyệt?' : 'Xác nhận từ chối?',
    html: `Người dùng: <b>${username}</b><br>Mã GD: <b>${txId}</b>`,
    input: 'text',
    inputPlaceholder: 'Ghi chú (không bắt buộc)...',
    showCancelButton: true,
    confirmButtonText: isApprove ? 'Duyệt' : 'Từ chối',
    cancelButtonText: 'Hủy',
    confirmButtonColor: isApprove ? '#2de8a0' : '#ff5b72',
    cancelButtonColor: '#1e2a42',
    background: '#0f1420',
    color: '#e8edf8',
  }).then(r => {
    if (!r.isConfirmed) return;
    const ab = document.getElementById('abtn_' + txId);
    const rb = document.getElementById('rbtn_' + txId);
    if (ab) ab.disabled = true;
    if (rb) rb.disabled = true;
    const fd = new FormData();
    fd.append('action', action);
    fd.append('username', username);
    fd.append('tx_id', txId);
    fd.append('note', r.value || '');
    fetch('approve_topup.php', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('✓ ' + data.message);
          const row = document.getElementById('row_' + txId);
          if (row) { row.style.opacity = '0'; row.style.transition = '.3s'; setTimeout(() => row.remove(), 300); }
          setTimeout(() => location.reload(), 1200);
        } else {
          if (ab) ab.disabled = false;
          if (rb) rb.disabled = false;
          showToast((data.message || 'Lỗi xử lý'), true);
        }
      })
      .catch(() => {
        if (ab) ab.disabled = false;
        if (rb) rb.disabled = false;
        showToast('Lỗi kết nối server', true);
      });
  });
}

function editBalance(username, currentBal) {
  Swal.fire({
    title: 'Sửa số dư',
    html: `Người dùng: <b>${username}</b><br>Số dư hiện tại: <b>${currentBal.toLocaleString('vi-VN')}đ</b>`,
    input: 'number',
    inputValue: currentBal,
    inputAttributes: { min: 0 },
    showCancelButton: true,
    confirmButtonText: 'Lưu',
    cancelButtonText: 'Hủy',
    confirmButtonColor: '#4f8aff',
    cancelButtonColor: '#1e2a42',
    background: '#0f1420',
    color: '#e8edf8',
  }).then(r => {
    if (!r.isConfirmed) return;
    const newBal = parseInt(r.value) || 0;
    const fd = new FormData();
    fd.append('action', 'set_balance');
    fd.append('username', username);
    fd.append('balance', newBal);
    fetch('admin_action.php', { method: 'POST', body: fd })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          document.getElementById('bal_' + username).textContent = newBal.toLocaleString('vi-VN') + 'đ';
          showToast('✓ Đã cập nhật số dư');
        } else {
          showToast(data.message || 'Lỗi', true);
        }
      })
      .catch(() => showToast('Lỗi kết nối', true));
  });
}

function viewUserDetail(username) {
  // Mở tab mới với lịch sử của user đó (admin có thể xem)
  window.open(`lichsunap.php?view_user=${encodeURIComponent(username)}`, '_blank');
}

// Search
document.getElementById('searchUser')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('.user-row').forEach(r => { r.style.display = r.dataset.name.includes(q) ? '' : 'none'; });
});
document.getElementById('searchTopup')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('.topup-row').forEach(r => { r.style.display = r.dataset.search.includes(q) ? '' : 'none'; });
});
document.getElementById('searchKey')?.addEventListener('input', function() {
  const q = this.value.toLowerCase();
  document.querySelectorAll('.key-row').forEach(r => { r.style.display = r.dataset.search.includes(q) ? '' : 'none'; });
});

<?php if ($pendingCount > 0): ?>
setTimeout(() => location.reload(), 60000);
<?php endif; ?>
</script>

<?php endif; ?>
</body>
</html>