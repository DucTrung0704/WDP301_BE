# Hướng dẫn kết nối Socket.IO (Frontend)

Hệ thống Real-time của WDP301 đã được chuyển đổi từ thư viện `ws` thuần túy sang **Socket.IO**. Tài liệu này hướng dẫn cách kết nối và gửi/nhận dữ liệu từ phía Frontend (React/Vue/Vanilla JS).

## 1. Cài đặt thư viện

Bạn cần cài đặt thư viện `socket.io-client` vào project Frontend của bạn.
Lưu ý: **Không** dùng API `WebSocket` có sẵn của trình duyệt.

```bash
npm install socket.io-client
# hoặc
yarn add socket.io-client
```

---

## 2. Khởi tạo & Kết nối (Authentication)

Backend yêu cầu xác thực JWT (JSON Web Token) ngay khi kết nối. Token nầy là token bạn nhận được sau khi gọi API Login.
Endpoint để kết nối là: `[URL_BACKEND]` và đường dẫn (path) là `/ws`.

```javascript
import { io } from "socket.io-client";

const BACKEND_URL = "http://localhost:3000"; // URL API backend của bạn
const JWT_TOKEN = "eyJhbGciOiJIUzI1NiIsInR5..."; // Token lấy từ localStorage/Redux/...

// Khởi tạo connection
const socket = io(BACKEND_URL, {
  path: "/ws",
  auth: {
    token: JWT_TOKEN, // Truyền token vào object auth
  },
});

// Các sự kiện kết nối cơ bản
socket.on("connect", () => {
  console.log("✅ Socket.IO đã kết nối với ID:", socket.id);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Đã ngắt kết nối Socket.IO. Lý do:", reason);
  // Socket.IO sẽ tự động kết nối lại (auto-reconnect) nếu do rớt mạng.
});

socket.on("connect_error", (error) => {
  console.error("❌ Lỗi kết nối Socket:", error.message);
  // Thường do sai JWT token hoặc backend chưa bật
});
```

---

## 3. Các sự kiện (Events) của hệ thống

Hệ thống sử dụng cơ chế Event-driven. Dưới đây là danh sách các sự kiện mà bạn có thể `emit` (gửi lên server) và `on` (lắng nghe từ server).

### 3.1 Gửi dữ liệu Telemetry (Từ Drone lên Server)

Áp dụng cho Frontend/Client đang đóng vai trò điều khiển hoặc mô phỏng Drone.

**Gửi dữ liệu:**
Sử dụng sự kiện: `telemetry`

```javascript
socket.emit("telemetry", {
  sessionId: "ID_CUA_FLIGHT_SESSION", // Bắt buộc
  data: {
    lat: 10.8231, // Vĩ độ
    lng: 106.6297, // Kinh độ
    altitude: 120, // Độ cao (mét)
    speed: 15, // Tốc độ (m/s)
    heading: 90, // Hướng bay (độ)
    batteryLevel: 85, // Phần trăm pin
  },
});
```

**Nhận phản hồi xác nhận lưu thành công:**
Sử dụng sự kiện: `telemetry_ack`

```javascript
socket.on("telemetry_ack", (ack) => {
  console.log("✅ Đã lưu Telemetry với ID:", ack.telemetryId);
  console.log("Thời gian:", ack.timestamp);
});
```

### 3.2 Lắng nghe Cảnh báo / Theo dõi phiên bay (Dành cho Dashboard/Monitor)

Áp dụng cho Frontend hiển thị bản đồ, theo dõi trực tiếp một chuyến bay.
Bạn phải báo cho server biết bạn muốn xem `sessionId` nào thì mới nhận được cảnh báo của `sessionId` đó.

**Bắt đầu theo dõi:**
Sử dụng sự kiện: `watch_session`

```javascript
socket.emit("watch_session", {
  sessionId: "ID_CUA_FLIGHT_SESSION",
});
```

**Xác nhận đã bắt đầu theo dõi thành công:**
Sử dụng sự kiện: `watching`

```javascript
socket.on("watching", (data) => {
  console.log("👁️ Đang theo dõi session:", data.sessionId);
});
```

**Nhận các cảnh báo (Alert) của session đó:**
Sử dụng sự kiện: `alert`

```javascript
// Sự kiện này sẽ được kích hoạt mỗi khi backend phát hiện bất thường (ví dụ: mất vùng, quá tốc độ, v.v...)
socket.on("alert", (alertData) => {
  console.log("🚨 CẢNH BÁO MỚI NHẬN ĐƯỢC:", alertData);

  // Thông tin bên trong alertData thường có dạng:
  // {
  //   type: "OUT_OF_BOUNDS" | "SPEED_WARNING" | ...,
  //   severity: "warning" | "critical",
  //   message: "Mô tả lõi cảnh báo",
  //   data: { ... các thông tin đính kèm phụ ... }
  // }
});
```

---

## 4. Xử lý Lỗi (Error Handling)

Nếu bạn gửi thiếu thông tin hoặc gọi sự kiện sai cách, Backend sẽ phản hồi lại thông qua sự kiện `error`.

```javascript
socket.on("error", (errorInfo) => {
  console.error("❌ Lỗi từ Server trả về:", errorInfo.message);
  // Ví dụ: errorInfo.message === "sessionId and data are required"
});
```

## 5. Dọn dẹp (Cleanup) khi component unmount

Trong React/Vue, khi component giám sát bản đồ bị hủy (unmount), hãy nhớ dọn dẹp các event listener và ngắt kết nối để tránh memory leak.

**Ví dụ React (`useEffect` cleanup):**

```javascript
import { useEffect } from "react";

useEffect(() => {
  // 1. Kết nối và đăng ký listener ở đây...

  return () => {
    // 2. Dọn dẹp ở đây
    socket.off("connect");
    socket.off("alert");
    socket.off("telemetry_ack");
    // Nếu chuyển trang khác không cần socket nữa, ngắt kết nối hẳn:
    socket.disconnect();
  };
}, []);
```
