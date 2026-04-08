# Fleet Simulator Flow Analysis

## 1. Mục tiêu tài liệu

Tài liệu này mô tả luồng simulator mới cho Fleet Operator dưới 2 góc nhìn:

1. Business analysis: hệ thống này giải quyết bài toán gì, ai sử dụng, đầu vào đầu ra là gì.
2. Code analysis: backend đã implement như thế nào, các module nào tham gia, FE cần gọi gì.

Phạm vi tài liệu bao gồm:

1. Mission Orchestrated Fleet Simulator.
2. Flight Plan Follower cho từng drone.
3. REST simulation-control để FE chỉ gọi API thay vì chạy lệnh tay.
4. Pre-flight safety check và runtime telemetry flow.

---

## 2. Business Analysis

### 2.1. Bài toán nghiệp vụ

Fleet Operator cần một cách mô phỏng nhiều drone bay theo mission mà không cần drone thật, nhằm phục vụ các nhu cầu sau:

1. Demo luồng điều phối mission cho frontend.
2. Kiểm thử luồng tạo mission, start mission, start session, telemetry realtime, alerts, nearby drones.
3. Kiểm tra logic tránh va chạm trước khi triển khai trên môi trường thật.
4. Cho phép đội FE chủ động chạy simulator chỉ bằng REST API.

Trước khi có simulation-control, simulator chỉ chạy qua CLI script. Điều đó gây bất tiện vì FE không thể tự khởi động hoặc giám sát simulator từ UI.

### 2.2. Giá trị nghiệp vụ mang lại

Luồng mới mang lại các giá trị sau:

1. FE có thể khởi chạy mô phỏng mission từ giao diện quản lý mission.
2. BE có thể kiểm soát vòng đời simulator process tập trung.
3. QA có thể tái hiện kịch bản normal, deviation và battery-drop.
4. UTM/Fleet team có thể quan sát end-to-end luồng mission mà không cần thiết bị bay thật.

### 2.3. Đối tượng sử dụng

1. FLEET_OPERATOR
Mục tiêu: chạy mission simulation cho chính mission của mình.

2. UTM_ADMIN
Mục tiêu: kiểm tra hoặc giám sát simulation cho mục đích quản trị và vận hành.

3. Frontend team
Mục tiêu: build UI điều khiển simulator, theo dõi log, trạng thái run, telemetry và alerts.

### 2.4. Luồng nghiệp vụ tổng quát

1. Người dùng chọn một mission trên UI.
2. FE gọi REST API để start simulator cho mission đó.
3. Backend spawn một process Node chạy script `simulate-mission.js`.
4. Script tải mission detail, kiểm tra an toàn tiền bay, rồi khởi chạy từng drone follower.
5. Mỗi follower tự start flight session, kết nối WebSocket, gửi telemetry định kỳ.
6. Backend xử lý telemetry, chạy inflight checks, sinh alert và nearby drones nếu có.
7. FE polling trạng thái simulation run để xem tiến trình và log.
8. Khi cần, FE gọi stop API để dừng process simulator.

### 2.5. Các chế độ mô phỏng

#### Normal

Mỗi drone bám theo lộ trình của flight plan đã được schedule trong mission.

Mục tiêu:

1. Demo luồng cơ bản.
2. Kiểm tra telemetry ingest.
3. Kiểm tra mission/session lifecycle.

#### Deviation

Một drone lệch quỹ đạo có chủ đích ở một đoạn của hành trình.

Mục tiêu:

1. Kiểm tra deviation alert.
2. Kiểm tra xử lý theo dõi route thực tế khác route kế hoạch.

#### Battery-drop

Một drone tụt pin nhanh hơn bình thường.

Mục tiêu:

1. Kiểm tra battery-related alert.
2. Kiểm tra FE hiển thị tình trạng pin thấp.

### 2.6. Điều kiện thành công của nghiệp vụ

Một lần chạy simulator được xem là thành công khi:

1. Mission được load đúng.
2. Các mission plans hợp lệ được build thành followers.
3. Pre-flight safety check pass hoặc được cho phép skip.
4. Flight sessions được tạo thành công.
5. Telemetry được gửi đều qua WebSocket.
6. FE đọc được trạng thái run và log từ simulation-control API.

### 2.7. Ràng buộc và giới hạn hiện tại

