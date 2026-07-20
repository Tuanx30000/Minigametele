# 🚀 TRIỂN KHAI "VUA ĐÀO QUẶNG" LÊN TELEGRAM MINI APP

## 📁 CẤU TRÚC FILE

```
vuadaoquang/
├── index.html          ← Giao diện chính (đã có)
├── styles.css          ← Stylesheet (đã có)
├── app.js              ← Logic nâng cấp (app_upgraded.js đổi tên)
└── README.md           ← Hướng dẫn này
```

---

## 🔧 BƯỚC 1: TẠO TELEGRAM BOT

### 1.1 Mở @BotFather trên Telegram
- Tìm `@BotFather` trong Telegram → Start
- Gửi lệnh: `/newbot`
- Đặt tên bot: `Vua Đào Quặng`
- Đặt username bot: `VuaDaoQuang_Bot` (phải kết thúc bằng `_bot`)

### 1.2 Lấy Bot Token
BotFather sẽ trả về:
```
Use this token to access the HTTP API:
8781327103:AAE63nHgMacJN4gXBVJ7-LEyshLQcgSj9zI
```
→ **Lưu token này** (đã có trong code, nhưng nếu tạo bot mới thì thay thế)

### 1.3 Bật WebApp cho Bot
Gửi lệnh cho @BotFather:
```
/mybots
```
→ Chọn bot của bạn → **Bot Settings** → **Menu Button** → **Configure menu button**

Hoặc gửi API request:
```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🎮 Chơi Ngay",
      "web_app": {
        "url": "https://YOUR_DOMAIN/index.html"
      }
    }
  }'
```

---

## 🌐 BƯỚC 2: HOSTING — ĐƯA FILE LÊN INTERNET

### Option A: GitHub Pages (FREE — Khuyến nghị)

```bash
# 1. Tạo repo GitHub mới: vuadaoquang
# 2. Upload 3 file (index.html, styles.css, app.js)
# 3. Vào Settings → Pages → Source: Deploy from branch → main → /root
# 4. Đợi 1-2 phút, URL sẽ là:
#    https://YOUR_USERNAME.github.io/vuadaoquang/
```

**Ưu điểm:** Free, SSL tự động, CDN global, dễ cập nhật

### Option B: Cloudflare Pages (FREE)

```bash
# 1. Vào dash.cloudflare.com → Pages → Create a project
# 2. Upload folder chứa 3 file
# 3. Deploy → Lấy URL dạng: https://vuadaoquang.pages.dev
```

### Option C: Vercel (FREE)

```bash
# 1. Vào vercel.com → New Project → Import GitHub repo
# 2. Deploy tự động
# 3. URL: https://vuadaoquang.vercel.app
```

### Option D: Netlify (FREE)

```bash
# 1. Vào app.netlify.com → Add new site → Deploy manually
# 2. Kéo thả folder chứa 3 file
# 3. URL: https://vuadaoquang.netlify.app
```

---

## ⚙️ BƯớc 3: CẤU HÌNH MINI APP

### 3.1 Set WebApp URL cho Bot

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setChatMenuButton" \
  -H "Content-Type: application/json" \
  -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🎮 Chơi Ngay",
      "web_app": {
        "url": "https://YOUR_DOMAIN/index.html"
      }
    }
  }'
```

### 3.2 Set Default WebApp (hiển thị khi mở bot)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setMyDefaultAdministratorRights" \
  -H "Content-Type: application/json" \
  -d '{
    "rights": {},
    "for_channels": false
  }'
```

Hoặc dùng BotFather:
```
/mybots → Chọn bot → Bot Settings → Menu Button → Configure menu button
→ Chọn "Web App" → Nhập URL
```

### 3.3 Set WebApp Short Name (tùy chọn)

```bash
curl -X POST "https://api.telegram.org/bot<TOKEN>/setMyShortDescription" \
  -H "Content-Type: application/json" \
  -d '{
    "short_description": "Game đào quặng kiếm tiền trên Telegram"
  }'
```

---

## 🔗 BƯỚC 4: DEEP LINK (MỜI BẠN BÈ)

Link mời bạn bè:
```
https://t.me/VuaDaoQuang_Bot?start=USER_ID
```

