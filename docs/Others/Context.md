# WDP301 Backend - Project Context Document

> **Tài liệu tổng quan dự án cho AI Agents**  
> Phiên bản: 1.0  
> Cập nhật: March 2026

---

## 📋 Tổng quan dự án

**WDP301_BE** là hệ thống backend cho **UTM (Unmanned Traffic Management System)** - Hệ thống quản lý giao thông không người lái. Dự án được phát triển bằng **Node.js + Express.js + MongoDB**, tích hợp **Redis Streams** cho xử lý telemetry real-time và **Socket.IO** cho giao tiếp WebSocket.

### Mục tiêu chính
- Quản lý kế hoạch bay (Flight Plans) với phát hiện xung đột tự động
- Theo dõi drone real-time qua telemetry data
- Phát hiện và cảnh báo xung đột trong quá trình bay
- Quản lý vùng bay (zones) và kiểm tra vi phạm không phận
- Hỗ trợ cả bay theo kế hoạch (PLANNED) và bay tự do (FREE_FLIGHT)

### Công nghệ sử dụng
- **Runtime**: Node.js
- **Framework**: Express.js 4.22.1
- **Database**: MongoDB 9.1.2 (với Mongoose ODM)
- **Cache & Message Queue**: Redis 4.7.1 (Redis Streams)
- **Real-time Communication**: Socket.IO 4.8.3
- **Authentication**: JWT (jsonwebtoken 9.0.3)
- **API Documentation**: Swagger (swagger-jsdoc, swagger-ui-express)
- **Payment Integration**: SePay PG Node
- **Testing**: Jest 30.2.0

---

## 🏗️ Kiến trúc hệ thống

### Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React/Vue)                      │
│              HTTP REST API + WebSocket (Socket.IO)           │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│                   Express.js Backend                         │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   REST API   │  │  WebSocket   │  │   Worker     │      │
│  │  Controllers │  │   Gateway    │  │   Process    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                  │                  │              │
└─────────┼──────────────────┼──────────────────┼──────────────┘
          │                  │                  │
          ▼                  ▼                  ▼
┌─────────────────┐  ┌──────────────┐  ┌──────────────┐
│    MongoDB      │  │ Redis Cache  │  │Redis Streams │
│  (Persistent)   │  │ (Latest Pos) │  │(Message Queue)│
└─────────────────┘  └──────────────┘  └──────────────┘
```

### Luồng xử lý Telemetry (High-Performance Architecture)

```
Drone/Client
    │
    ├─→ WebSocket (Socket.IO) ─→ Validate & Auth
    │                                │
    │                                ├─→ Redis Cache (Latest Location, 1h TTL)
    │                                │
    │                                └─→ Redis Streams (Message Queue)
    │                                         │
    │                                         ▼
    │                                  Telemetry Worker
    │                                  (Batch Processing)
    │                                         │
    │                                         ├─→ Sampling (90% reduction)
    │                                         │
    │                                         ├─→ Batch Insert (1000 records/5s)
    │                                         │
    │                                         └─→ MongoDB (with TTL: 7 days)
    │
    └─→ In-flight Detection ─→ Alert Generation ─→ WebSocket Broadcast
