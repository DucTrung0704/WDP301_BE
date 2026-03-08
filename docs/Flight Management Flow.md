# TÀI LIỆU HƯỚNG DẪN QUẢN LÝ BAY (FLIGHT MANAGEMENT)

Tài liệu này mô tả chi tiết các luồng làm việc (workflows) và danh sách API (API List) liên quan đến quá trình quản lý bay trong hệ thống UTM. Hệ thống quản lý bay bao gồm 4 module chính:

- **FlightPlan**: Kế hoạch bay (dự kiến).
- **FlightSession**: Phiên bay thực tế.
- **Telemetry**: Dữ liệu viễn trắc (vị trí, pin, tốc độ) gửi từ drone theo thời gian thực.
- **Alert**: Cảnh báo phát sinh trong quá trình bay (xung đột, vi phạm vùng cấm, lệch đường bay, pin yếu).

---

## 1. CÁC LUỒNG LÀM VIỆC CHÍNH (WORKFLOWS)

Hiện tại, hệ thống hỗ trợ 2 hình thức bay:

- **PLANNED**: Bay theo kế hoạch (yêu cầu tạo FlightPlan và được duyệt trước).
- **FREE FLIGHT**: Bay tự do (không cần FlightPlan, ghi nhận dữ liệu thực tế).

### 1.1 Luồng Bay Theo Kế Hoạch (PLANNED)

_Áp dụng cho: `FLEET_OPERATOR`, `INDIVIDUAL_OPERATOR`_

1. **Lập Kế Hoạch**: Nguời dùng tạo FlightPlan (gồm các waypoints, chọn drone).
2. **Xét Duyệt**: Hệ thống tự động kiểm tra xung đột (Pre-flight Conflict Detection).
   - Nếu KHÔNG có xung đột: Trạng thái tự động thành `APPROVED`.
   - Nếu CÓ xung đột: Trạng thái thành `REJECTED`, trả về danh sách Conflict Events. (Có thể gửi duyệt lại nếu sửa đổi thời gian/đường bay).
3. **Bắt Đầu Bay**: Sau khi có FlightPlan đã `APPROVED` và đến giờ bay:
   - Nguời dùng gọi API bắt đầu session PLANNED.
   - Hệ thống tạo FlightSession có `sessionType` là `PLANNED`, trạng thái `IN_PROGRESS`.
   - Drone chuyển sang trạng thái `FLYING`.
4. **Trong Quá Trình Bay**:
   - Drone gửi dữ liệu Telemetry liên tục (qua WebSocket hoặc REST).
   - Hệ thống tự động kiểm tra In-flight Detection sau mỗi lần nhận Telemetry (khoảng 10s/lần). Sinh Alert nếu có vấn đề.
5. **Kết Thúc Bay**:
   - Quá trình bay kết thúc bình thường (gọi API End Session) → Trạng thái `COMPLETED`.
   - Có thể Hủy ngang (Abort) → Trạng thái `ABORTED`.
   - Hạ cánh khẩn cấp (Emergency) → Trạng thái `EMERGENCY_LANDED`.
   - Hệ thống tự động gom các điểm Telemetry đã bay thành `actualRoute` để lưu vào DB.

### 1.2 Luồng Bay Tự Do (FREE_FLIGHT)

_Áp dụng cho: Chỉ `INDIVIDUAL_OPERATOR`_

1. **Bắt Đầu Cất Cánh**: Nguời dùng chọn Drone (phải thuộc sở hữu) và gọi API Start Free Flight.
2. **Khởi Tạo Phiên**: Không cần FlightPlan. Tạo thẳng FlightSession có `sessionType` là `FREE_FLIGHT`, trạng thái `IN_PROGRESS`. Drone chuyển sang `FLYING`.
3. **Trong Quá Trình Bay**: Chạy tương tự như PLANNED. Tuy nhiên, ở module In-flight Detection, bước kiểm tra **Lệch đường bay (Deviation)** sẽ được bỏ qua vì không có đường đi dự kiến.
4. **Lưu Lại Dữ Liệu**: Tương tự quy trình PLANNED, khi kết thúc session, chuỗi toạ độ thực tế sẽ được build lại thành route và lưu.

### 1.3 In-Flight Alerting & Telemetry Flow

- **Client (Frontend/Drone)** kết nối **WebSocket** vào hệ thống (`ws://domain/ws?token=...`).
- **Telemetry Ingestion**: Drone gửi bản tin Telemetry tới WebSocket. Server tự động lưu vào Database.
- **In-flight Detection**:
  - `Proximity`: Kiểm tra xem có drone nào khác đang bay quá gần không.
  - `Zone Violation`: Kiểm tra tọa độ hiện tại có lọt vào vùng cấm / hạn chế không.
  - `Deviation`: Kiểm tra sai lệch với kế hoạch (chỉ với PLANNED).
  - `Battery`: Kiểm tra mức pin.
