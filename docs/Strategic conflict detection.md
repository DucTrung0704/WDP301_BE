1️⃣ Bối cảnh áp dụng (nhắc lại cho đúng ICAO Level 3)

Cả Pairwise Conflict Detection và Airspace Segmentation đều được dùng cho:

UTM ICAO Level 3 – Strategic Deconfliction

Giai đoạn pre-flight

Dựa trên 4D flight plan

Không xét điều khiển real-time

📌 Mục tiêu chung:

Phát hiện loss of separation giữa các UAV trước khi cấp phép bay.

2️⃣ Thuật toán 1: Pairwise 4D Trajectory Conflict Detection
📌 Nguyên lý

So sánh từng cặp UAV tại các thời điểm rời rạc để kiểm tra khoảng cách an toàn.

📥 Input

Tập kế hoạch bay UAV:
U = {U1, U2, …, Un}

Mỗi UAV có quỹ đạo 4D:
(x(t), y(t), z(t), t)

Ngưỡng an toàn:

Khoảng cách ngang D_min

Khoảng cách đứng H_min

⚙️ Các bước

Duyệt từng cặp UAV (i, j)

Kiểm tra khoảng thời gian bay chồng lấn

Chia thời gian thành các bước Δt

Tại mỗi t:

Tính d_xy và d_z

Nếu:

d_xy < D_min AND d_z < H_min

→ phát hiện xung đột

📤 Output

Cặp UAV xung đột

Thời điểm xảy ra

Vị trí xung đột

✅ Ưu điểm

Dễ hiểu, dễ cài đặt

Phù hợp nhóm nhỏ, số UAV ít

Là baseline tốt để so sánh

❌ Nhược điểm

Độ phức tạp O(n²)

Khó mở rộng khi mật độ UAV cao

3️⃣ Thuật toán 2: Airspace Segmentation–based Conflict Detection
📌 Nguyên lý

Không phận được chia thành các cell 3D và time slot.
Xung đột xảy ra nếu nhiều UAV chiếm cùng cell tại cùng time slot.

📥 Input

Không phận 3D đã phân vùng

Thời gian chia thành các slot Δt

Quỹ đạo UAV 4D

⚙️ Các bước

Chia không gian thành các cell (x, y, z)

Chia thời gian thành các slot

Với mỗi UAV tại mỗi t:

Gán UAV vào cell tương ứng

Tạo occupancy map

Nếu 1 cell–time có ≥ 2 UAV → conflict

📤 Output

Cell xảy ra xung đột

Thời gian

Danh sách UAV liên quan

✅ Ưu điểm

Độ phức tạp gần O(n)

Rất phù hợp mật độ UAV cao

Trực quan, dễ mở rộng

❌ Nhược điểm

Phụ thuộc kích thước cell

Có sai số rời rạc

Cần xử lý UAV ở biên cell

4️⃣ So sánh tổng hợp (bảng chuẩn đồ án)
Tiêu chí Pairwise Airspace Segmentation
Cách tiếp cận So sánh từng cặp Chiếm dụng cell
Mô hình Liên tục (theo mẫu thời gian) Rời rạc
Độ chính xác Cao Phụ thuộc cell
Độ phức tạp O(n²) ≈ O(n)
Mật độ UAV Thấp Trung bình – cao
Dễ cài đặt Rất dễ Trung bình
Trực quan Trung bình Cao
Phù hợp Level 3 ✅ ✅
Giá trị học thuật Cơ bản Cao hơn
5️⃣ Cách dùng CẢ HAI trong đồ án (rất khôn)

👉 Pairwise:

Dùng làm baseline

Áp dụng cho số UAV ít

So sánh độ chính xác

👉 Segmentation:

Thuật toán chính

Áp dụng cho kịch bản mật độ cao

Chứng minh khả năng mở rộng

📌 Ghi trong đồ án:

“Thuật toán pairwise được sử dụng làm phương pháp tham chiếu, trong khi airspace segmentation được đề xuất nhằm cải thiện khả năng mở rộng cho quản lý UAV mật độ cao.”
