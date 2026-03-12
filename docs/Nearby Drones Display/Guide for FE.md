# Nearby Drones Display Guide

## Mục tiêu

Guide này hướng dẫn 2 client implement hiển thị drone xung quanh:

1. React Web cho Fleet Operator (trước khi bay + khi đang bay).
2. React Native Mobile cho Individual Operator (chỉ khi đang bay).

Backend đã hỗ trợ Socket.IO events và trả dữ liệu merge từ real drones + mock drones.

---

## Socket Endpoint

- URL: /ws
- Auth: JWT token qua socket.handshake.auth.token

Ví dụ kết nối (cả web và mobile):

```ts
import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
	path: "/ws",
	transports: ["websocket"],
	auth: {
		token: accessToken,
	},
});
```

---

## Events tổng quan

### Client -> Server

1. subscribe_plan_nearby
- Dùng cho Fleet Operator trước khi bay.
- Payload:

```json
{
	"flightPlanId": "67abc123...",
	"lat": 10.7769,
	"lng": 106.7009
}
```

2. subscribe_nearby
- Dùng khi đang bay (Fleet/Individual).
- Payload:

```json
{
	"sessionId": "67def456...",
	"lat": 10.7769,
	"lng": 106.7009
}
```

Lưu ý:
- lat/lng là optional cho subscribe_nearby. Nếu không truyền, server sẽ lấy vị trí từ Redis telemetry cache.
- Nếu chưa có telemetry cache thì nên truyền lat/lng từ client để tránh lỗi.

3. unsubscribe_nearby
- Dừng stream nearby.

```json
{}
```

### Server -> Client

1. nearby_subscribed

```json
{
	"sessionId": "67def456...",
	"radiusM": 1000
}
```

hoặc

```json
{
	"flightPlanId": "67abc123...",
	"radiusM": 1000
}
```

2. nearby_drones (push mỗi 1 giây)

```json
{
	"drones": [
		{
			"droneId": "DRONE-123",
			"lat": 10.7772,
			"lng": 106.7012,
			"altitude": 110,
			"heading": 62,
			"speed": 6,
			"isMock": false
		},
		{
			"droneId": "MOCK-DRONE-001",
			"lat": 10.778,
			"lng": 106.7001,
			"altitude": 95,
			"heading": 180,
			"speed": 5,
			"isMock": true
		}
	],
	"count": 2,
	"timestamp": 1710000000000
}
```

3. nearby_unsubscribed

```json
{}
```

4. error

```json
{
	"message": "..."
}
```

---

## Rule theo vai trò

1. Fleet Operator (Web React)
- Trước khi bay: dùng subscribe_plan_nearby.
- Khi đang bay: dùng subscribe_nearby.

2. Individual Operator (React Native)
- Chỉ khi đang bay: dùng subscribe_nearby.
- Không dùng subscribe_plan_nearby.

---

## React Web Guide (Fleet Operator)

## 1) Suggested hook

Tạo hook useNearbyDrones để tách logic socket:

```ts
import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

type NearbyDrone = {
	droneId: string;
	lat: number;
	lng: number;
	altitude: number;
	heading: number;
	speed: number;
	isMock: boolean;
};

type SubscribeMode =
	| { type: "plan"; flightPlanId: string; lat: number; lng: number }
	| { type: "session"; sessionId: string; lat?: number; lng?: number };

export function useNearbyDrones(accessToken: string, mode?: SubscribeMode) {
	const [drones, setDrones] = useState<NearbyDrone[]>([]);
	const [connected, setConnected] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const socketRef = useRef<Socket | null>(null);

	useEffect(() => {
		const socket = io("http://localhost:3000", {
			path: "/ws",
			transports: ["websocket"],
			auth: { token: accessToken },
		});
		socketRef.current = socket;

		socket.on("connect", () => setConnected(true));
		socket.on("disconnect", () => setConnected(false));
		socket.on("nearby_drones", (payload) => {
			setDrones(payload?.drones || []);
		});
		socket.on("error", (e) => {
			setError(e?.message || "Socket error");
		});

		return () => {
			socket.emit("unsubscribe_nearby", {});
			socket.disconnect();
		};
	}, [accessToken]);

	useEffect(() => {
		const socket = socketRef.current;
		if (!socket || !mode) return;

		setError(null);
		if (mode.type === "plan") {
			socket.emit("subscribe_plan_nearby", {
				flightPlanId: mode.flightPlanId,
				lat: mode.lat,
				lng: mode.lng,
			});
		} else {
			socket.emit("subscribe_nearby", {
				sessionId: mode.sessionId,
				lat: mode.lat,
				lng: mode.lng,
			});
		}

		return () => {
			socket.emit("unsubscribe_nearby", {});
		};
	}, [mode]);

	return { drones, connected, error };
}
```

