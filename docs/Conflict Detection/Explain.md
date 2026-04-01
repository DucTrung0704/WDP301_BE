# Hệ thống Phát hiện Xung đột Không phận — Giải thích Kiến trúc & Thuật toán

## 1. Tổng quan hệ thống

Hệ thống quản lý không phận không người lái (UTM) cần đảm bảo rằng hai drone không bao giờ chiếm cùng một vùng không gian tại cùng một thời điểm. Để đạt được điều này, hệ thống triển khai **hai lớp kiểm tra xung đột** tách biệt về thời điểm và phương pháp:

- **Lớp 1 — Tiền bay (Pre-flight):** Kiểm tra kế hoạch bay *trước khi* drone cất cánh. Nếu phát hiện xung đột, kế hoạch bị từ chối, drone không được phép bay.
- **Lớp 2 — Trong chuyến bay (In-flight):** Giám sát vị trí thực tế của drone theo thời gian thực và cảnh báo ngay khi phát hiện nguy hiểm.

---

## 2. Mô hình dữ liệu cốt lõi

### 2.1 Trajectory (Quỹ đạo 4D)

Mỗi kế hoạch bay được biểu diễn như một quỹ đạo trong không-thời gian 4 chiều:

$$\text{Trajectory} = \{(lat_i, lng_i, alt_i, t_i) \mid i = 1, 2, \ldots, n\}$$

Trong đó:
- $(lat_i, lng_i)$ là tọa độ địa lý (độ thập phân)
- $alt_i$ là độ cao (mét so với mực nước biển)
- $t_i$ là thời điểm ước tính qua waypoint thứ $i$

### 2.2 Nội suy vị trí tuyến tính

Tại bất kỳ thời điểm $t$ nào giữa hai waypoint liên tiếp $i$ và $i+1$, vị trí của drone được tính bằng:

$$\alpha = \frac{t - t_i}{t_{i+1} - t_i}, \quad \alpha \in [0, 1]$$

$$lat(t) = lat_i + \alpha \cdot (lat_{i+1} - lat_i)$$
$$lng(t) = lng_i + \alpha \cdot (lng_{i+1} - lng_i)$$
$$alt(t) = alt_i + \alpha \cdot (alt_{i+1} - alt_i)$$

### 2.3 Khoảng cách Haversine

Khoảng cách ngang giữa hai điểm trên mặt cầu Trái Đất:

$$d_{XY} = 2R \cdot \arcsin\!\left(\sqrt{\sin^2\!\frac{\Delta\phi}{2} + \cos\phi_1 \cdot \cos\phi_2 \cdot \sin^2\!\frac{\Delta\lambda}{2}}\right)$$

Trong đó $R = 6{,}371{,}000\,\text{m}$, $\phi$ là vĩ độ (radian), $\lambda$ là kinh độ (radian).

---

## 3. Kiến trúc Tiền bay (Pre-flight)

### 3.1 Luồng lập kế hoạch

Thay vì chặn drone ngay từ khi tạo đường bay, hệ thống áp dụng mô hình **hai bước**:

**Bước 1 — Tạo FlightPlan:** Người dùng định nghĩa đường bay (waypoints) *mà không cần thời gian*. Đây là bản thiết kế thuần túy về không gian, không có ràng buộc thời gian.

**Bước 2 — Gắn vào Mission với thời gian:** Khi muốn thực hiện, người dùng gắn FlightPlan vào một Mission kèm khoảng thời gian cụ thể $(T_{start}, T_{end})$. Tại đây, hệ thống mới kiểm tra xung đột.

### 3.2 Phạm vi kiểm tra — Cross-Mission

Khi một kế hoạch mới được thêm vào với khoảng thời gian $[T_1, T_2]$, hệ thống thu thập **tất cả** kế hoạch đã lên lịch trong toàn hệ thống (không chỉ nội bộ mission) có thời gian chồng lấn:

$$\mathcal{C} = \{p \in \text{AllMissions} \mid p.start < T_2 \;\text{AND}\; p.end > T_1 \;\text{AND}\; p \neq \text{candidate}\}$$

Đây đảm bảo không có "xung đột chéo mission" nào bị bỏ sót.

### 3.3 Ba điểm kích hoạt kiểm tra tiền bay

| Sự kiện | Hành động |
|:---|:---|
| Thêm kế hoạch vào mission | Kiểm tra candidate vs toàn hệ thống |
| Cập nhật thời gian kế hoạch | Kiểm tra lại với thời gian mới, loại trừ bản thân |
| Kích hoạt mission (→ ACTIVE) | Kiểm tra lần cuối toàn bộ kế hoạch trong mission vs toàn hệ thống |

---

## 4. Thuật toán 1: Pairwise 4D Trajectory Detection

### Nguyên lý

