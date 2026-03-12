# Performance & Telemetry Optimization Guide

**Status**: Active  
**Last Updated**: March 2026  
**Branch**: test/increase-performance

## 1) Mục tiêu

Tài liệu này là bản tổng hợp duy nhất cho toàn bộ tối ưu hiệu năng telemetry, bao gồm:
- Kiến trúc ingest telemetry theo hướng non-blocking
- Giảm tải ghi database bằng sampling + batch insert
- Tăng tốc conflict detection bằng dữ liệu vị trí thời gian thực trong Redis
- Giữ dữ liệu lịch sử có kiểm soát bằng TTL + endpoint aggregation
- Quy trình kiểm thử và vận hành thực tế

---

## 2) Vấn đề ban đầu

Hệ thống cũ lưu gần như mọi điểm telemetry vào MongoDB, dẫn đến:
- Tăng trưởng dữ liệu rất nhanh
- Truy vấn lịch sử và dashboard chậm
- Tải I/O database cao
- Độ trễ xử lý tăng khi số lượng drone tăng

---

## 3) Kiến trúc tối ưu hiện tại

Luồng dữ liệu chuẩn:

1. Drone gửi telemetry qua WebSocket
2. Gateway validate nhanh và ACK sớm
3. Vị trí mới nhất được cache trong Redis (TTL)
4. Telemetry được đưa vào Redis Stream để xử lý bất đồng bộ
5. Worker đọc stream, áp dụng sampling, gom batch
6. Batch insert vào MongoDB theo kích thước hoặc thời gian flush
7. Conflict detection lấy vị trí từ Redis cache để giảm truy vấn DB

### Sơ đồ logic

```
Drone → WebSocket Gateway → Redis Cache (latest location)
                           → Redis Stream (queue)
                           → ACK ngay (<5ms)

Redis Stream → Worker → Sampling + Batch → MongoDB
Redis Cache  → Conflict Detection (real-time checks)
```

---

## 4) Các tối ưu đã triển khai

### 4.1 Sampling dữ liệu telemetry

- Chỉ lưu một phần dữ liệu vào DB (ví dụ 1/10 điểm)
- Vẫn giữ khả năng xử lý an toàn thời gian thực qua stream/cache
- Giảm số lượng thao tác ghi DB đáng kể

Thông số chính:
- `TELEMETRY_SAMPLING_ENABLED=true`
- `TELEMETRY_SAMPLING_RATIO=10`
- `TELEMETRY_MIN_INTERVAL=1000`

### 4.2 Batch insert tại Worker

- Worker tích lũy record và ghi theo lô
- Flush khi đạt `BATCH_SIZE` hoặc hết `FLUSH_INTERVAL_MS`
- Giảm write amplification và tăng throughput

Thông số mặc định:
- `BATCH_SIZE=1000`
- `FLUSH_INTERVAL_MS=5000`

### 4.3 TTL cho telemetry history

- Tự động xóa dữ liệu cũ sau số ngày cấu hình
- Giữ database size ổn định theo thời gian

Thông số:
- `TELEMETRY_TTL_DAYS=7`

### 4.4 Tối ưu conflict detection

- Dùng dữ liệu vị trí mới nhất từ Redis cache
- Tránh truy vấn MongoDB liên tục cho mỗi điểm telemetry
- Giảm mạnh latency kiểm tra xung đột

### 4.5 Trimming stream chủ động

- Worker trim stream định kỳ để giới hạn bộ nhớ
- Duy trì kích thước queue trong ngưỡng an toàn

---

## 5) Kết quả hiệu năng kỳ vọng

Các con số dưới đây là mục tiêu/quan sát điển hình sau tối ưu (phụ thuộc tải thực tế):

- DB writes giảm khoảng 90%
- Query latency telemetry giảm mạnh (thường từ hàng trăm ms xuống vài chục ms)
- Conflict check latency giảm từ mức cao xuống mức realtime (ms thấp)
- Tăng khả năng scale theo số lượng drone đồng thời
- Giảm tốc độ tăng dung lượng lưu trữ theo ngày

---

## 6) Cấu hình môi trường khuyến nghị

