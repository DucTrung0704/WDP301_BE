# Flight Plan API Guide (dành cho Frontend)

## Tổng quan

Hệ thống quản lý kế hoạch bay (Flight Plan) với tính năng **tự động phát hiện xung đột** trước khi cấp phép bay. Mỗi flight plan chứa danh sách **waypoints 4D** (lat, lng, altitude, time).

---

## Lifecycle Flow

```
┌────────┐    edit     ┌────────┐   submit    ┌──────────┐
│  DRAFT │◄───────────│REJECTED│────────────►│  DETECT  │
│        │             │        │              │          │
│        │─────────────┘        │              │          │
│        │     auto reset       │              └────┬─────┘
│        │                      │                   │
│        │──────submit─────────────────────────────►│
│        │                      │              ┌────┴─────┐
│        │                      │     clear    │          │  conflict
└────┬───┘                      │   ┌─────────│          │──────────┐
     │                          │   │         └──────────┘          │
     │ cancel                   │   ▼                               ▼
     │                          │ ┌────────┐                 ┌────────┐
     └──────────────────────────┤►│APPROVED│                 │REJECTED│
                                │ └────────┘                 └────┬───┘
                                │                                 │
                                └─────◄── cancel ─────────────────┘
                                  ┌─────────┐
                                  │CANCELLED│
                                  └─────────┘
```

| Trạng thái    | Cho phép                     | Không cho phép           |
| :------------ | :--------------------------- | :----------------------- |
| **DRAFT**     | Edit, Submit, Cancel, Delete | —                        |
| **REJECTED**  | Edit (→ reset DRAFT), Cancel | Submit trực tiếp, Delete |
| **APPROVED**  | —                            | Edit, Delete, Cancel     |
| **CANCELLED** | —                            | Mọi thao tác             |

---

## Các bước thực hiện

### Bước 1: Tạo Flight Plan (DRAFT)

```
POST /api/flight-plans
Authorization: Bearer <token>
```

```json
{
  "drone": "ObjectId_của_drone",
  "plannedStart": "2026-01-20T08:00:00Z",
  "plannedEnd": "2026-01-20T09:00:00Z",
  "priority": 1,
  "waypoints": [
    {
      "sequenceNumber": 1,
      "latitude": 10.8231,
      "longitude": 106.6297,
      "altitude": 50,
      "speed": 0,
      "estimatedTime": "2026-01-20T08:00:00Z",
      "action": "TAKEOFF"
    },
    {
      "sequenceNumber": 2,
      "latitude": 10.83,
      "longitude": 106.64,
      "altitude": 100,
      "speed": 15,
      "estimatedTime": "2026-01-20T08:30:00Z",
      "action": "WAYPOINT"
    },
    {
      "sequenceNumber": 3,
      "latitude": 10.835,
      "longitude": 106.645,
      "altitude": 50,
      "speed": 10,
      "estimatedTime": "2026-01-20T09:00:00Z",
      "action": "LAND"
    }
  ],
  "notes": "Chuyến bay kiểm tra"
}
```

> **Lưu ý:**
>
> - Cần ít nhất **2 waypoints** (takeoff + land)
> - `plannedEnd` phải sau `plannedStart`
> - `drone` phải thuộc sở hữu của user hiện tại
> - `action` có thể là: `TAKEOFF`, `WAYPOINT`, `HOVER`, `LAND`
> - Hệ thống tự tạo `routeGeometry` (GeoJSON LineString) từ waypoints

---

### Bước 2: Submit để kiểm tra xung đột

```
POST /api/flight-plans/:id/submit
Authorization: Bearer <token>
```

**Response nếu APPROVED** (không có xung đột):

```json
{
  "message": "Flight plan approved — no conflicts detected",
  "approved": true,
  "flightPlan": { "status": "APPROVED", "conflictStatus": "CLEAR", ... },
  "conflicts": []
}
```

**Response nếu REJECTED** (có xung đột):

```json
{
  "message": "Flight plan rejected — conflicts detected",
  "approved": false,
  "flightPlan": { "status": "REJECTED", "conflictStatus": "CONFLICT_DETECTED", ... },
  "conflicts": [
    {
      "_id": "...",
      "flightPlans": ["plan_id_1", "plan_id_2"],
      "predictedCollisionTime": "2026-01-20T08:15:00Z",
      "severity": "HIGH",
      "location": { "type": "Point", "coordinates": [106.635, 10.826] },
      "altitude": 100,
      "detectionMethod": "PAIRWISE",
      "horizontalDistance": 45.23,
      "verticalDistance": 10.5,
      "status": "ACTIVE"
    }
  ]
}
```

> **Thuật toán chạy khi submit:**
>
> 1. **Pairwise 4D Trajectory** — so sánh từng cặp quỹ đạo theo timestep
> 2. **Airspace Segmentation** — chia grid cells + time slots, kiểm tra trùng cell
> 3. **Zone Violation** — kiểm tra route có đi qua no-fly/restricted zone không

