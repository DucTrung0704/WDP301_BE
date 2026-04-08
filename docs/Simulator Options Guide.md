# Simulator Options Guide

## Mục tiêu

Tài liệu này gom các phương án simulator có thể dùng cho hệ thống hiện tại để mô phỏng chuỗi:

`Flight Plan / Mission -> Start Session -> Drone bay -> Telemetry -> Alert / Map -> End Session`

Mục đích là để chọn cách mô phỏng phù hợp với giai đoạn phát triển hiện tại, không phải để chốt implementation ngay.

---

## Bối cảnh repo hiện tại

Repo đã có sẵn các thành phần sau:

1. WebSocket telemetry ingestion
   - File: `src/config/websocket.js`
   - Nhận telemetry realtime từ client/drone.

2. Telemetry persistence pipeline
   - File: `src/workers/telemetryRedisWorker.js`
   - Ghi telemetry từ Redis Streams xuống MongoDB.

3. In-flight detection
   - File: `src/modules/conflict/inflightDetection.service.js`
   - Kiểm tra deviation, proximity, zone violation, battery.

4. Session lifecycle
   - File: `src/modules/flightSession/flightSession.service.js`
   - Start/end flight session, build `actualRoute` từ telemetry.

5. Nearby mock drones
   - File: `src/modules/nearby/mockDroneService.js`
   - Dùng để giả lập drone xung quanh cho màn hình map.

6. Telemetry test sender
   - File: `scripts/test-telemetry.js`
   - Gửi telemetry giả qua WebSocket.

Nói ngắn gọn: repo đã có nền ingestion và detection khá đầy đủ, nhưng chưa có simulator hoàn chỉnh bám theo flight plan thực tế.

---

## Tiêu chí chọn simulator

Khi chọn simulator, nên đánh giá theo 5 câu hỏi:

1. Có mô phỏng bay theo đúng `waypoints` của `flightPlan` không?
2. Có tự tạo hoặc dùng `flightSession` thật không?
3. Có bắn telemetry đúng format backend đang nhận không?
4. Có giúp kiểm tra `DEVIATION alert` và `actualRoute` không?
5. Có đủ nhẹ để dùng trong demo và phát triển hằng ngày không?

---

## Option 1: Telemetry Random Simulator

### Mô tả

Simulator chỉ tập trung vào việc gửi telemetry giả qua WebSocket. Drone sẽ di chuyển kiểu random-walk hoặc dao động nhẹ quanh một vùng toạ độ.

### Trạng thái trong repo

Đã có sẵn nền tảng ở file `scripts/test-telemetry.js`.

### Chuỗi mô phỏng hỗ trợ

- Telemetry lên WebSocket
- Redis cache / Redis Stream
- Worker ghi DB
- Alert realtime cơ bản
- FE nhìn thấy marker đang thay đổi vị trí

### Không hỗ trợ tốt

- Không bám flight plan thật
- Không thể kết luận drone đang bay đúng plan
- Khó dùng để kiểm tra mission orchestration

### Ưu điểm

- Nhanh, nhẹ, có thể dùng ngay
- Phù hợp để test throughput và connectivity
- Dễ chạy trong local/dev

### Nhược điểm

- Không sát nghiệp vụ Fleet Operator
- Telemetry sinh ra không có logic quỹ đạo rõ ràng
- Chỉ phù hợp cho test pipeline, không phù hợp cho demo nghiệp vụ “bay đúng plan”

### Khi nào nên dùng

- Muốn test WebSocket ingestion
- Muốn test worker và Redis flow
- Muốn FE có dữ liệu chuyển động để hiển thị nhanh

### Đánh giá phù hợp với repo

`Phù hợp để test kỹ thuật, không đủ để demo nghiệp vụ chính`

---

## Option 2: Nearby Mock Drone Simulator

### Mô tả

Simulator tạo các drone giả bay tuần tra trong một khu vực và lưu vị trí vào Redis. Frontend khi subscribe nearby sẽ nhìn thấy cả drone thật và drone mock trên bản đồ.

### Trạng thái trong repo

Đã có service ở file `src/modules/nearby/mockDroneService.js`.

### Chuỗi mô phỏng hỗ trợ

- Hiển thị drone xung quanh trước khi bay
- Hiển thị drone xung quanh khi đang bay
- Làm phong phú dữ liệu trên map cho Fleet Operator

### Không hỗ trợ tốt

- Không đại diện cho một chuyến bay thật
- Không dùng `flightSession` thật
- Không đi theo `flightPlan`
- Không sinh full vòng đời mission/session