Thêm/cập nhật trong `.env`:

```env
# Telemetry sampling
TELEMETRY_SAMPLING_ENABLED=true
TELEMETRY_SAMPLING_RATIO=10
TELEMETRY_MIN_INTERVAL=1000

# Data retention
TELEMETRY_TTL_DAYS=7

# Worker batching
BATCH_SIZE=1000
FLUSH_INTERVAL_MS=5000

# Redis / Mongo
REDIS_HOST=localhost
REDIS_PORT=6379
MONGODB_URI=mongodb://localhost:27017/utm
```

---

## 7) API phục vụ dashboard/analytics

Endpoint tổng hợp:

`GET /api/telemetry/:sessionId/aggregated?bucketSize=60000`

Ý nghĩa:
- Trả dữ liệu theo time bucket (min/max/avg/count)
- Giảm payload so với lấy raw telemetry
- Phù hợp dashboard và báo cáo lịch sử

---

## 8) Quy trình chạy nhanh

1. Cài dependencies
   - `npm install`
2. Khởi động services
   - `docker-compose up -d`
3. Chạy API server
   - `npm run dev`
4. Chạy worker
   - `npm run worker:dev`
5. Chạy mô phỏng telemetry (tuỳ chọn)
   - `npm run test:telemetry`

---

## 9) Checklist kiểm thử

### 9.1 Luồng dữ liệu end-to-end
- WebSocket nhận telemetry ổn định
- ACK trả về nhanh
- Worker nhận message và ghi batch thành công

### 9.2 Sampling
- Log worker thể hiện tỷ lệ sampled đúng cấu hình
- DB record tăng chậm hơn rõ rệt

### 9.3 Conflict detection
- Thời gian kiểm tra xung đột ở mức thấp (ms)
- Không phát sinh truy vấn DB lặp lại không cần thiết

### 9.4 TTL
- Index TTL tồn tại trong collection telemetry
- Dữ liệu quá hạn được dọn tự động

### 9.5 Stream health
- Stream length được kiểm soát bởi cơ chế trim
- Bộ nhớ Redis ổn định theo thời gian

---

## 10) Theo dõi vận hành

Gợi ý theo dõi định kỳ:
- Throughput worker (records/s)
- Batch insert time (ms)
- Sampling rate (%)
- Conflict check latency (ms)
- Redis memory + stream length
- Mongo collection size và tốc độ tăng trưởng

Script hỗ trợ:
- `node scripts/monitor-telemetry-performance.js`

---

## 11) Tuning theo tải

### Tải cao (nhiều drone, tần suất cao)
- Tăng `TELEMETRY_SAMPLING_RATIO` (ví dụ 20)
- Tăng `BATCH_SIZE` (ví dụ 2000)
- Tăng `FLUSH_INTERVAL_MS` (ví dụ 10000)

### Cần chi tiết lịch sử hơn
- Giảm `TELEMETRY_SAMPLING_RATIO` (ví dụ 5)
- Tăng `TELEMETRY_TTL_DAYS` (ví dụ 30)

### Hạn chế dung lượng lưu trữ
- Tăng mạnh sampling ratio
- Giảm TTL days

---

## 12) Troubleshooting nhanh

### Không thấy dữ liệu vào DB
- Kiểm tra worker có chạy và kết nối Redis/Mongo
- Kiểm tra stream có message
- Kiểm tra cấu hình env và restart tiến trình

### Sampling không đúng tỷ lệ
- Kiểm tra `TELEMETRY_SAMPLING_ENABLED`, `TELEMETRY_SAMPLING_RATIO`
- Kiểm tra log worker sau khi restart

### Stream tăng liên tục
- Kiểm tra tác vụ trim định kỳ
- Kiểm tra worker có lỗi hoặc bị dừng

### Truy vấn dashboard chậm
- Ưu tiên dùng endpoint `/aggregated`
- Kiểm tra index telemetry và tham số bucketSize

---

## 13) Phạm vi tài liệu

Tài liệu này thay thế toàn bộ các tài liệu performance rời trước đây trong thư mục `docs/Performance` để tránh trùng lặp nội dung và đảm bảo một nguồn sự thật duy nhất.
