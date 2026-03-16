# Drone Telemetry Ingestion Architecture

## Overview
Kiến trúc này được thiết kế cho hệ thống **tracking drone realtime với tần suất telemetry cao**.

Mục tiêu chính:
- Không overload Backend
- Không overload MongoDB
- Hỗ trợ scale lên hàng nghìn drone
- Phân tách realtime và storage

## Architecture Flow
```text
Drone
  -> Socket.IO Gateway
  -> Redis (latest location)
  -> Redis Stream / Kafka
  -> Telemetry Worker
  -> Batch Insert
  -> MongoDB TimeSeries
```

## 1. Drone
Drone gửi telemetry liên tục qua WebSocket.

Ví dụ payload:
```json
{
  "droneId": "drone-001",
  "lat": 10.8231,
  "lng": 106.6297,
  "alt": 120,
  "speed": 15.2,
  "timestamp": "2026-03-09T10:15:20Z"
}
```

Telemetry frequency thường:
- 1 Hz
- 5 Hz
- 10 Hz
- 20 Hz

Ví dụ tải:
- Nếu có `100 drones x 10Hz` -> `1000 messages/sec`

## 2. Socket.IO Gateway
Socket Gateway có nhiệm vụ:
- Maintain connection với drone
- Receive telemetry data
- Validate data
- Forward message vào stream

Responsibilities:
- Authentication
- Schema validation
- Rate limit
- Forward message

Nguyên tắc quan trọng:
- Socket server không ghi database
- Socket server chỉ làm: `receive -> validate -> enqueue`

## 3. Redis (Latest Location)
Redis được dùng để lưu vị trí mới nhất của drone.

Key example:
```text
drone:{droneId}:location
```

Value example:
```json
{
  "lat": 10.8231,
  "lng": 106.6297,
  "alt": 120,
  "ts": 1710000000
}
```

Mục đích:
- UI map realtime
- Query cực nhanh
- Không cần query MongoDB

Frontend chỉ cần đọc Redis để hiển thị drone.

## 4. Redis Stream / Kafka
Stream layer đóng vai trò buffer giữa ingestion và database.

Mục tiêu:
- Absorb traffic spikes
- Decouple system
- Allow async processing

Message example:
```json
{
  "droneId": "drone-001",
  "lat": 10.8231,
  "lng": 106.6297,
  "alt": 120,
  "timestamp": 1710000000
}
```

Lựa chọn công nghệ:
- Small / Medium system: Redis Streams
- Large scale system: Kafka

## 5. Telemetry Worker
Worker đọc dữ liệu từ stream.

Responsibilities:
- Consume telemetry messages
- Transform data
- Buffer messages
- Batch insert vào database

Workers có thể scale:
- Worker 1
- Worker 2
- Worker 3
- Worker N

## 6. Batch Insert
Không insert từng record.

Thay vào đó:
- `buffer -> batch insert`

Ví dụ strategy:
- Collect trong 1 giây
- Bulk insert

Pseudo code NodeJS:
```js
const buffer = [];

function addTelemetry(data) {
  buffer.push(data);
}

setInterval(async () => {
  if (buffer.length === 0) return;

  const batch = buffer.splice(0, buffer.length);
  await telemetryCollection.insertMany(batch);
}, 1000);
```

Lợi ích:
- Ví dụ: `1000 messages/sec`
- Without batching: `1000 DB writes/sec`
- With batching: `1 write / 1000 records`

Giảm cực mạnh DB load.

## 7. MongoDB TimeSeries
MongoDB hỗ trợ TimeSeries Collection rất phù hợp telemetry.

Advantages:
- Optimized for time data
- Bucket compression
- Faster range query
- Lower storage

Example schema:
```json
{
  "droneId": "drone-001",
  "timestamp": "2026-03-09T10:15:20Z",
  "location": {
    "type": "Point",
    "coordinates": [106.6297, 10.8231]
  },
  "alt": 120,
  "speed": 15.2
}
```

Index:
```js
{ droneId: 1, timestamp: -1 }
```

Common queries:
- flight replay
- route tracking
- analytics

## Scalability
Kiến trúc này scale bằng cách tăng:
- Socket Layer
- Socket Gateway 1
- Socket Gateway 2
- Socket Gateway 3
- Stream
- Kafka partitions
- Worker
- Telemetry Worker x N

## Production Data Flow
1. Drone gửi telemetry
2. Socket Gateway nhận message
3. Redis lưu latest location
4. Message push vào Redis Stream / Kafka
5. Worker consume message
6. Worker buffer data
7. Batch insert MongoDB

## Key Design Principles
1. Decouple ingestion và storage
Socket không ghi DB.

2. Buffer data
Stream giúp absorb spikes.

3. Cache realtime state
Redis giữ latest location.

4. Batch write
Giảm DB I/O.

5. TimeSeries database
Tối ưu cho telemetry.

## Result
Hệ thống đạt được:
- realtime drone tracking
- high ingestion throughput
- low database load
- scalable architecture
- suitable for large drone fleets