## 2) Pre-flight map flow (Fleet)

1. User chọn flight plan trong UI.
2. Lấy điểm start của plan (lat/lng).
3. Call hook mode plan.
4. Render markers theo drones list.
5. Marker color recommendation:
- real drone: đỏ hoặc cam.
- mock drone: xanh dương.

## 3) In-flight flow (Fleet)

1. Khi session chuyển IN_PROGRESS, đổi mode từ plan sang session.
2. Nếu có GPS local thì vẫn truyền lat/lng để tránh trạng thái chưa có telemetry cache.
3. Cleanup bằng unsubscribe_nearby khi rời màn hình.

---

## React Native Guide (Individual Operator)

## 1) Khi nào subscribe

Chỉ subscribe sau khi có sessionId đang bay.

```ts
socket.emit("subscribe_nearby", {
	sessionId,
	lat: currentLat,
	lng: currentLng,
});
```

## 2) Background/foreground handling

Khi app vào background:
- emit unsubscribe_nearby.
- có thể giữ socket hoặc ngắt socket tùy policy app.

Khi app quay lại foreground:
- subscribe_nearby lại để resume stream.

## 3) Battery/network

Do server push mỗi 1 giây, nên ở mobile cần:
- chỉ bật nearby screen khi user đang ở map.
- unsubscribe ngay khi user rời map hoặc end session.

---

## UI/UX recommendation chung

1. Hiển thị số lượng nearby: Nearby (count).
2. Hiển thị legend:
- Real drone
- Mock drone
3. Cho filter toggle:
- Show real only
- Show mock only
4. Hiển thị info quick card khi click marker:
- droneId
- altitude
- speed
- heading

---

## Error handling checklist

1. Nếu nhận error FLEET_OPERATOR only:
- Không gọi subscribe_plan_nearby trên mobile/individual role.

2. Nếu nhận error no telemetry cached yet trên subscribe_nearby:
- Truyền thêm lat/lng từ client.

3. Nếu token hết hạn:
- reconnect socket sau khi refresh token.

4. Timeout/no data:
- Nếu >3 giây không nhận nearby_drones, hiển thị trạng thái Reconnecting hoặc No nearby drones.

---

## QA test cases

1. Fleet pre-flight:
- emit subscribe_plan_nearby hợp lệ.
- nhận nearby_drones mỗi 1 giây.

2. Fleet in-flight:
- emit subscribe_nearby bằng sessionId.
- verify list cập nhật realtime.

3. Individual in-flight:
- emit subscribe_nearby.
- verify không gọi subscribe_plan_nearby.

4. Cleanup:
- rời màn hình -> unsubscribe_nearby.
- không còn nhận event nearby_drones.

5. Mixed data:
- verify payload có cả isMock=true và isMock=false khi có dữ liệu real.

---

## Tài liệu backend liên quan

- [src/config/websocket.js](src/config/websocket.js)
- [src/modules/nearby/nearby.service.js](src/modules/nearby/nearby.service.js)
- [src/modules/nearby/mockDroneService.js](src/modules/nearby/mockDroneService.js)
- [src/config/redis.js](src/config/redis.js)