---

### Bước 3a: Nếu REJECTED → Sửa và submit lại

```
PUT /api/flight-plans/:id
Authorization: Bearer <token>
```

```json
{
  "waypoints": [
    {
      "sequenceNumber": 1,
      "latitude": 10.8231,
      "longitude": 106.6297,
      "altitude": 50,
      "speed": 0,
      "estimatedTime": "2026-01-20T08:00:00Z",
      "action": "TAKEOFF"
    },
    {
      "sequenceNumber": 2,
      "latitude": 10.85,
      "longitude": 106.66,
      "altitude": 120,
      "speed": 15,
      "estimatedTime": "2026-01-20T08:30:00Z",
      "action": "WAYPOINT"
    },
    {
      "sequenceNumber": 3,
      "latitude": 10.86,
      "longitude": 106.67,
      "altitude": 50,
      "speed": 10,
      "estimatedTime": "2026-01-20T09:00:00Z",
      "action": "LAND"
    }
  ]
}
```

> Khi sửa plan đang **REJECTED**:
>
> - Status tự động reset về **DRAFT**
> - Các conflict cũ bị **dismissed** tự động
> - Có thể submit lại bình thường

---

### Bước 3b: Nếu muốn hủy

```
POST /api/flight-plans/:id/cancel
Authorization: Bearer <token>
```

Có thể cancel từ trạng thái **DRAFT** hoặc **REJECTED**.

---

### Xem danh sách xung đột của 1 flight plan

```
GET /api/flight-plans/:id/conflicts
Authorization: Bearer <token>
```

Trả về mảng `ConflictEvent` với thông tin:

- `severity`: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL`
- `detectionMethod`: `PAIRWISE` | `SEGMENTATION` | `ZONE_VIOLATION`
- `horizontalDistance` / `verticalDistance` (mét)
- `location` + `altitude` (vị trí xung đột)
- `violatedZone` (nếu là zone violation)

---

## Các API endpoint đầy đủ

| Method | Endpoint                          | Mô tả                         | Role                    |
| :----- | :-------------------------------- | :---------------------------- | :---------------------- |
| POST   | `/api/flight-plans`               | Tạo DRAFT                     | Operator                |
| GET    | `/api/flight-plans`               | Danh sách (filter `?status=`) | Operator, Admin         |
| GET    | `/api/flight-plans/:id`           | Chi tiết                      | Operator (owner), Admin |
| PUT    | `/api/flight-plans/:id`           | Sửa (DRAFT/REJECTED)          | Operator (owner)        |
| POST   | `/api/flight-plans/:id/submit`    | Submit → detect               | Operator (owner)        |
| POST   | `/api/flight-plans/:id/cancel`    | Cancel                        | Operator (owner)        |
| GET    | `/api/flight-plans/:id/conflicts` | Xem xung đột                  | Operator (owner), Admin |
| DELETE | `/api/flight-plans/:id`           | Xóa (chỉ DRAFT)               | Operator (owner)        |

### Conflict Management (Admin only)

| Method | Endpoint                     | Mô tả                                            |
| :----- | :--------------------------- | :----------------------------------------------- |
| GET    | `/api/conflicts`             | Tất cả conflicts (filter `?status=`, `?method=`) |
| GET    | `/api/conflicts/:id`         | Chi tiết conflict                                |
| PUT    | `/api/conflicts/:id/resolve` | Resolve + ghi resolution                         |

---

## Waypoint Data Format

| Field            | Type   | Required | Mô tả                                     |
| :--------------- | :----- | :------- | :---------------------------------------- |
| `sequenceNumber` | Number | ✅       | Thứ tự waypoint (bắt đầu từ 1)            |
| `latitude`       | Number | ✅       | Vĩ độ (-90 → 90)                          |
| `longitude`      | Number | ✅       | Kinh độ (-180 → 180)                      |
| `altitude`       | Number | ✅       | Độ cao (meters, ≥ 0)                      |
| `speed`          | Number | ❌       | Tốc độ bay (m/s, default: 10)             |
| `estimatedTime`  | Date   | ✅       | Thời điểm dự kiến tới waypoint            |
| `action`         | String | ❌       | `TAKEOFF` / `WAYPOINT` / `HOVER` / `LAND` |

---

## Severity Levels

| Level        | Khoảng cách | Ý nghĩa                           |
| :----------- | :---------- | :-------------------------------- |
| **CRITICAL** | < 30m       | Nguy hiểm cực cao, cần xử lý ngay |
| **HIGH**     | < 60m       | Nguy hiểm cao                     |
| **MEDIUM**   | < 100m      | Cảnh báo                          |
| **LOW**      | ≥ 100m      | Rủi ro thấp                       |