Trong code đã có:
```javascript
const refLinkText = `https://t.me/${BOT_USERNAME}?start=${uid}`;
```

---

## 🧪 BƯỚC 5: TEST

### 5.1 Test trên Desktop
1. Mở bot trong Telegram Desktop
2. Click nút "🎮 Chơi Ngay"
3. Kiểm tra:
   - ✅ Avatar, tên, UID hiển thị đúng
   - ✅ Có thể đào quặng, thu hoạch
   - ✅ Check-in hàng ngày
   - ✅ Mua máy, vòng quay
   - ✅ Rút tiền (test với số dư ảo)

### 5.2 Test trên Mobile
1. Mở Telegram mobile
2. Tìm bot → Start
3. Click "🎮 Chơi Ngay"
4. Kiểm tra responsive, touch, scroll

### 5.3 Test Admin Panel
1. Tap 5 lần vào UID trong Profile
2. Nhập mật khẩu: `5838598093`
3. Kiểm tra các tab: Users, Withdraw, Notify, Giftcode, Config

---

## 🔒 BƯỚC 6: BẢO MẬT (TÙY CHỌN NHƯNG KHUYẾN NGHỊ)

### 6.1 Thay Bot Token
```javascript
// Trong app.js, thay dòng:
const BOT_TOKEN = '8781327103:AAE63nHgMacJN4gXBVJ7-LEyshLQcgSj9zI';
// Thành token bot mới của bạn
```

### 6.2 Thay Admin Password
```javascript
// Thay:
const correctPass = '5838598093';
// Thành password mạnh hơn
```

### 6.3 Enable HTTPS (bắt buộc cho Telegram WebApp)
Tất cả các hosting free ở trên đều tự động cấp SSL/HTTPS.

---

## 📱 BƯỚC 7: TỐI ƯU CHO PRODUCTION

### 7.1 Thêm meta tags (vào `<head>` của index.html)
```html
<meta name="telegram:bot" content="@VuaDaoQuang_Bot">
<meta property="og:title" content="Vua Đào Quặng">
<meta property="og:description" content="Game đào quặng kiếm tiền trên Telegram">
<meta property="og:image" content="https://YOUR_DOMAIN/logo.png">
```

### 7.2 Thêm favicon
```html
<link rel="icon" type="image/png" href="favicon.png">
```

### 7.3 Thêm Service Worker (PWA)
Tạo file `sw.js` để app chạy offline:
```javascript
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open('vuadaoquang-v1').then(cache => {
      return cache.addAll(['/', '/index.html', '/styles.css', '/app.js']);
    })
  );
});
self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
});
```

---

## 🐛 TROUBLESHOOTING

| Lỗi | Nguyên nhân | Cách fix |
|-----|-------------|----------|
| WebApp không mở | URL không HTTPS | Dùng hosting có SSL |
| Avatar không hiển thị | `photo_url` null | Fallback chữ cái đầu đã có |
| Admin không vào được | Sai password | Check `correctPass` trong code |
| Data mất khi refresh | localStorage bị xóa | Bình thường, dùng để test |
| Bot API lỗi | Token sai | Kiểm tra token trong @BotFather |

---

## 🎯 CHECKLIST TRIỂN KHAI

- [ ] Tạo bot @BotFather, lấy token
- [ ] Upload 3 file lên hosting (GitHub Pages / Cloudflare / Vercel)
- [ ] Có URL HTTPS
- [ ] Config WebApp URL trong BotFather
- [ ] Test mở app từ Telegram
- [ ] Test đăng ký user mới
- [ ] Test đào quặng, thu hoạch
- [ ] Test admin panel
- [ ] Test rút tiền + duyệt lệnh
- [ ] Test giftcode
- [ ] Test gửi thông báo toàn server
- [ ] Chia sẻ link mời bạn bè

---

## 📞 HỖ TRỢ

- Telegram WebApp Docs: https://core.telegram.org/bots/webapps
- Bot API: https://core.telegram.org/bots/api
- Mini App Guidelines: https://core.telegram.org/bots/webapps#design-guidelines

**TUANX3000 — Triển khai hoàn tất. Chúc may mắn! 🎬**