Hai drone sẽ xung đột nếu chúng đến **gần nhau trong không gian** tại **cùng một thời điểm**. Thuật toán kiểm tra điều này bằng cách "phát lại" hành trình của hai drone theo từng bước thời gian và đo khoảng cách.

### Quy trình

**Bước 1 — Xác định cửa sổ thời gian chồng lấn**

$$[T_{overlap}^{start},\; T_{overlap}^{end}] = [\max(T_1^{start}, T_2^{start}),\; \min(T_1^{end}, T_2^{end})]$$

Nếu $T_{overlap}^{end} \leq T_{overlap}^{start}$ → không có chồng lấn → không xung đột.

**Bước 2 — Quét từng bước thời gian $\Delta t = 30$s**

Tại mỗi thời điểm $t = T_{overlap}^{start}, \; T_{overlap}^{start} + 30\text{s}, \ldots$:

$$P_1(t) = \text{interpolate}(\text{Trajectory}_1, t)$$
$$P_2(t) = \text{interpolate}(\text{Trajectory}_2, t)$$

**Bước 3 — Kiểm tra điều kiện xung đột**

$$d_{XY}(t) = \text{haversine}(P_1.lat, P_1.lng, P_2.lat, P_2.lng)$$
$$d_Z(t) = |P_1.alt - P_2.alt|$$

Nếu $d_{XY}(t) < D_{min} = 100\,\text{m}$ **VÀ** $d_Z(t) < H_{min} = 30\,\text{m}$ → **XÁC NHẬN XUNG ĐỘT**, dừng kiểm tra cặp này.

### Ưu điểm

- **Chính xác theo thời gian:** Xét đúng vị trí của cả hai drone tại cùng một thời điểm.
- **Phát hiện xung đột tạm thời:** Có thể phát hiện trường hợp hai drone cắt nhau rồi tách ra nhanh.

### Nhược điểm

- **Chi phí tính toán:** O(n × T/Δt) — tăng tuyến tính theo số lượng kế hoạch và độ dài thời gian.
- **Bỏ sót giữa bước:** Xung đột xảy ra giữa hai mốc 30s có thể bị bỏ qua.

---

## 5. Thuật toán 2: Airspace Segmentation

### Nguyên lý

Thay vì so sánh từng cặp drone, thuật toán này chia không-thời gian thành các **ô lưới (cell)** và kiểm tra xem có hai drone nào chiếm cùng một ô tại cùng một time slot không. Cách tiếp cận này giống như kiểm tra va chạm trong trò chơi điện tử dùng bản đồ lưới (grid-based collision).

### Phân chia lưới không-thời gian

Không gian 3D được phân chia thành các ô:

$$\text{cell}_X = \left\lfloor \frac{x_{\text{meters}}}{200\,\text{m}} \right\rfloor, \quad \text{cell}_Y = \left\lfloor \frac{y_{\text{meters}}}{200\,\text{m}} \right\rfloor, \quad \text{cell}_Z = \left\lfloor \frac{alt}{50\,\text{m}} \right\rfloor$$

Thời gian được phân chia thành các slot 60 giây:

$$\text{slot} = \left\lfloor \frac{t - t_0}{60\,\text{s}} \right\rfloor$$

Mỗi ô được định danh duy nhất bằng bộ 4 số: $(\text{cell}_X, \text{cell}_Y, \text{cell}_Z, \text{slot})$.

### Quy trình

1. **Xây dựng bản đồ chiếm dụng:** Với mỗi drone, nội suy vị trí theo từng bước và ghi vào ô tương ứng.
2. **Phát hiện xung đột:** Bất kỳ ô nào được chiếm bởi ≥ 2 drone khác nhau → xung đột tiềm năng.

### Chiến lược kết hợp Pairwise + Segmentation

Hai thuật toán không chạy độc lập mà **bổ sung** cho nhau:

- Pairwise chạy trước, ghi lại các cặp đã phát hiện xung đột.
- Segmentation chạy sau, chỉ đưa ra kết quả cho các cặp **chưa được** Pairwise phát hiện.

Điều này tránh báo cáo trùng lặp trong khi vẫn tận dụng điểm mạnh của từng thuật toán.

### Ưu điểm

- **Nhanh hơn với nhiều drone:** O(N × T/Δt) với N drone tổng thể (thay vì O(N²) cho full pairwise).
- **Phát hiện xung đột nhóm:** Có thể phát hiện khi 3+ drone cùng chiếm một vùng.

### Nhược điểm

- **Độ chính xác thấp hơn Pairwise:** Hai drone ở cạnh nhau nhưng khác cell sẽ không bị phát hiện.
- **Boundary artifacts:** Drone ở sát biên ô có thể nhảy qua lại giữa cell mà không thực sự xung đột.

---

## 6. Thuật toán 3: Vùng Cấm Bay (Zone Violation)

### Tiền bay

Hệ thống kiểm tra xem đường bay (LineString trong GeoJSON) có **giao với** vùng cấm (Polygon) không bằng phép toán hình học topo:

$$\text{route} \cap \text{zone} \neq \emptyset$$

Nhưng giao không gian chưa đủ — còn phải thỏa mãn đồng thời:
- **Điều kiện độ cao:** $alt_{route} \in [alt_{zone}^{min}, alt_{zone}^{max}]$
- **Điều kiện thời gian:** $[T_{route}^{start}, T_{route}^{end}] \cap [T_{zone}^{from}, T_{zone}^{to}] \neq \emptyset$

Ba điều kiện đều phải thỏa mãn mới tính là vi phạm.

### Trong chuyến bay

Kiểm tra **điểm hiện tại** (Point) thay vì LineString. Nhanh hơn vì chỉ cần kiểm tra vị trí tức thì, không cần quét toàn bộ route.

---

## 7. Thuật toán 4: Proximity Check (Thời gian thực)

### Nguyên lý

Khi drone đang bay, vị trí thực tế có thể lệch khỏi kế hoạch. Do đó, tiền bay không đủ — cần kiểm tra khoảng cách thực tế liên tục.

### Tối ưu 2 tầng

**Tầng 1 (Redis cache):** Vị trí mỗi drone được lưu vào Redis cache mỗi khi có telemetry mới. Việc đọc vị trí drone khác là O(1) thay vì truy vấn DB.

**Tầng 2 (Bounding-box pre-filter):** Trước khi tính Haversine (tốn kém), loại bỏ sơ bộ những drone chắc chắn ở xa bằng cách so sánh hiệu số lat/lng:

$$|\Delta lat| \leq \frac{R_{check}}{111{,}320\,\text{m/deg}}, \quad |\Delta lng| \leq \frac{R_{check}}{111{,}320 \cdot \cos(lat_{current})}$$

Với $R_{check} = 200\,\text{m}$. Chỉ drone nào lọt qua bounding box mới được tính Haversine chính xác.

### Phân loại mức độ nguy hiểm (Severity)

| Khoảng cách ngang $d_{XY}$ | Khoảng cách đứng $d_Z$ | Severity |
|:---|:---|:---|
| $< 30\,\text{m}$ | $< 10\,\text{m}$ | **CRITICAL** |
| $< 60\,\text{m}$ | $< 20\,\text{m}$ | **HIGH** |
| $< 100\,\text{m}$ | $< 30\,\text{m}$ | **MEDIUM** |

---

## 8. Thuật toán 5: Deviation Check

### Vì sao cần kiểm tra độ lệch?

Khi drone có kế hoạch bay PLANNED, drone được kỳ vọng đi theo một lộ trình cụ thể theo thời gian. Nếu drone lệch khỏi lộ trình, có thể xâm phạm vùng không phận chưa được phê duyệt.

### Quy trình

1. Nội suy vị trí kỳ vọng tại thời điểm hiện tại $t$: $P_{expected}(t) = \text{interpolate}(\text{plan.waypoints}, t)$
2. Vị trí thực tế từ telemetry: $P_{actual}$
3. Kiểm tra: $d_{XY}(P_{actual}, P_{expected}) > 100\,\text{m}$ → cảnh báo DEVIATION

---

## 9. Luồng tích hợp đầy đủ

```
Người dùng tạo Mission + gắn FlightPlan với thời gian
              ↓
   [Pre-flight check tự động]
   Pairwise + Segmentation + Zone Violation
   So sánh với TẤT CẢ mission trong hệ thống
              ↓
      Conflict? → 400 Block + Chi tiết
      Clear?    → MissionPlan được tạo
              ↓
   Khi kích hoạt Mission (→ ACTIVE):
   Re-check lần cuối toàn hệ thống
              ↓
   [In-flight monitoring] (mỗi telemetry packet)
   Proximity + Zone + Deviation + Battery
              ↓
   Conflict/Alert → WebSocket push đến client
```

---

## 10. Đặc điểm thiết kế quan trọng

### Phân tách trách nhiệm

| Lớp | Phương pháp | Mục tiêu |
|:---|:---|:---|
| Pre-flight | Pairwise 4D + Segmentation + Zone | Ngăn chặn xung đột trước khi bay |
| In-flight | Proximity + Zone + Deviation + Battery | Phát hiện và cảnh báo khi đang bay |

### Không có single point of failure

In-flight detection được kích hoạt theo hai con đường độc lập:
- **WebSocket path:** Trigger ngay khi nhận telemetry qua WebSocket (primary)
- **REST path:** Trigger khi drone dùng API thay vì WebSocket (fallback)

### Bất đồng bộ không chặn

Tất cả conflict check trong chuyến bay được thực hiện **non-blocking** — không làm chậm quá trình xử lý telemetry chính. Xung đột được phát hiện và cảnh báo song song, không ảnh hưởng đến luồng điều khiển chính.