- **Alert Broadcast**: Nếu In-flight Detection phát hiện vấn đề, Alert được tạo vào DB và **broadcast** qua WebSocket ngay lập tức cho Frontend.

---

## 2. DANH SÁCH API (API LIST)

Lưu ý: Header phải chứa `Authorization: Bearer <token>`.

### 2.1 Flight Session API

| Method   | Endpoint                             | Description                                                                            | Role Allowed             |
| -------- | ------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------ |
| **POST** | `/api/flight-sessions/start`         | Bắt đầu bay theo kế hoạch. Yêu cầu body `{ flightPlanId }`. Session type là `PLANNED`. | FLEET, INDIVIDUAL        |
| **POST** | `/api/flight-sessions/free-flight`   | Bắt đầu bay tự do. Yêu cầu body `{ droneId }`. Session type là `FREE_FLIGHT`.          | INDIVIDUAL               |
| **GET**  | `/api/flight-sessions`               | Danh sách session. Hỗ trợ filter theo `status`, `sessionType`.                         | Admin, FLEET, INDIVIDUAL |
| **GET**  | `/api/flight-sessions/:id`           | Xem chi tiết 1 phiên bay.                                                              | Admin, FLEET, INDIVIDUAL |
| **POST** | `/api/flight-sessions/:id/end`       | Kết thúc phiên bay thành công (`COMPLETED`) và gộp dữ liệu đường bay.                  | FLEET, INDIVIDUAL        |
| **POST** | `/api/flight-sessions/:id/abort`     | Hủy ngang phiên bay (`ABORTED`).                                                       | FLEET, INDIVIDUAL        |
| **POST** | `/api/flight-sessions/:id/emergency` | Cập nhật hạ cánh khẩn cấp (`EMERGENCY_LANDED`).                                        | FLEET, INDIVIDUAL        |
| **GET**  | `/api/flight-sessions/:id/telemetry` | Xem lịch sử dữ liệu thu thập (viễn trắc) của phiên bay này.                            | Admin, FLEET, INDIVIDUAL |
| **GET**  | `/api/flight-sessions/:id/alerts`    | Xem danh sách các cảnh báo từng xuất hiện trong phiên bay này.                         | Admin, FLEET, INDIVIDUAL |

### 2.2 Telemetry API & WebSocket

| Method   | Endpoint / WS               | Description                                                                                                                                                                            | Role Allowed             |
| -------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **WS**   | `ws://domain/ws`            | Nhận JWT qua query `?token=` hoặc message `auth`. <br>Gửi tin nhắn `{"type": "telemetry", "sessionId": "...", "data": {"lat", "lng", "altitude", "speed", "heading", "batteryLevel"}}` | All                      |
| **POST** | `/api/telemetry`            | API dự phòng (REST fallback) nếu đường truyền WS hỏng. Nhận payload tương đương JSON gửi qua WS.                                                                                       | FLEET, INDIVIDUAL        |
| **GET**  | `/api/telemetry/:sessionId` | (Alias của `/api/flight-sessions/:id/telemetry`)                                                                                                                                       | Admin, FLEET, INDIVIDUAL |

### 2.3 Alert API

| Method  | Endpoint                      | Description                                                                                                                              | Role Allowed             |
| ------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| **GET** | `/api/alerts`                 | Danh sách alert. Filter theo `flightSession`, `type`, `status`. Operator chỉ thấy alert của mình, Admin thấy toàn cảnh.                  | Admin, FLEET, INDIVIDUAL |
| **GET** | `/api/alerts/:id`             | Chi tiết một alert (kèm data mở rộng tùy ngữ cảnh).                                                                                      | Admin, FLEET, INDIVIDUAL |
| **PUT** | `/api/alerts/:id/acknowledge` | Cập nhật trạng thái alert từ `ACTIVE` thành `ACKNOWLEDGED`.                                                                              | Admin, FLEET, INDIVIDUAL |
| **WS**  | `ws://domain/ws`              | Client gửi `{"type": "watch_session", "sessionId": "..."}` để subscribe. Nếu có alert, Server trả về `{"type": "alert", "alert": {...}}` | All                      |

### 2.4 (Bonus) Flight Plan API Summary

Được thực hiện trong bước trước (chỉ liệt kê tóm tắt).
| Method | Endpoint | Description |
| --- | --- | --- |
| **POST** | `/api/flight-plans` | Tạo bản thảo (DRAFT) kế hoạch bay. |
| **PUT** | `/api/flight-plans/:id` | Cập nhật thông tin lúc còn nháp. |
| **POST** | `/api/flight-plans/:id/submit` | Gửi hệ thống chạy Auto Detection. Tự động chuyển `APPROVED` hoặc `REJECTED`. |
| **GET** | `/api/flight-plans` | Lấy danh sách kế hoạch bay. |
