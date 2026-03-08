# Multi-level Conflict Detection Strategies in UTM

Tài liệu này tổng hợp các phương pháp tiếp cận đa tầng để giải quyết bài toán phát hiện xung đột (Conflict Detection) trong quản lý không lưu không người lái (UTM), tập trung vào khả năng mở rộng (Scalability).

---

## 1. Airspace Segmentation & Spatial Partitioning

> [!TIP]
> **Đây là phương pháp Scalable nhất cho hệ thống UTM tập trung.**

### 📌 Ý tưởng

Thay vì kiểm tra chéo toàn bộ drone, không gian được chia thành các ô lưới (**Cells**) nhỏ (Grid, Hexagon, hoặc Sector). Hệ thống chỉ thực hiện kiểm tra xung đột giữa các drone nằm trong cùng một ô hoặc các ô lân cận.

### ⚙️ Phân tích độ phức tạp

- **Brute-Force (Pairwise):** $O(n^2)$ - Không thể đáp ứng khi số lượng UAV tăng cao.
- **Segmentation:** $O(n \log n)$ hoặc xấp xỉ $O(n)$.
  - Mỗi UAV chỉ cần so sánh với $k$ máy bay khác trong cùng một phạm vi giới hạn ($k \ll n$).

### 📊 Ví dụ so sánh (với $n = 10,000$ drones)

| Phương pháp                       | Công thức          | Số phép tính so sánh | Hiệu năng            |
| :-------------------------------- | :----------------- | :------------------- | :------------------- |
| **Brute-force**                   | $10,000^2$         | **100.000.000**      | Rất chậm ❌          |
| **Segmentation ($k \approx 10$)** | $10,000 \times 10$ | **100.000**          | Nhanh (~1000 lần) ✅ |

### ⚖️ Đánh giá

| ✅ Ưu điểm                                                        | ❌ Nhược điểm                                             |
| :---------------------------------------------------------------- | :-------------------------------------------------------- |
| Khả năng mở rộng (Scalability) cực tốt.                           | Cần tinh chỉnh kích thước ô (Cell size) phù hợp.          |
| Dễ dàng triển khai trên hệ thống phân tán (Distributed indexing). | Có thể gây ra False Positive ở các biên ô (Cell borders). |
| Phù hợp để tích hợp với Geofencing và NOTAM.                      |                                                           |

---

## 2. Sweep Line & Temporal Indexing

Phương pháp mạnh mẽ trong giai đoạn lập kế hoạch bay dựa trên thời gian.

### 📌 Ý tưởng

Sắp xếp các quỹ đạo drone theo cửa sổ thời gian (**Time Window**) hoặc dải độ cao (**Altitude Band**). Chỉ các chuyến bay có sự chồng lấn về thời gian hoặc không gian mới được đưa vào danh sách kiểm tra.

### ⚙️ Thông số kỹ thuật

- **Complexity:** $O(n \log n)$.
- **Ứng dụng chính:** _Flight Planning Conflict Detection_ (Phát hiện xung đột giai đoạn tiền flight).

### ⚖️ Đánh giá

- **✅ Ưu điểm:** Giảm thiểu tối đa việc kiểm tra giữa các chuyến bay không cùng khung giờ hoặc tầng bay.
- **❌ Nhược điểm:** Không xử lý tốt các chướng ngại vật động hoặc thay đổi lộ trình trong thời gian thực (Real-time dynamic updates).

---

## 3. Spatial Indexing (R-tree & KD-tree)

Phương pháp quản lý không gian dựa trên cơ sở dữ liệu (Database-level scaling).

### 📌 Ý tưởng

Sử dụng các cấu trúc dữ liệu cây không gian (Spatial Trees) để index vị trí của toàn bộ UAV. Khi cần kiểm tra, hệ thống thực hiện truy vấn vùng (Range query) để tìm các UAV trong bán kính an toàn $R$.

### ⚙️ Thông số kỹ thuật

- **Insert:** $O(\log n)$.
- **Query:** $O(\log n)$.
- **Hỗ trợ công nghệ:** Sẵn có trong PostGIS, MongoDB Geospatial, Redis GEO, Elasticsearch Geo.

### ⚖️ Đánh giá

- **✅ Ưu điểm:** Tối ưu cực tốt cho dữ liệu Telemetry (tọa độ thời gian thực).
- **❌ Nhược điểm:** Cần kết hợp thêm các thuật toán dự báo quỹ đạo (Trajectory prediction) để tăng độ chính xác thay vì chỉ check vị trí tức thời.

---

## 4. ORCA / RVO (Decentralized Scaling)

Giải pháp tránh va chạm phi tập trung (Avoidance) được thực thi trực tiếp trên drone.

### 📌 Ý tưởng

Mỗi drone tự tính toán vận tốc an toàn dựa trên vị trí và vận tốc của các drone lân cận (Neighbors) mà không cần máy chủ trung tâm ra lệnh.

### ⚙️ Thông số kỹ thuật

- **Complexity:** $O(k)$ (Trong đó $k$ là số drones lân cận).
- **Cơ chế:** Phân tán hoàn toàn (Distributed).

### ⚖️ Đánh giá

- **✅ Ưu điểm:** Khả năng mở rộng vô hạn vì không phụ thuộc vào hạ tầng Server trung tâm.
- **❌ Nhược điểm:** Chỉ hoạt động hiệu quả khi các drone có sự hiệp tác (Cooperative clients) và chia sẻ trạng thái với nhau.

---

## 🚀 Tổng kết lựa chọn trong UTM

1.  **Giai đoạn Pre-flight:** Ưu tiên **Sweep Line** và **Segmentation**.
2.  **Giai đoạn In-flight (Tracking):** Ưu tiên **Spatial Indexing** (R-tree/Redis GEO) để tracking hàng ngàn UAV theo thời gian thực.
3.  **Hàng rào an toàn cuối cùng (Last-mile safety):** Sử dụng **ORCA/VO** ngay trên thiết bị để tránh va chạm khẩn cấp.
