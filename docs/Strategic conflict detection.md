# Strategic Conflict Detection (ICAO Level 3)

## 1. Bối cảnh áp dụng

Cả **Pairwise Conflict Detection** và **Airspace Segmentation** đều được ứng dụng trong:

- **UTM ICAO Level 3:** Strategic Deconfliction (Phân tách xung đột chiến lược).
- **Giai đoạn:** Pre-flight (Trước khi bay).
- **Dựa trên:** Quỹ đạo bay 4D (4D Flight Plan).
- **Đặc điểm:** Không xét điều khiển thời gian thực (real-time).

> [!IMPORTANT]
> **Mục tiêu chung:** Phát hiện vi phạm khoảng cách an toàn (loss of separation) giữa các UAV trước khi cấp phép bay vào hệ thống.

---

## 2. Thuật toán 1: Pairwise 4D Trajectory Conflict Detection

### 📌 Nguyên lý

So sánh trực tiếp từng cặp UAV tại các thời điểm rời rạc trong suốt lộ trình bay để kiểm tra khoảng cách an toàn.

### 📥 Input

- **Tập kế hoạch bay UAV:** $U = \{U_1, U_2, \dots, U_n\}$
- **Quỹ đạo 4D mỗi UAV:** $(x(t), y(t), z(t), t)$
- **Ngưỡng an toàn (Separation Thresholds):**
  - Khoảng cách ngang ($D_{min}$)
  - Khoảng cách đứng ($H_{min}$)

### ⚙️ Các bước thực hiện

1.  Duyệt qua từng cặp UAV $(i, j)$ trong danh sách.
2.  Xác định khoảng thời gian bay chồng lấn giữa hai UAV.
3.  Chia thời gian thành các bước nhỏ $\Delta t$.
4.  Tại mỗi thời điểm $t$:
    - Tính khoảng cách ngang $d_{xy}$ và khoảng cách đứng $d_z$.
    - **Nếu:** $d_{xy} < D_{min}$ **VÀ** $d_z < H_{min} \rightarrow$ **Xung đột được xác định.**

### 📤 Output

- Danh sách các cặp UAV xung đột.
- Thời điểm và vị trí cụ thể xảy ra xung đột.

### ⚖️ Đánh giá

| ✅ Ưu điểm                                         | ❌ Nhược điểm                                    |
| :------------------------------------------------- | :----------------------------------------------- |
| Dễ hiểu, dễ cài đặt và triển khai.                 | Độ phức tạp thuật toán cao: $O(n^2)$.            |
| Phù hợp với nhóm nhỏ hoặc kịch bản ít UAV.         | Khó mở rộng khi mật độ UAV trong không phận cao. |
| Là phương pháp nền tảng (baseline) tốt để so sánh. |                                                  |

---

## 3. Thuật toán 2: Airspace Segmentation–based Conflict Detection

### 📌 Nguyên lý

Không phận được chia thành các ô lưới (cells) 3D và các khoảng thời gian (time slots). Xung đột được xác định nếu có từ hai UAV trở lên cùng chiếm một cell tại một time slot nhất định.

### 📥 Input

- Không phận 3D đã được phân vùng (Grid-based).
- Thời gian được chia thành các slot $\Delta t$.
- Quỹ đạo 4D của các UAV.

### ⚙️ Các bước thực hiện

1.  **Voxelization:** Chia không gian thành các cell nhỏ $(x, y, z)$.
2.  **Time Slotting:** Chia thời gian thành các slot tương ứng.
3.  Với mỗi UAV tại mỗi thời điểm $t$:
    - Gán UAV vào cell tương ứng dựa trên tọa độ.
    - Tạo bản đồ chiếm dụng (**Occupancy Map**).
4.  **Kiểm tra:** Nếu một cặp (cell, time) chứa $\ge 2$ UAV $\rightarrow$ **Xung đột được xác định.**

### 📤 Output

- Danh sách các cell xảy ra xung đột.
- Thời gian xảy ra xung đột.
- Danh sách các UAV liên quan trong từng cell.

### ⚖️ Đánh giá

| ✅ Ưu điểm                                        | ❌ Nhược điểm                                    |
| :------------------------------------------------ | :----------------------------------------------- |
| Hiệu suất cao, độ phức tạp xấp xỉ $O(n)$.         | Phụ thuộc nhiều vào kích thước cell (Grid size). |
| Rất phù hợp với môi trường có mật độ UAV dày đặc. | Có thể xảy ra sai số do rời rạc hóa.             |
| Trực quan và dễ dàng mở rộng quy mô.              | Cần thuật toán bổ trợ xử lý UAV ở biên cell.     |

---

## 4. So sánh tổng hợp

| Tiêu chí              | Pairwise Case                 | Airspace Segmentation                    |
| :-------------------- | :---------------------------- | :--------------------------------------- |
| **Cách tiếp cận**     | So sánh từng cặp trực tiếp    | Dựa trên chiếm dụng không gian/thời gian |
| **Mô hình**           | Liên tục (theo mẫu thời gian) | Rời rạc hóa (Grid-based)                 |
| **Độ chính xác**      | Cao                           | Phụ thuộc vào kích thước Cell            |
| **Độ phức tạp**       | $O(n^2)$                      | $\approx O(n)$                           |
| **Mật độ UAV**        | Thấp                          | Trung bình - Cao                         |
| **Độ khó cài đặt**    | Dễ                            | Trung bình                               |
| **Tính trực quan**    | Trung bình                    | Cao                                      |
| **Phù hợp Level 3**   | ✅ Có                         | ✅ Có                                    |
| **Giá trị học thuật** | Cơ bản                        | Cao hơn (Optimization)                   |

---

## 5. Định hướng ứng dụng trong Đồ án

Trong đồ án này, chúng ta sẽ kết hợp cả hai phương pháp để tối ưu hóa kết quả:

- **Phương pháp Pairwise:** Sử dụng làm **Baseline** (phương pháp tham chiếu) để kiểm chứng độ chính xác và áp dụng cho các kịch bản thử nghiệm quy mô nhỏ.
- **Phương pháp Segmentation:** Sử dụng làm **Thuật toán chính** để giải quyết các kịch bản mật độ cao, chứng minh khả năng mở rộng của hệ thống UTM.

> [!TIP]
> **Cách ghi trong đồ án:**
> "Thuật toán **Pairwise** được sử dụng làm phương pháp tham chiếu (reference method) để đảm bảo tính chính xác, trong khi **Airspace Segmentation** được đề xuất như một giải pháp tối ưu nhằm cải thiện hiệu suất và khả năng mở rộng cho bài toán quản lý UAV mật độ cao."
