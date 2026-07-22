# 🚀 Hướng Dẫn Triển Khai Vua Khoáng Sản

## 📁 Cấu Trúc File Sau Khi Fix

```
vuakhoangsan/
├── index.html           ← Đã cập nhật (import map, meta tags, cache busting)
├── styles.css           ← Giữ nguyên từ bạn
├── app.js               ← Giữ nguyên từ bạn (app_upgraded.js đổi tên)
├── firebase-config.js   ← ✅ FILE MỚI (Firebase config + exports)
├── 404.html             ← ✅ FILE MỚI (GitHub Pages SPA fallback)
├── .gitignore           ← ✅ FILE MỚI
├── firestore.rules      ← ✅ FILE MỚI (Security rules)
└── README.md
```

## 🔧 Các Fix Đã Áp Dụng

1. **Tạo firebase-config.js** — Export đầy đủ các hàm Firebase cho app.js import
2. **Thêm Firebase Import Map** — Tránh lỗi CORS khi import module từ CDN
3. **Thêm crossorigin="anonymous"** — Cho script module app.js
4. **Thêm cache busting (?v=3.0)** — Tránh cache trình duyệt khi update
5. **Thêm meta tags đầy đủ** — Telegram OG tags, theme-color, favicon
6. **Thêm 404.html** — GitHub Pages redirect về index.html cho SPA
7. **Thêm firestore.rules** — Bảo mật database Firebase

## 📤 Triển Khai Lên GitHub Pages

### Bước 1: Tạo Repo
```bash
git init
git add .
git commit -m "Initial deploy v3.0"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/vuakhoangsan.git
git push -u origin main
```

### Bước 2: Bật GitHub Pages
- Vào repo → Settings → Pages
- Source: Deploy from branch → main → /root
- Save → Đợi 1-2 phút

### Bước 3: Cấu Hình Firebase
1. Vào [Firebase Console](https://console.firebase.google.com/)
2. Chọn project `vuakhoangsan-a7689`
3. Firestore Database → Rules → Paste nội dung `firestore.rules` → Publish
4. Authentication → Sign-in method → Bật **Anonymous**

### Bước 4: Cấu Hình Telegram Bot
```bash
curl -X POST "https://api.telegram.org/bot8781327103:AAE63nHgMacJN4gXBVJ7-LEyshLQcgSj9zI/setChatMenuButton"   -H "Content-Type: application/json"   -d '{
    "menu_button": {
      "type": "web_app",
      "text": "🎮 Chơi Ngay",
      "web_app": {
        "url": "https://YOUR_USERNAME.github.io/vuakhoangsan/"
      }
    }
  }'
```

### Bước 5: Test
1. Mở bot trên Telegram → Click "🎮 Chơi Ngay"
2. Kiểm tra avatar, tên, UID hiển thị đúng
3. Test đào quặng, check-in, vòng quay
4. Test admin panel (tap 5 lần vào UID)

---
**TUANX3000 — Deploy Ready! 🎬**