1. Simulation run state đang lưu trong memory của Node process.
2. Nếu backend restart thì danh sách run đang chạy hoặc lịch sử run sẽ mất.
3. Simulator phụ thuộc vào JWT hợp lệ và mission data hợp lệ.
4. Để deviation alerts chạy chính xác, waypoint nên có `estimatedTime` phù hợp với lịch mission.

---

## 3. Code Analysis

### 3.1. Thành phần chính

Luồng simulator mới gồm 3 lớp chính:

1. Simulation Control API
Nơi FE gọi REST để start, stop và lấy status của simulator process.

2. Mission Orchestrator
Script chịu trách nhiệm nạp mission, thực hiện safety check, build followers và điều phối việc cất cánh theo lịch.

3. Flight Plan Follower
Simulator cho một drone đơn lẻ, có nhiệm vụ nội suy theo waypoint, gửi telemetry và xử lý các mode đặc biệt như deviation hoặc battery-drop.

### 3.2. File tham gia trong luồng mới

#### Backend control layer

1. `src/modules/simulation/simulation.routes.js`
2. `src/modules/simulation/simulation.controller.js`
3. `src/modules/simulation/simulation.service.js`

#### Simulator runtime layer

1. `scripts/simulate-mission.js`
2. `scripts/flight-plan-follower.js`

#### Existing runtime dependencies

1. `src/modules/mission/mission.routes.js`
2. `src/modules/flightSession/flightSession.routes.js`
3. `src/config/websocket.js`
4. `src/modules/conflict/inflightDetection.service.js`
5. `src/config/conflictConfig.js`

---

## 4. Simulation-Control REST API

### 4.1. Start simulation

Endpoint:

```http
POST /api/simulations/missions/:id/start
```

Mục đích:

1. FE yêu cầu backend khởi chạy simulator cho một mission.
2. Backend lấy Bearer token của request hiện tại và truyền vào process simulator.

Request body ví dụ:

```json
{
  "mode": "normal",
  "timeScale": 10,
  "tickMs": 1000,
  "skipSafetyCheck": false
}
```

Response ví dụ:

```json
{
  "message": "Simulation started",
  "run": {
    "runId": "1d86a0ea-d4ba-4ca8-8d14-f5a33da5b98f",
    "missionId": "67f3b5f91c2b6c2d5fb92410",
    "status": "RUNNING",
    "pid": 14820,
    "options": {
      "mode": "normal",
      "timeScale": 10,
      "tickMs": 1000,
      "skipSafetyCheck": false
    },
    "logs": []
  }
}
```

### 4.2. Stop simulation

Endpoint:

```http
POST /api/simulations/:runId/stop
```

Mục đích:

1. FE yêu cầu dừng process simulator.
2. Backend gửi terminate signal cho child process.

### 4.3. Simulation status

Endpoint:

```http
GET /api/simulations/:runId/status
```

Mục đích:

1. FE polling trạng thái hiện tại.
2. FE lấy log để hiển thị console monitor trên giao diện.

Các trạng thái chính:

1. `RUNNING`
2. `STOPPING`
3. `STOPPED`
4. `COMPLETED`
5. `FAILED`

---

## 5. Runtime Sequence

### 5.1. Sequence mức nghiệp vụ

```text
FE -> Simulation API: POST start mission simulation
Simulation API -> child_process: spawn simulate-mission.js
simulate-mission.js -> Mission API: GET mission detail
simulate-mission.js -> Mission API: POST start mission if DRAFT
simulate-mission.js -> Pre-flight checker: validate pairwise safety
simulate-mission.js -> FlightPlanFollower: create one follower per mission plan
FlightPlanFollower -> Flight Session API: POST /start
FlightPlanFollower -> WebSocket: connect /ws
FlightPlanFollower -> WebSocket: emit telemetry
Backend -> Alert service / nearby / conflict checks: process realtime events
FE -> Simulation API: GET status repeatedly
FE -> Simulation API: POST stop when needed
```

### 5.2. Sequence mức code

#### Bước 1. FE gọi start API

Controller gọi `simulationService.startMissionSimulation()`.

#### Bước 2. Service spawn child process

`simulation.service.js` thực hiện:

1. Validate input.
2. Chuẩn hóa options.
3. Chống trùng run đang chạy cho cùng mission và cùng user.
4. Spawn process Node chạy `scripts/simulate-mission.js`.
5. Theo dõi stdout và stderr.
6. Trả về `runId` để FE giám sát.

#### Bước 3. Mission orchestrator chạy

`simulate-mission.js` thực hiện:

1. Đọc CLI args.
2. Tải mission detail.
3. Start mission nếu đang `DRAFT`.
4. Build followers từ `missionPlans`.
5. Chạy `preMissionSafetyCheck()`.
6. Nếu an toàn thì schedule từng follower để bay.

#### Bước 4. Follower gửi telemetry

`flight-plan-follower.js` thực hiện:

1. Start flight session cho từng flightPlan.
2. Connect WebSocket `/ws`.
3. Emit `watch_session` để nhận alert room-based.
4. Tick theo `tickMs` và `timeScale`.
5. Nội suy vị trí, độ cao, heading, speed.
6. Emit `telemetry` định kỳ.
7. End session khi kết thúc route.

---

## 6. Thuật toán chính

### 6.1. Flight plan follower interpolation

Follower dùng nội suy tuyến tính giữa các waypoint đã được schedule trong khoảng `plannedStart -> plannedEnd`.

Logic chính:

```text
fraction = (currentTime - segmentStart) / (segmentEnd - segmentStart)
lat = lerp(lat1, lat2, fraction)
lng = lerp(lng1, lng2, fraction)
alt = lerp(alt1, alt2, fraction)
heading = bearing(point1, point2)
speed = segmentDistance / segmentTime
```

Ý nghĩa nghiệp vụ:

1. Drone mô phỏng di chuyển mượt thay vì nhảy waypoint.
2. FE và backend nhận chuỗi telemetry gần với thực tế hơn.

### 6.2. Pre-flight safety check

Mục tiêu là phát hiện xung đột trước khi cho cả fleet cất cánh.

Điều kiện kiểm tra:

1. Quãng đường ngang `dXY`.
2. Độ cao chênh lệch `dZ`.
3. Vận tốc tương đối `relSpeed`.
4. Thời gian tới nguy cơ va chạm `TTC`.

Pseudo-flow:

```text
for each pair of followers A, B:
  overlapStart = max(A.start, B.start)
  overlapEnd = min(A.end, B.end)
  if no overlap: clear

  for t in overlap window step 30s:
    posA = interpolateAt(t)
    posB = interpolateAt(t)
    dXY = haversine(posA, posB)
    dZ = abs(posA.alt - posB.alt)
    relSpeed = |velocityA - velocityB|
    TTC = dXY / relSpeed

    if dXY < 100m and dZ < 30m:
      conflict
```

Ý nghĩa nghiệp vụ:

1. Không cho fleet cất cánh nếu lịch bay tự nó đã nguy hiểm.
2. Giảm rủi ro phát alert dồn dập hoặc va chạm giả lập ngay sau khi start.

### 6.3. Runtime separation awareness

Trong lúc bay, mỗi follower còn kiểm tra shared position của các drone khác để log near-miss ở phía simulator.

Điểm cần lưu ý:

1. Đây là check phía simulator.
2. Backend vẫn có inflight detection thật từ telemetry stream.
3. Hai lớp này bổ sung cho nhau, không thay thế nhau.

---

## 7. Dữ liệu trao đổi giữa FE và BE

### 7.1. FE gọi simulation-control

Ví dụ start run:

```ts
await fetch(`/api/simulations/missions/${missionId}/start`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  },
  body: JSON.stringify({
    mode: "normal",
    timeScale: 10,
    tickMs: 1000,
    skipSafetyCheck: false
  })
});
```

Ví dụ poll status:

```ts
await fetch(`/api/simulations/${runId}/status`, {
  headers: {
    "Authorization": `Bearer ${token}`
  }
});
```

### 7.2. Telemetry payload runtime

Follower emit WebSocket telemetry với payload dạng:

```json
{
  "droneId": "67f3b44e1c2b6c2d5fb923bb",
  "sessionId": "67f3bb0c1c2b6c2d5fb92511",
  "lat": 10.8231,
  "lng": 106.6297,
  "alt": 120,
  "speed": 15.2,
  "heading": 90,
  "batteryLevel": 82,
  "timestamp": 1770000000000
}
```