### Ưu điểm

- Rất hợp cho map UI demo
- Không cần start session thật
- Dễ nhìn, dễ giải thích cho FE

### Nhược điểm

- Chủ yếu là simulator hiển thị, không phải simulator nghiệp vụ
- Không dùng để xác minh “bay đúng plan”

### Khi nào nên dùng

- Muốn demo bản đồ trước khi có drone thật
- Muốn kiểm tra tính năng `subscribe_plan_nearby` hoặc `subscribe_nearby`

### Đánh giá phù hợp với repo

`Phù hợp để demo bản đồ và nearby awareness, không đủ cho end-to-end flight flow`

---

## Option 3: Flight Plan Follower Simulator

### Mô tả

Đây là simulator lý tưởng nhất cho hệ thống hiện tại.

Nó sẽ:

1. Nhận `flightPlanId` hoặc `missionPlanId`
2. Đọc danh sách waypoints
3. Tạo hoặc dùng `flightSession` thật
4. Nội suy vị trí theo thời gian / tốc độ
5. Gửi telemetry qua WebSocket đúng format backend
6. Kết thúc session khi đến waypoint cuối

### Trạng thái trong repo

Chưa có sẵn. Cần viết mới.

### Chuỗi mô phỏng hỗ trợ

- Start planned session
- Drone bay theo đúng route
- Telemetry realtime
- Deviation check
- Zone / proximity / battery alert
- Build `actualRoute`
- So sánh actualRoute với routeGeometry

### Ưu điểm

- Sát nghiệp vụ Fleet Operator nhất
- Test được đúng chuỗi từ plan đến session đến tracking
- Phù hợp để demo “drone có bay đúng plan hay không”
- Dễ thêm mode cố tình lệch route để test alert

### Nhược điểm

- Phải viết thêm
- Cần xử lý nội suy waypoint và thời gian khá cẩn thận
- Nên có cơ chế auth token và start session hợp lệ

### Khi nào nên dùng

- Muốn test end-to-end nghiệp vụ chính
- Muốn demo “bay đúng plan / lệch plan”
- Muốn dùng một simulator thống nhất cho BE và FE

### Đánh giá phù hợp với repo

`Là lựa chọn tốt nhất nếu mục tiêu là kiểm tra đúng plan và demo luồng Fleet Operator`

### Đề xuất mode nên có nếu triển khai

1. `follow-plan`
   - Bay bám waypoint.

2. `deviation-test`
   - Cố tình lệch khỏi route ở một đoạn để kích hoạt alert `DEVIATION`.

3. `battery-drop`
   - Giảm pin nhanh để kích hoạt alert `BATTERY_LOW`.

4. `multi-drone`
   - Chạy nhiều session song song để test proximity.

---

## Option 4: Mission Orchestrated Simulator

### Mô tả

Đây là bản mở rộng của Flight Plan Follower Simulator, dành riêng cho Fleet Operator có nhiều drone.

Thay vì chỉ bám một `flightPlan`, simulator sẽ:

1. Nhận `missionId`
2. Lấy toàn bộ `missionPlans`
3. Start lần lượt hoặc đồng thời nhiều `flightSessions`
4. Mỗi drone bay theo plan tương ứng
5. Theo dõi xung đột và alert đa drone

### Trạng thái trong repo

Chưa có sẵn. Cần viết mới.

### Chuỗi mô phỏng hỗ trợ

- Mission-based scheduling
- Nhiều drone cùng lúc
- Cross-drone proximity
- Nearby display thực tế hơn
- Fleet monitoring dashboard

### Ưu điểm

- Phù hợp nhất với khái niệm Fleet Operator
- Test được orchestration của nhiều drone
- Demo rất tốt cho hội đồng hoặc stakeholder

### Nhược điểm

- Phức tạp hơn nhiều so với option 3
- Phụ thuộc tính đúng đắn của mission planning trong backend
- Debug khó hơn do nhiều session chạy song song

### Khi nào nên dùng

- Sau khi đã có simulator bám một plan chạy ổn định
- Khi cần demo nhiều drone cùng bay

### Đánh giá phù hợp với repo

`Rất mạnh cho demo fleet, nhưng không nên làm trước option 3`

---

## Option 5: SITL thật kiểu PX4 / ArduPilot

### Mô tả

Đây là hướng simulator gần với drone thật nhất.

Bạn dùng hệ sinh thái như:

- PX4 SITL
- ArduPilot SITL
- QGroundControl hoặc Mission Planner
- MAVSDK / MAVLink bridge

Sau đó viết một lớp bridge để chuyển dữ liệu từ SITL sang format telemetry mà backend này đang nhận.

### Trạng thái trong repo

Chưa có tích hợp sẵn.

### Chuỗi mô phỏng hỗ trợ

- Bay theo mission của autopilot
- State machine gần drone thật
- Có takeoff / land / fail-safe / loiter / mission resume

### Ưu điểm

- Thực tế nhất
- Tốt nếu sau này tích hợp drone thật
- Có thể tái sử dụng cho nghiên cứu sâu hơn

### Nhược điểm

- Nặng và tốn công tích hợp
- Không phù hợp nếu chỉ cần demo web/backend nghiệp vụ
- Phải viết thêm gateway để map dữ liệu vào backend hiện tại

### Khi nào nên dùng

- Khi dự án đã ổn định và muốn tiến gần môi trường thực tế
- Khi cần nghiên cứu tích hợp drone thật hoặc autopilot thật

### Đánh giá phù hợp với repo

`Không phải lựa chọn đầu tiên cho giai đoạn hiện tại`

---

## So sánh nhanh

| Option | Có sẵn trong repo | Bay theo plan | Có session thật | Test deviation | Hợp demo fleet | Độ phức tạp |
| --- | --- | --- | --- | --- | --- | --- |
| Telemetry Random Simulator | Có một phần | Không | Không rõ / yếu | Yếu | Trung bình | Thấp |
| Nearby Mock Drone Simulator | Có | Không | Không | Không | Trung bình | Thấp |
| Flight Plan Follower Simulator | Chưa | Có | Có | Rất tốt | Tốt | Trung bình |
| Mission Orchestrated Simulator | Chưa | Có | Có | Rất tốt | Rất tốt | Cao |
| PX4 / ArduPilot SITL | Chưa | Có | Qua bridge | Tốt | Tốt | Rất cao |

---

## Khuyến nghị theo giai đoạn

### Giai đoạn 1: Test kỹ thuật nhanh

Dùng kết hợp:

- `scripts/test-telemetry.js`
- `mockDroneService.js`

Mục tiêu:

- Xác nhận WebSocket / Redis / worker / map hoạt động

### Giai đoạn 2: Demo nghiệp vụ chính

Nên làm:

- Flight Plan Follower Simulator

Mục tiêu:

- Chứng minh drone bay theo đúng `flightPlan`
- Kích hoạt `DEVIATION` khi cố tình lệch
- Kiểm tra `actualRoute`

### Giai đoạn 3: Demo Fleet Operator hoàn chỉnh

Nên làm tiếp:

- Mission Orchestrated Simulator

Mục tiêu:

- Nhiều drone trong một mission
- Theo dõi xung đột, nearby, alert song song

### Giai đoạn 4: Tiệm cận thực tế

Nếu cần nghiên cứu sâu hơn:

- PX4 SITL hoặc ArduPilot SITL

---

## Đề xuất chọn cho repo này

Nếu mục tiêu của bạn là vừa thực tế vừa không quá nặng, thứ tự ưu tiên nên là:

1. Giữ lại Telemetry Random Simulator để test pipeline kỹ thuật.
2. Dùng Nearby Mock Drone Simulator để FE có dữ liệu bản đồ đẹp hơn.
3. Xây Flight Plan Follower Simulator làm simulator chính.
4. Sau khi ổn, mới mở rộng thành Mission Orchestrated Simulator.
5. Chỉ cân nhắc SITL khi cần tích hợp gần drone thật.

---

## Kết luận ngắn

Nếu chỉ được chọn một loại để đầu tư tiếp trong repo hiện tại, nên chọn:

**Flight Plan Follower Simulator**

Vì nó là điểm cân bằng tốt nhất giữa:

- độ sát nghiệp vụ,
- chi phí triển khai,
- khả năng demo,
- khả năng kiểm tra drone bay đúng plan.

---

## Gợi ý bước tiếp theo sau khi chọn

Sau khi chốt option, có thể triển khai tiếp theo checklist:

1. Xác định input simulator: `flightPlanId`, `sessionId`, hay `missionId`
2. Xác định simulator có tự gọi API start session hay không
3. Xác định cách nội suy waypoint theo `estimatedTime` hay `speed`
4. Xác định có mode lệch route / pin yếu / multi-drone hay không
5. Chuẩn hoá output log để FE/BE dễ test