```

**Đặc điểm kiến trúc:**
- **Decouple ingestion và storage**: WebSocket không ghi trực tiếp vào DB
- **Redis Streams**: Message queue thay thế Kafka cho hệ thống vừa và nhỏ
- **Worker Batch Processing**: Giảm 90% DB writes
- **Real-time Cache**: Redis lưu vị trí mới nhất cho dashboard
- **Scalable**: Hỗ trợ multiple workers và horizontal scaling

---

## 📁 Cấu trúc thư mục

```
WDP301_BE/
├── app.js                          # Main Express application
├── package.json                    # Dependencies & scripts
├── .env.example                    # Environment variables template
├── swagger.config.js               # Swagger API documentation config
├── docker-compose.yml              # Docker services (MongoDB, Redis)
│
├── bin/
│   └── www                         # Server startup script
│
├── controllers/                    # REST API Controllers
│   ├── admin.controller.js         # Admin CRUD operations
│   ├── auth.controller.js          # Login, Register, Google OAuth
│   ├── drone.controller.js         # Drone management
│   ├── user.controller.js          # User profile management
│   ├── zone.controller.js          # Airspace zone management
│   ├── flight.controller.js        # Flight history
│   ├── package.controller.js       # Subscription packages
│   ├── sepay.controller.js         # Payment webhook
│   └── favourite.controller.js     # User favorites
│
├── routes/                         # Express route definitions
│   ├── admin.routes.js
│   ├── auth.routes.js
│   ├── drone.routes.js
│   ├── user.routes.js
│   ├── zone.routes.js
│   ├── flight.routes.js
│   ├── package.routes.js
│   ├── sepay.routes.js
│   └── favourite.routes.js
│
├── models/                         # Mongoose schemas (legacy)
│   ├── user.models.js              # User, Operator schemas
│   ├── drone.model.js              # Drone schema
│   ├── zone.model.js               # Airspace zone schema
│   ├── flight.model.js             # Flight history schema
│   ├── package.model.js            # Subscription package
│   ├── payment.model.js            # Payment transaction
│   └── favourite.model.js          # User favorites
│
├── src/
│   ├── config/                     # Configuration modules
│   │   ├── redis.js                # Redis client & Streams operations
│   │   ├── websocket.js            # Socket.IO server setup
│   │   └── kdbush.js               # Spatial indexing for nearby drones
│   │
│   ├── workers/                    # Background workers
│   │   └── telemetryRedisWorker.js # Batch processor for telemetry
│   │
│   └── modules/                    # Feature modules (modular architecture)
│       ├── flightPlan/             # Flight plan management
│       │   ├── flightPlan.model.js
│       │   ├── flightPlan.controller.js
│       │   ├── flightPlan.routes.js
│       │   └── flightPlan.service.js
│       │
│       ├── flightSession/          # Flight session (actual flights)
│       │   ├── flightSession.model.js
│       │   ├── flightSession.controller.js
│       │   ├── flightSession.routes.js
│       │   └── flightSession.service.js
│       │
│       ├── telemetry/              # Telemetry data ingestion
│       │   ├── telemetry.model.js
│       │   ├── telemetry.controller.js
│       │   └── telemetry.routes.js
│       │
│       ├── alert/                  # In-flight alerts
│       │   ├── alert.model.js
│       │   ├── alert.controller.js
│       │   ├── alert.routes.js
│       │   └── alert.service.js
│       │
│       ├── conflict/               # Conflict detection
│       │   ├── conflictEvent.model.js
│       │   ├── conflict.controller.js
│       │   ├── conflict.routes.js
│       │   ├── conflictDetection.service.js    # Pre-flight detection
│       │   ├── inflightDetection.service.js    # In-flight detection
│       │   └── zoneConflict.service.js         # Zone violation check
│       │
│       ├── mission/                # Mission planning & scheduling
│       │   ├── mission.model.js
│       │   ├── missionPlan.model.js
│       │   ├── mission.controller.js
│       │   ├── mission.routes.js
│       │   └── mission.service.js
│       │
│       └── nearby/                 # Nearby drones detection
│           ├── nearby.service.js
│           └── kdbushIndex.js
│
├── middleware/                     # Express middlewares
│   └── auth.middleware.js          # JWT authentication
│
├── scripts/                        # Utility scripts
│   ├── quick-start.sh              # Docker quick start
│   └── test-telemetry.js           # Telemetry load testing
│
├── tests/                          # Test suites
│   └── conflict/
│       └── conflictDetection.test.js
│
├── docs/                           # Documentation
│   ├── ERD.md                      # Entity Relationship Diagram
│   ├── Flight Management Flow.md   # Flight workflow guide
│   ├── Flight Plan API Guide.md    # API documentation
│   ├── Socket Connection Guide.md  # WebSocket integration guide
│   ├── Telemetry Architecture.md   # Telemetry system design
│   ├── Conflict Detection/         # Conflict detection algorithms
│   │   ├── Strategic conflict detection.md
│   │   ├── Explain.md
│   │   ├── Implementation.md
│   │   └── Multi-level Conflict Detection.md
│   ├── Performance/
│   ├── Nearby Drones Display/
│   └── Others/
│       └── Context.md              # This file
│
├── CODE_REVIEW_OPTIMIZATION_STRATEGY.md  # Performance optimization guide
└── REDIS_SETUP.md                        # Redis Streams setup guide
```

---

## 🗄️ Data Models (Schemas)

### Core Entities

#### 1. User & Operator
```javascript
User {
  email: String (unique)
  password: String (hashed with bcrypt)
  name: String
  role: Enum ["ADMIN", "FLEET_OPERATOR", "INDIVIDUAL_OPERATOR"]
  googleId: String (optional, for OAuth)
  isActive: Boolean
  package: ObjectId -> Package
  packageExpiry: Date
}
```

#### 2. Drone
```javascript
Drone {
  serialNumber: String (unique)
  manufacturer: String
  model: String
  owner: ObjectId -> User
  maxSpeed: Number (m/s)
  maxAltitude: Number (meters)
  maxFlightTime: Number (minutes)
  status: Enum ["AVAILABLE", "FLYING", "MAINTENANCE", "RETIRED"]
  batteryCapacity: Number (mAh)
  currentBatteryLevel: Number (%)
}
```

#### 3. Zone (Airspace)
```javascript
Zone {
  name: String
  type: Enum ["NO_FLY", "RESTRICTED", "CONTROLLED", "UNCONTROLLED"]
  geometry: GeoJSON Polygon
  minAltitude: Number
  maxAltitude: Number
  activeFrom: Date
  activeTo: Date
  authority: String
  restrictions: String
}
```

### Flight Management Entities

#### 4. FlightPlan (Kế hoạch bay)
```javascript
FlightPlan {
  drone: ObjectId -> Drone
  pilot: ObjectId -> User
  status: Enum ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"]
  priority: Number (1-10)
  waypoints: [Waypoint] {
    sequenceNumber: Number
    latitude: Number (-90 to 90)
    longitude: Number (-180 to 180)
    altitude: Number (meters, >= 0)
    speed: Number (m/s, default: 10)
    estimatedTime: Date
    action: Enum ["TAKEOFF", "WAYPOINT", "HOVER", "LAND"]
  }
  routeGeometry: GeoJSON LineString (auto-generated)
  conflictStatus: Enum ["CLEAR", "CONFLICT_DETECTED", "RESOLVED"]
  notes: String
  createdAt: Date
  updatedAt: Date
}
```

#### 5. FlightSession (Phiên bay thực tế)
```javascript
FlightSession {
  flightPlan: ObjectId -> FlightPlan (optional, null for FREE_FLIGHT)
  drone: ObjectId -> Drone
  pilot: ObjectId -> User
  sessionType: Enum ["PLANNED", "FREE_FLIGHT"]
  status: Enum ["STARTING", "IN_PROGRESS", "COMPLETED", "ABORTED", "EMERGENCY_LANDED"]
  actualStart: Date
  actualEnd: Date
  actualRoute: GeoJSON LineString (built from telemetry)
  notes: String
  createdAt: Date
  updatedAt: Date
}
```

#### 6. Telemetry (Dữ liệu viễn trắc)
```javascript
Telemetry {
  drone: ObjectId -> Drone
  flightSession: ObjectId -> FlightSession
  timestamp: Date
  location: GeoJSON Point [lng, lat]
  altitude: Number (meters)
  speed: Number (m/s)
  heading: Number (0-360 degrees)
  batteryLevel: Number (0-100%)
  isSampled: Boolean (for sampling tracking)
  createdAt: Date
  // TTL: Auto-delete after 7 days
}
```

#### 7. Alert (Cảnh báo trong bay)
```javascript
Alert {
  flightSession: ObjectId -> FlightSession
  drone: ObjectId -> Drone
  type: Enum ["CONFLICT", "ZONE_VIOLATION", "DEVIATION", "BATTERY_LOW", "CONNECTION_LOST"]
  severity: Enum ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
  message: String
  location: GeoJSON Point
  altitude: Number
  data: Mixed {
    // CONFLICT: { conflictEventId, otherDroneId, distance }
    // ZONE_VIOLATION: { zoneId, zoneName, zoneType }
    // DEVIATION: { expectedLat, expectedLng, deviationDistance }
    // BATTERY_LOW: { batteryLevel, threshold }
  }
  status: Enum ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"]
  createdAt: Date
}
```

#### 8. ConflictEvent (Xung đột phát hiện)
```javascript
ConflictEvent {
  flightPlans: [ObjectId] -> FlightPlan (array of conflicting plans)
  detectedAt: Date
  predictedCollisionTime: Date
  severity: Enum ["LOW", "MEDIUM", "HIGH", "CRITICAL"]
  location: GeoJSON Point
  altitude: Number
  detectionMethod: Enum ["PAIRWISE", "SEGMENTATION", "ZONE_VIOLATION"]
  horizontalDistance: Number (meters)
  verticalDistance: Number (meters)
  status: Enum ["ACTIVE", "RESOLVED", "DISMISSED"]
  resolution: String
  violatedZone: ObjectId -> Zone (if ZONE_VIOLATION)
}
```

#### 9. Mission & MissionPlan
```javascript
Mission {
  name: String
  operator: ObjectId -> User
  status: Enum ["DRAFT", "SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]
  startDate: Date
  endDate: Date
  description: String
}

MissionPlan {
  mission: ObjectId -> Mission
  flightPlan: ObjectId -> FlightPlan
  scheduledDate: Date
  executionOrder: Number
  status: Enum ["PENDING", "APPROVED", "EXECUTED", "CANCELLED"]
}
```

---

## 🔄 Luồng nghiệp vụ chính

### 1. Luồng Bay Theo Kế Hoạch (PLANNED Flight)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. TẠO KẾ HOẠCH BAY (Flight Plan)                          │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ POST /api/flight-plans
    │   Body: { drone, waypoints, plannedStart, plannedEnd }
    │   → Status: DRAFT
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. SUBMIT ĐỂ KIỂM TRA XUNG ĐỘT                             │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ POST /api/flight-plans/:id/submit
    │   → Run Pre-flight Conflict Detection:
    │      • Pairwise 4D Trajectory Check
    │      • Airspace Segmentation Check
    │      • Zone Violation Check
    │
    ├─→ Nếu KHÔNG có xung đột:
    │   → Status: APPROVED
    │   → conflictStatus: CLEAR
    │
    └─→ Nếu CÓ xung đột:
        → Status: REJECTED
        → conflictStatus: CONFLICT_DETECTED
        → Trả về danh sách ConflictEvent
        → Có thể sửa và submit lại
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. BẮT ĐẦU BAY (Start Flight Session)                       │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ POST /api/flight-sessions/start
    │   Body: { flightPlanId }
    │   → Tạo FlightSession với sessionType: PLANNED
    │   → Status: IN_PROGRESS
    │   → Drone status: FLYING
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. GỬI TELEMETRY REAL-TIME                                  │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ WebSocket: socket.emit("telemetry", { sessionId, data })
    │   → Lưu vào Redis Cache (latest location)
    │   → Push vào Redis Streams
    │   → Worker batch insert vào MongoDB
    │   → Run In-flight Detection:
    │      • Proximity Check (xung đột với drone khác)
    │      • Zone Violation Check
    │      • Deviation Check (lệch khỏi kế hoạch)
    │      • Battery Check
    │   → Nếu phát hiện vấn đề → Tạo Alert → Broadcast qua WebSocket
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. KẾT THÚC BAY                                             │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ POST /api/flight-sessions/:id/end
    │   → Status: COMPLETED
    │   → Build actualRoute từ telemetry points
    │   → Drone status: AVAILABLE
    │
    ├─→ POST /api/flight-sessions/:id/abort
    │   → Status: ABORTED
    │
    └─→ POST /api/flight-sessions/:id/emergency
        → Status: EMERGENCY_LANDED
```

### 2. Luồng Bay Tự Do (FREE_FLIGHT)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BẮT ĐẦU BAY TỰ DO                                        │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ POST /api/flight-sessions/free-flight
    │   Body: { droneId }
    │   → Tạo FlightSession với sessionType: FREE_FLIGHT
    │   → flightPlan: null
    │   → Status: IN_PROGRESS
    │   → Drone status: FLYING
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. GỬI TELEMETRY & IN-FLIGHT DETECTION                      │
└─────────────────────────────────────────────────────────────┘
    │
    ├─→ Tương tự PLANNED, nhưng KHÔNG kiểm tra Deviation
    │   (vì không có kế hoạch để so sánh)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. KẾT THÚC BAY                                             │
└─────────────────────────────────────────────────────────────┘
    │
    └─→ Tương tự PLANNED
```

### 3. Conflict Detection (2 cấp độ)

#### Pre-flight Detection (Strategic Deconfliction - ICAO Level 3)
```
Khi submit FlightPlan:
1. Pairwise 4D Trajectory Detection
   - So sánh từng cặp flight plan
   - Tính khoảng cách tại mỗi timestep
   - Phát hiện nếu: d_horizontal < D_MIN && d_vertical < H_MIN
   - Độ phức tạp: O(n²)

2. Airspace Segmentation Detection
   - Chia không gian thành grid cells 3D
   - Chia thời gian thành time slots
   - Kiểm tra occupancy map
   - Phát hiện nếu: ≥2 UAV trong cùng (cell, time)
   - Độ phức tạp: O(n)

3. Zone Violation Detection
   - Kiểm tra route có đi qua no-fly/restricted zone
   - Sử dụng MongoDB geospatial query
```

#### In-flight Detection (Tactical Deconfliction)
```
Khi nhận telemetry real-time:
1. Proximity Check
   - Lấy vị trí các drone khác từ Redis Cache
   - Tính khoảng cách với drone hiện tại
   - Tạo Alert nếu quá gần

2. Zone Violation Check
   - Kiểm tra tọa độ hiện tại có trong vùng cấm

3. Deviation Check (chỉ PLANNED)
   - So sánh vị trí thực tế vs kế hoạch
   - Tạo Alert nếu lệch quá xa

4. Battery Check
   - Kiểm tra mức pin
   - Cảnh báo nếu < ngưỡng
```

---

## 🔌 API Endpoints

### Authentication & User Management
```
POST   /api/auth/register          # Đăng ký tài khoản
POST   /api/auth/login             # Đăng nhập (JWT)
POST   /api/auth/google            # Google OAuth login
GET    /api/users/profile          # Xem profile
PUT    /api/users/profile          # Cập nhật profile
GET    /api/users                  # Danh sách users (Admin)
```

### Drone Management
```
POST   /api/drones                 # Tạo drone mới
GET    /api/drones                 # Danh sách drones
GET    /api/drones/:id             # Chi tiết drone
PUT    /api/drones/:id             # Cập nhật drone
DELETE /api/drones/:id             # Xóa drone
```

### Zone Management
```
POST   /api/zones                  # Tạo zone (Admin)
GET    /api/zones                  # Danh sách zones
GET    /api/zones/:id              # Chi tiết zone
PUT    /api/zones/:id              # Cập nhật zone (Admin)
DELETE /api/zones/:id              # Xóa zone (Admin)
GET    /api/zones/check-point      # Kiểm tra điểm có trong zone
```

### Flight Plan
```
POST   /api/flight-plans           # Tạo DRAFT
GET    /api/flight-plans           # Danh sách (filter: status, drone, pilot)
GET    /api/flight-plans/:id       # Chi tiết
PUT    /api/flight-plans/:id       # Cập nhật (DRAFT/REJECTED)
DELETE /api/flight-plans/:id       # Xóa (chỉ DRAFT)
POST   /api/flight-plans/:id/submit    # Submit → Auto detect conflicts
POST   /api/flight-plans/:id/cancel    # Cancel plan
GET    /api/flight-plans/:id/conflicts # Xem conflicts
```

### Flight Session
```
POST   /api/flight-sessions/start          # Bắt đầu PLANNED flight
POST   /api/flight-sessions/free-flight    # Bắt đầu FREE_FLIGHT
GET    /api/flight-sessions                # Danh sách sessions
GET    /api/flight-sessions/:id            # Chi tiết session
POST   /api/flight-sessions/:id/end        # Kết thúc (COMPLETED)
POST   /api/flight-sessions/:id/abort      # Hủy (ABORTED)
POST   /api/flight-sessions/:id/emergency  # Khẩn cấp (EMERGENCY_LANDED)
GET    /api/flight-sessions/:id/telemetry  # Lịch sử telemetry
GET    /api/flight-sessions/:id/alerts     # Danh sách alerts
```

### Telemetry
```
POST   /api/telemetry              # REST fallback (nếu WebSocket lỗi)
GET    /api/telemetry/:sessionId   # Lấy telemetry của session
```

### Alert
```
GET    /api/alerts                 # Danh sách alerts (filter: type, status, session)
GET    /api/alerts/:id             # Chi tiết alert
PUT    /api/alerts/:id/acknowledge # Xác nhận đã đọc
```

### Conflict Management (Admin)
```
GET    /api/conflicts              # Tất cả conflicts
GET    /api/conflicts/:id          # Chi tiết conflict
PUT    /api/conflicts/:id/resolve  # Resolve conflict
```

### Mission Planning
```
POST   /api/missions               # Tạo mission
GET    /api/missions               # Danh sách missions
GET    /api/missions/:id           # Chi tiết mission
PUT    /api/missions/:id           # Cập nhật mission
DELETE /api/missions/:id           # Xóa mission
POST   /api/missions/:id/plans     # Thêm flight plan vào mission
```

### Payment & Packages
```
GET    /api/packages               # Danh sách gói dịch vụ
POST   /api/sepay/webhook          # SePay payment webhook
GET    /api/sepay/check-payment    # Kiểm tra trạng thái thanh toán
```

### Admin
```
GET    /api/admin/users            # Quản lý users
PUT    /api/admin/users/:id/status # Kích hoạt/vô hiệu hóa user
DELETE /api/admin/users/:id        # Xóa user
```

---

## 🌐 WebSocket Events (Socket.IO)

### Connection
```javascript
// Client kết nối
const socket = io("http://localhost:3000", {
  path: "/ws",
  auth: { token: JWT_TOKEN }
});

// Events
socket.on("connect", () => { /* Connected */ });
socket.on("disconnect", (reason) => { /* Disconnected */ });
socket.on("connect_error", (error) => { /* Auth failed */ });
```

### Telemetry Events
```javascript
// Gửi telemetry
socket.emit("telemetry", {
  sessionId: "session_id",
  data: {
    lat: 10.8231,
    lng: 106.6297,
    altitude: 120,
    speed: 15,
    heading: 90,
    batteryLevel: 85
  }
});

// Nhận xác nhận
socket.on("telemetry_ack", (ack) => {
  console.log("Saved:", ack.telemetryId);
});
```

### Alert Events
```javascript
// Theo dõi session
socket.emit("watch_session", {
  sessionId: "session_id"
});

// Xác nhận đang theo dõi
socket.on("watching", (data) => {
  console.log("Watching:", data.sessionId);
});

// Nhận alerts
socket.on("alert", (alert) => {
  console.log("Alert:", alert);
  // { type, severity, message, location, data }
});
```

### Error Handling
```javascript
socket.on("error", (error) => {
  console.error("Error:", error.message);
});
```

---

## ⚙️ Environment Variables

```bash
# ========== REDIS CONFIGURATION ==========
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# ========== MONGODB CONFIGURATION ==========
MONGODB_URI=mongodb://localhost:27017/utm

# ========== JWT CONFIGURATION ==========
JWT_SECRET=your-secret-key-change-in-production

# ========== CORS CONFIGURATION ==========
CORS_ORIGIN=http://localhost:3000

# ========== TELEMETRY OPTIMIZATION ==========
TELEMETRY_SAMPLING_ENABLED=true
TELEMETRY_SAMPLING_RATIO=10          # Store 1/10 points (90% reduction)
TELEMETRY_MIN_INTERVAL=1000          # Min 1s between stored points
TELEMETRY_TTL_DAYS=7                 # Auto-delete after 7 days

# ========== BATCH PROCESSING ==========
BATCH_SIZE=1000                      # Records per batch
FLUSH_INTERVAL_MS=5000               # Max wait time (5s)

# ========== APPLICATION ==========
NODE_ENV=development
PORT=3000

# ========== GOOGLE AUTH ==========
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
```

---

## 🚀 Performance Optimization

### Telemetry System Optimization (Current Implementation)

**Architecture:**
```
WebSocket → Redis Cache + Redis Streams → Worker (Batch) → MongoDB
```

**Key Optimizations:**
1. **Redis Streams** thay vì Kafka (lighter, suitable for medium scale)
2. **Batch Processing**: 1000 records/5s → giảm 90% DB writes
3. **Sampling**: Store 1/10 telemetry points → giảm 90% storage
4. **Redis Cache**: Latest drone location (1h TTL) → fast dashboard queries
5. **TTL Index**: Auto-delete telemetry after 7 days
6. **Worker Parallelization**: Có thể chạy multiple workers

**Performance Metrics:**
- Max throughput: ~10,000 msg/sec per worker
- Conflict check latency: 0.5ms (using Redis cache)
- Storage reduction: 90% (with sampling)
- Supports: 500+ drones at 10Hz telemetry

**Scaling Strategy:**
- < 100 drones: Single worker OK
- 100-500 drones: 2-4 parallel workers
- 500+ drones: Full optimization + multiple workers

---

## 🔒 Authentication & Authorization

### Roles
```javascript
ADMIN              # Toàn quyền hệ thống
FLEET_OPERATOR     # Quản lý đội drone (nhiều drone)
INDIVIDUAL_OPERATOR # Người dùng cá nhân (ít drone)
```

### JWT Token
```javascript
// Token payload
{
  userId: "user_id",
  email: "user@example.com",
  role: "FLEET_OPERATOR",
  iat: 1234567890,
  exp: 1234567890
}

// Header
Authorization: Bearer <token>
```

### Middleware
```javascript
// auth.middleware.js
- verifyToken: Xác thực JWT
- requireRole: Kiểm tra role
- requireOwnership: Kiểm tra quyền sở hữu resource
```

---

## 📊 Database Indexes

### Critical Indexes
```javascript
// FlightPlan
{ routeGeometry: "2dsphere" }        # Geospatial queries
{ status: 1, createdAt: -1 }         # List & filter
{ pilot: 1, status: 1 }              # User's plans
{ drone: 1, status: 1 }              # Drone's plans

// FlightSession
{ drone: 1, status: 1 }              # Active sessions
{ pilot: 1, status: 1 }              # User's sessions
{ status: 1 }                        # Filter by status
{ sessionType: 1 }                   # PLANNED vs FREE_FLIGHT

// Telemetry
{ location: "2dsphere" }             # Spatial queries
{ drone: 1, timestamp: -1 }          # Drone history
{ flightSession: 1, timestamp: -1 }  # Session telemetry
{ timestamp: 1 } (TTL)               # Auto-delete

// Alert
{ flightSession: 1, createdAt: -1 }  # Session alerts
{ type: 1, status: 1 }               # Filter alerts
{ drone: 1, createdAt: -1 }          # Drone alerts
{ location: "2dsphere" }             # Spatial queries

// Zone
{ geometry: "2dsphere" }             # Geospatial queries
{ type: 1, activeFrom: 1 }           # Active zones

// Drone
{ owner: 1, status: 1 }              # Owner's drones
{ status: 1 }                        # Available drones
```

---

## 🧪 Testing

### Test Scripts
```bash
npm test                    # Run Jest tests
npm run test:telemetry      # Simulate 5 drones sending telemetry
```

### Test Coverage
- Conflict Detection algorithms (Pairwise, Segmentation)
- Zone violation checks
- Telemetry batch processing
- WebSocket connections

---

## 🐳 Docker Setup

### Services
```yaml
# docker-compose.yml
services:
  mongodb:
    image: mongo:latest
    ports: 27017:27017
    volumes: mongodb-data
    
  redis:
    image: redis:latest
    ports: 6379:6379
    command: redis-server --appendonly yes
    volumes: redis-data
```

### Quick Start
```bash
# Start services
docker-compose up -d

# Start backend
npm run dev

# Start worker
npm run worker:dev
```

---

## 📚 Key Documentation Files

1. **`ERD.md`**: Entity Relationship Diagram (Mermaid)
2. **`Flight Management Flow.md`**: Chi tiết workflow bay
3. **`Flight Plan API Guide.md`**: Hướng dẫn API Flight Plan
4. **`Socket Connection Guide.md`**: Hướng dẫn WebSocket integration
5. **`Telemetry Architecture.md`**: Kiến trúc telemetry system
6. **`Strategic conflict detection.md`**: Thuật toán phát hiện xung đột
7. **`CODE_REVIEW_OPTIMIZATION_STRATEGY.md`**: Performance optimization guide
8. **`REDIS_SETUP.md`**: Redis Streams setup & monitoring

---

## 🎯 Business Rules

### Flight Plan
- Tối thiểu 2 waypoints (takeoff + land)
- `plannedEnd` phải sau `plannedStart`
- Drone phải thuộc sở hữu của user
- Chỉ DRAFT mới có thể edit/delete
- REJECTED có thể edit → auto reset về DRAFT

### Flight Session
- PLANNED: Yêu cầu FlightPlan đã APPROVED
- FREE_FLIGHT: Chỉ INDIVIDUAL_OPERATOR
- Một drone chỉ có thể có 1 session IN_PROGRESS
- Khi start session → Drone status = FLYING
- Khi end session → Drone status = AVAILABLE

### Conflict Detection Thresholds
```javascript
D_MIN = 50m      // Horizontal separation minimum
H_MIN = 30m      // Vertical separation minimum

Severity Levels:
- CRITICAL: < 30m
- HIGH: < 60m
- MEDIUM: < 100m
- LOW: >= 100m
```

### Telemetry
- Frequency: 1-20 Hz (recommended: 10 Hz)
- Sampling: Store 1/10 points (configurable)
- TTL: 7 days (auto-delete)
- Min interval: 1000ms between stored points

### Alert
- Auto-generated khi In-flight Detection phát hiện vấn đề
- Broadcast qua WebSocket real-time
- Status: ACTIVE → ACKNOWLEDGED → RESOLVED

---

## 🔧 Common Operations

### Start Development
```bash
# 1. Start Docker services
docker-compose up -d

# 2. Install dependencies
npm install

# 3. Copy environment
cp .env.example .env

# 4. Start backend (Terminal 1)
npm run dev

# 5. Start worker (Terminal 2)
npm run worker:dev
```

### Monitor Redis Streams
```bash
# Enter Redis CLI
docker exec -it redis redis-cli

# Check stream length
XLEN telemetry:stream

# Check consumer group
XINFO GROUPS telemetry:stream

# View last messages
XREVRANGE telemetry:stream + - COUNT 5
```

### Monitor MongoDB
```bash
# Enter MongoDB shell
docker exec -it mongodb mongosh

# Check telemetry count
db.telemetries.countDocuments()

# Check active sessions
db.flightsessions.find({ status: "IN_PROGRESS" })

# Check alerts
db.alerts.find({ status: "ACTIVE" })
```

---

## 🚨 Troubleshooting

### Redis Connection Issues
```bash
# Check Redis status
docker-compose ps | grep redis

# View Redis logs
docker-compose logs redis

# Test connection
docker exec redis redis-cli ping
```

### Worker Not Processing
```bash
# Check stream has messages
docker exec redis redis-cli XLEN telemetry:stream

# Check consumer group
docker exec redis redis-cli XINFO GROUPS telemetry:stream

# Check pending messages
docker exec redis redis-cli XPENDING telemetry:stream telemetry-consumer-group
```

### High Memory Usage
```bash
# Check Redis memory
docker exec redis redis-cli INFO memory

# Trim stream manually
docker exec redis redis-cli XTRIM telemetry:stream MAXLEN ~ 50000
```

---

## 🎓 Academic Context (ICAO UTM Levels)

Dự án này implement **ICAO Level 3: Strategic Deconfliction**

### UTM Levels
- **Level 1**: Basic tracking
- **Level 2**: Cooperative separation
- **Level 3**: Strategic deconfliction (Pre-flight conflict detection) ← **This project**
- **Level 4**: Tactical deconfliction (In-flight conflict resolution)
- **Level 5**: Full autonomy

### Algorithms Implemented
1. **Pairwise 4D Trajectory Detection** (Baseline, O(n²))
2. **Airspace Segmentation Detection** (Optimized, O(n))
3. **Zone Violation Detection** (Geospatial queries)
4. **In-flight Proximity Detection** (Real-time)

---

## 📝 Notes for AI Agents

### When working with this codebase:

1. **Modular Architecture**: Code trong `src/modules/` theo feature, code cũ trong `controllers/` và `models/`

2. **Async/Await**: Tất cả DB operations đều async, luôn dùng try-catch

3. **Error Handling**: Trả về JSON với format `{ message, error }`

4. **Authentication**: Hầu hết endpoints yêu cầu JWT token trong header

5. **Geospatial**: Dùng MongoDB 2dsphere index, coordinates format: `[lng, lat]`

6. **Real-time**: WebSocket events phải handle trong `src/config/websocket.js`

7. **Performance**: Telemetry system đã optimize, KHÔNG ghi trực tiếp vào DB từ WebSocket

8. **Testing**: Có test suite trong `tests/`, chạy `npm test`

9. **Documentation**: Swagger docs tại `/api-docs`, luôn update khi thêm API mới

10. **Redis Streams**: Worker process riêng biệt, chạy `npm run worker:dev`

---

## 🔗 Related Resources

- **Frontend Repository**: (Liên kết đến repo frontend nếu có)
- **API Documentation**: `http://localhost:3000/api-docs`
- **Redis Documentation**: https://redis.io/docs/data-types/streams/
- **MongoDB Geospatial**: https://www.mongodb.com/docs/manual/geospatial-queries/
- **Socket.IO**: https://socket.io/docs/v4/

---

**Last Updated**: March 2026  
**Version**: 1.0  
**Maintainer**: WDP301 Team