### 7.3. Log payload cho FE monitor

Status API trả `logs[]` để FE render console theo thời gian thực gần đúng:

```json
{
  "ts": "2026-04-08T09:10:11.000Z",
  "stream": "stdout",
  "message": "🚀  Launching 3 drone(s)..."
}
```

---

## 8. Frontend Integration Guidance

### 8.1. UI tối thiểu nên có

1. Nút `Start Simulation` trong mission detail page.
2. Form chọn mode, timeScale, tickMs.
3. Khu vực hiển thị run status.
4. Khu vực hiển thị live logs.
5. Nút `Stop Simulation`.

### 8.2. Frontend state nên quản lý

1. `runId`
2. `status`
3. `logs`
4. `isStarting`
5. `isStopping`
6. `error`

### 8.3. Polling strategy

Khuyến nghị:

1. Poll mỗi 1 đến 2 giây khi run đang `RUNNING` hoặc `STOPPING`.
2. Dừng poll khi status là `COMPLETED`, `FAILED` hoặc `STOPPED`.
3. Giới hạn số log render trên UI để tránh nặng client.

---

## 9. Quyền truy cập và kiểm soát

### 9.1. Role access

Simulation-control route đang mở cho:

1. `FLEET_OPERATOR`
2. `UTM_ADMIN`

### 9.2. Ownership check

Service kiểm tra:

1. Nếu là `UTM_ADMIN` thì được phép xem/dừng mọi run.
2. Nếu là `FLEET_OPERATOR` thì chỉ xem hoặc dừng run do chính user đó tạo.

### 9.3. Duplicate run prevention

Backend chặn việc một user khởi chạy đồng thời nhiều run cho cùng một mission nếu run cũ vẫn còn `RUNNING`.

---

## 10. Điểm mạnh của thiết kế hiện tại

1. FE không cần SSH hay CLI access.
2. Tách control plane và runtime plane rõ ràng.
3. Tận dụng lại mission/session/websocket flow sẵn có.
4. Có thể mở rộng thêm mode mới mà không đổi API contract chính.
5. Có log gần realtime để hỗ trợ demo và QA.

---

## 11. Rủi ro kỹ thuật hiện tại

### 11.1. In-memory run registry

`runs` đang được lưu bằng `Map()` trong memory process. Điều này có nghĩa là:

1. Restart server sẽ mất metadata run.
2. Không phù hợp cho scale-out nhiều instance.

### 11.2. Process lifecycle trên production

Simulator chạy dưới dạng child process của Node server. Nếu server bị crash hoặc recycle thì simulator cũng bị ảnh hưởng.

### 11.3. Polling thay vì streaming log

Hiện tại FE lấy log qua polling status API. Cách này đơn giản nhưng chưa phải tối ưu nhất nếu số run lớn.

---

## 12. Đề xuất cải tiến tiếp theo

### 12.1. Ngắn hạn

1. Thêm endpoint list simulation runs cho dashboard.
2. Thêm cleanup cho run cũ.
3. Bổ sung test integration cho simulation-control API.

### 12.2. Trung hạn

1. Lưu run metadata vào Redis hoặc MongoDB.
2. Stream log qua WebSocket thay vì polling.
3. Tách simulator worker khỏi web server process.

### 12.3. Dài hạn

1. Hỗ trợ nhiều scenario engine hơn.
2. Cho phép import test scenario từ JSON.
3. Gắn simulation run với mission history để audit.

---

## 13. Kết luận

Luồng simulator mới đã chuyển từ mô hình vận hành thủ công bằng CLI sang mô hình điều khiển bằng REST phù hợp hơn cho frontend.

Về mặt business, giải pháp này giúp Fleet Operator và FE team có thể tự chạy mô phỏng mission nhiều drone để demo, kiểm thử và theo dõi realtime.

Về mặt kỹ thuật, giải pháp hiện tại có kiến trúc rõ ràng:

1. REST API làm control layer.
2. `simulate-mission.js` làm orchestration layer.
3. `flight-plan-follower.js` làm single-drone execution layer.

Đây là một nền tảng đủ tốt cho demo và integration nội bộ. Nếu cần production-grade, ưu tiên tiếp theo nên là persistence cho simulation runs, log streaming và worker isolation.
