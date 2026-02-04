// swagger.docs.js
// File chứa tất cả Swagger/OpenAPI annotations cho các API endpoints

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Đăng ký tài khoản mới
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "password123"
 *             fullName: "John Doe"
 *             role: "FLEET_OPERATOR"
 *     responses:
 *       201:
 *         description: Đăng ký thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 _id: "507f1f77bcf86cd799439011"
 *                 email: "user@example.com"
 *                 profile:
 *                   fullName: "John Doe"
 *                 role: "INDIVIDUAL_OPERATOR"
 *                 status: "active"
 *       400:
 *         description: Thiếu thông tin bắt buộc
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Missing fields"
 *       409:
 *         description: Email đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Email already exists"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Register failed"
 */

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập vào hệ thống
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           example:
 *             email: "user@example.com"
 *             password: "password123"
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *               user:
 *                 _id: "507f1f77bcf86cd799439011"
 *                 email: "user@example.com"
 *                 profile:
 *                   fullName: "John Doe"
 *                 role: "INDIVIDUAL_OPERATOR"
 *                 status: "active"
 *       401:
 *         description: Thông tin đăng nhập không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Invalid credentials"
 *       403:
 *         description: Tài khoản bị vô hiệu hóa
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Account disabled"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Login failed"
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất khỏi hệ thống
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       401:
 *         description: Chưa được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Unauthorized"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Logout failed"
 */

/**
 * @swagger
 * tags:
 *   - name: Admin
 *     description: Quản lý tài khoản (chỉ UTM_ADMIN)
 */

/**
 * @swagger
 * /api/admin/users:
 *   get:
 *     summary: Danh sách tất cả người dùng (chỉ UTM_ADMIN)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   post:
 *     summary: Tạo mới người dùng (chỉ UTM_ADMIN)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, fullName]
 *             properties:
 *               fullName:
 *                 type: string
 *                 example: "userthul"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "userthul@gmail.com"
 *               password:
 *                 type: string
 *                 format: password
 *                 example: "123456"
 *               role:
 *                 type: string
 *                 enum: [INDIVIDUAL_OPERATOR, FLEET_OPERATOR]
 *                 example: "FLEET_OPERATOR"
 *               status:
 *                 type: string
 *                 enum: [active, inactive, banned]
 *                 example: "active"
 *     responses:
 *       201:
 *         description: Người dùng được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *             example:
 *               data:
 *                 user:
 *                   _id: "696f32e9bd108ced66f635e0"
 *                   email: "userthul@gmail.com"
 *                   password: "$2b$10$2UEzp14XRYov8xQ5ky0hm.BfGkt2Yk2mP5UBXqPd4KDnke3FzSu30"
 *                   profile:
 *                     fullName: "userthul"
 *                   providers:
 *                     local: true
 *                   role: "FLEET_OPERATOR"
 *                   status: "active"
 *                   createdAt: "2026-01-20T07:46:49.5362"
 *                   updatedAt: "2026-01-20T07:46:49.5362"
 *                   __v: 0
 *       400:
 *         description: Bad request - Thiếu thông tin bắt buộc
 *       401:
 *         description: Unauthorized - Không được xác thực
 *       403:
 *         description: Forbidden - Chỉ UTM_ADMIN mới được tạo user
 *       409:
 *         description: Conflict - Email đã tồn tại
 *
 * /api/admin/users/{id}:
 *   get:
 *     summary: Xem chi tiết người dùng (chỉ UTM_ADMIN)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 *   put:
 *     summary: Cập nhật người dùng (chỉ UTM_ADMIN)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [INDIVIDUAL_OPERATOR, FLEET_OPERATOR]
 *               status:
 *                 type: string
 *                 enum: [active, inactive, banned]
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *
 *   delete:
 *     summary: Xoá người dùng (chỉ UTM_ADMIN)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 */

/**
 * @swagger
 * tags:
 *   - name: Drones
 *     description: Quản lý drone của người dùng
 */

/**
 * @swagger
 * /api/drones:
 *   post:
 *     summary: Tạo mới drone
 *     tags: [Drones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateDroneRequest'
 *           example:
 *             droneId: "DRONE001"
 *             serialNumber: "SN123456"
 *             model: "DJI Air 3"
 *             ownerType: "INDIVIDUAL"
 *             maxAltitude: 5000
 *     responses:
 *       201:
 *         description: Tạo drone thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DroneResponse'
 *       400:
 *         description: Thiếu thông tin bắt buộc
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Không được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Drone ID đã tồn tại
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Drone already exists"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   get:
 *     summary: Lấy danh sách tất cả drone của user hiện tại
 *     tags: [Drones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/DroneResponse'
 *       401:
 *         description: Không được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *
 * /api/drones/{id}:
 *   get:
 *     summary: Lấy chi tiết drone theo ID
 *     tags: [Drones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DroneResponse'
 *       401:
 *         description: Không được xác thực
 *       403:
 *         description: Không được phép - bạn không sở hữu drone này
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Unauthorized: You don't own this drone"
 *       404:
 *         description: Không tìm thấy drone
 *       500:
 *         description: Lỗi server
 *
 *   put:
 *     summary: Cập nhật thông tin drone
 *     tags: [Drones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateDroneRequest'
 *           example:
 *             model: "DJI Air 3S"
 *             maxAltitude: 6000
 *             status: "IDLE"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/DroneResponse'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *       401:
 *         description: Không được xác thực
 *       403:
 *         description: Không được phép - bạn không sở hữu drone này
 *       404:
 *         description: Không tìm thấy drone
 *       500:
 *         description: Lỗi server
 *
 *   delete:
 *     summary: Xoá drone
 *     tags: [Drones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xoá thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Drone deleted successfully"
 *       401:
 *         description: Không được xác thực
 *       403:
 *         description: Không được phép - bạn không sở hữu drone này
 *       404:
 *         description: Không tìm thấy drone
 *       500:
 *         description: Lỗi server
 */

/**
 * @swagger
 * tags:
 *   - name: Zones
 *     description: Quản lý vùng cấm bay và vùng hạn chế (No-Fly Zones & Restricted Zones)
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     GeoJSONPolygon:
 *       type: object
 *       required:
 *         - type
 *         - coordinates
 *       properties:
 *         type:
 *           type: string
 *           enum: [Polygon]
 *           example: "Polygon"
 *         coordinates:
 *           type: array
 *           items:
 *             type: array
 *             items:
 *               type: array
 *               items:
 *                 type: number
 *           description: "Mảng tọa độ polygon theo định dạng GeoJSON [lng, lat]. Điểm đầu và cuối phải giống nhau."
 *           example: [[[106.6297, 10.8231], [106.6397, 10.8231], [106.6397, 10.8331], [106.6297, 10.8331], [106.6297, 10.8231]]]
 *
 *     CreateZoneRequest:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - geometry
 *         - maxAltitude
 *       properties:
 *         name:
 *           type: string
 *           description: Tên của zone
 *           example: "Tan Son Nhat Airport"
 *         description:
 *           type: string
 *           description: Mô tả chi tiết về zone
 *           example: "No-fly zone around Tan Son Nhat International Airport"
 *         type:
 *           type: string
 *           enum: [no_fly, restricted]
 *           description: "Loại zone: no_fly (cấm bay hoàn toàn) hoặc restricted (hạn chế)"
 *           example: "no_fly"
 *         geometry:
 *           $ref: '#/components/schemas/GeoJSONPolygon'
 *         minAltitude:
 *           type: number
 *           minimum: 0
 *           default: 0
 *           description: Độ cao tối thiểu của zone (meters)
 *           example: 0
 *         maxAltitude:
 *           type: number
 *           minimum: 0
 *           description: Độ cao tối đa của zone (meters). Phải >= minAltitude
 *           example: 3000
 *         effectiveFrom:
 *           type: string
 *           format: date-time
 *           description: Thời gian zone bắt đầu có hiệu lực
 *           example: "2026-01-01T00:00:00Z"
 *         effectiveTo:
 *           type: string
 *           format: date-time
 *           description: Thời gian zone hết hiệu lực (nếu không có thì vĩnh viễn)
 *           example: "2027-01-01T00:00:00Z"
 *
 *     ZoneResponse:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           example: "507f1f77bcf86cd799439011"
 *         name:
 *           type: string
 *           example: "Tan Son Nhat Airport"
 *         description:
 *           type: string
 *           example: "No-fly zone around Tan Son Nhat International Airport"
 *         type:
 *           type: string
 *           enum: [no_fly, restricted]
 *           example: "no_fly"
 *         status:
 *           type: string
 *           enum: [active, inactive, archived]
 *           example: "active"
 *         geometry:
 *           $ref: '#/components/schemas/GeoJSONPolygon'
 *         minAltitude:
 *           type: number
 *           example: 0
 *         maxAltitude:
 *           type: number
 *           example: 3000
 *         effectiveFrom:
 *           type: string
 *           format: date-time
 *           example: "2026-01-01T00:00:00Z"
 *         effectiveTo:
 *           type: string
 *           format: date-time
 *           example: "2027-01-01T00:00:00Z"
 *         createdBy:
 *           type: string
 *           example: "507f1f77bcf86cd799439012"
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-20T07:46:49.536Z"
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-01-20T07:46:49.536Z"
 *
 *     CheckPointRequest:
 *       type: object
 *       required:
 *         - lat
 *         - lng
 *         - altitude
 *       properties:
 *         lat:
 *           type: number
 *           description: Vĩ độ của điểm cần kiểm tra
 *           example: 10.8231
 *         lng:
 *           type: number
 *           description: Kinh độ của điểm cần kiểm tra
 *           example: 106.6297
 *         altitude:
 *           type: number
 *           description: Độ cao của điểm cần kiểm tra (meters)
 *           example: 100
 *
 *     CheckPointResponse:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [allowed, no_fly, restricted]
 *           description: "Trạng thái: allowed (được bay), no_fly (cấm bay), restricted (hạn chế)"
 *           example: "no_fly"
 *         message:
 *           type: string
 *           description: Thông báo chi tiết
 *           example: "No Fly Zone Detected"
 *         zones:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *               name:
 *                 type: string
 *                 example: "Tan Son Nhat Airport"
 *               type:
 *                 type: string
 *                 enum: [no_fly, restricted]
 *                 example: "no_fly"
 *               minAltitude:
 *                 type: number
 *                 example: 0
 *               maxAltitude:
 *                 type: number
 *                 example: 3000
 */

/**
 * @swagger
 * /api/zones:
 *   post:
 *     summary: Tạo mới một zone (vùng cấm bay/hạn chế)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateZoneRequest'
 *           example:
 *             name: "Tan Son Nhat Airport"
 *             description: "No-fly zone around Tan Son Nhat International Airport"
 *             type: "no_fly"
 *             geometry:
 *               type: "Polygon"
 *               coordinates: [[[106.6297, 10.8231], [106.6397, 10.8231], [106.6397, 10.8331], [106.6297, 10.8331], [106.6297, 10.8231]]]
 *             minAltitude: 0
 *             maxAltitude: 3000
 *             effectiveFrom: "2026-01-01T00:00:00Z"
 *     responses:
 *       201:
 *         description: Tạo zone thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZoneResponse'
 *       400:
 *         description: Dữ liệu không hợp lệ (thiếu field bắt buộc, polygon không hợp lệ, maxAltitude < minAltitude)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               missingFields:
 *                 value:
 *                   message: "Zone validation failed: name is required"
 *               invalidPolygon:
 *                 value:
 *                   message: "Invalid Polygon: First and last points must be identical."
 *               selfIntersection:
 *                 value:
 *                   message: "Invalid Polygon: Self-intersection detected."
 *               altitudeError:
 *                 value:
 *                   message: "maxAltitude must be greater than or equal to minAltitude."
 *       401:
 *         description: Không được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Failed to create zone"
 *
 *   get:
 *     summary: Lấy danh sách tất cả zones
 *     description: |
 *       Lấy danh sách zones với các tính năng:
 *       - **Pagination**: Phân trang với page và limit
 *       - **Search**: Tìm kiếm theo tên zone
 *       - **Filter**: Lọc theo status và type
 *       - **Sort**: Sắp xếp theo các trường khác nhau
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: "Số trang (bắt đầu từ 1)"
 *         example: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: "Số lượng zones mỗi trang (tối đa 100)"
 *         example: 10
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *         description: "Tìm kiếm theo tên zone (case-insensitive)"
 *         example: "Airport"
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [active, inactive, archived]
 *         description: "Lọc theo trạng thái zone. Mặc định ẩn zones có status 'archived'"
 *         example: "active"
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [no_fly, restricted]
 *         description: "Lọc theo loại zone"
 *         example: "no_fly"
 *       - name: sortBy
 *         in: query
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, type, minAltitude, maxAltitude]
 *           default: createdAt
 *         description: "Trường để sắp xếp"
 *         example: "createdAt"
 *       - name: sortOrder
 *         in: query
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: "Thứ tự sắp xếp (asc: tăng dần, desc: giảm dần)"
 *         example: "desc"
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ZoneResponse'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                       example: 1
 *                     totalPages:
 *                       type: integer
 *                       example: 5
 *                     totalCount:
 *                       type: integer
 *                       example: 50
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     hasNextPage:
 *                       type: boolean
 *                       example: true
 *                     hasPrevPage:
 *                       type: boolean
 *                       example: false
 *             example:
 *               data:
 *                 - _id: "507f1f77bcf86cd799439011"
 *                   name: "Tan Son Nhat Airport"
 *                   description: "No-fly zone around TSN Airport"
 *                   type: "no_fly"
 *                   status: "active"
 *                   geometry:
 *                     type: "Polygon"
 *                     coordinates: [[[106.6297, 10.8231], [106.6397, 10.8231], [106.6397, 10.8331], [106.6297, 10.8331], [106.6297, 10.8231]]]
 *                   minAltitude: 0
 *                   maxAltitude: 3000
 *                   createdAt: "2026-01-20T07:46:49.536Z"
 *                   updatedAt: "2026-01-20T07:46:49.536Z"
 *               pagination:
 *                 currentPage: 1
 *                 totalPages: 5
 *                 totalCount: 50
 *                 limit: 10
 *                 hasNextPage: true
 *                 hasPrevPage: false
 *       401:
 *         description: Không được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Failed to retrieve zones"
 */

/**
 * @swagger
 * /api/zones/check:
 *   post:
 *     summary: Kiểm tra xem một điểm (lat, lng, altitude) có nằm trong zone nào không
 *     description: |
 *       Kiểm tra spatial status của một điểm với tọa độ và độ cao cho trước.
 *       API sẽ kiểm tra:
 *       - Điểm có nằm trong bất kỳ zone active nào không (sử dụng $geoIntersects)
 *       - Độ cao có nằm trong khoảng [minAltitude, maxAltitude] của zone không
 *       - Zone có đang trong thời gian hiệu lực không (effectiveFrom/effectiveTo)
 *
 *       Kết quả trả về có 3 trạng thái:
 *       - **allowed**: Điểm không nằm trong zone nào, được phép bay (cần thận trọng)
 *       - **no_fly**: Điểm nằm trong ít nhất 1 zone cấm bay
 *       - **restricted**: Điểm nằm trong zone hạn chế (không có zone cấm bay)
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckPointRequest'
 *           example:
 *             lat: 10.8231
 *             lng: 106.6297
 *             altitude: 100
 *     responses:
 *       200:
 *         description: Kiểm tra thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CheckPointResponse'
 *             examples:
 *               allowed:
 *                 summary: Điểm được phép bay
 *                 value:
 *                   status: "allowed"
 *                   message: "Use caution"
 *                   zones: []
 *               noFly:
 *                 summary: Điểm nằm trong vùng cấm bay
 *                 value:
 *                   status: "no_fly"
 *                   message: "No Fly Zone Detected"
 *                   zones:
 *                     - id: "507f1f77bcf86cd799439011"
 *                       name: "Tan Son Nhat Airport"
 *                       type: "no_fly"
 *                       minAltitude: 0
 *                       maxAltitude: 3000
 *               restricted:
 *                 summary: Điểm nằm trong vùng hạn chế
 *                 value:
 *                   status: "restricted"
 *                   message: "Restricted Zone Detected"
 *                   zones:
 *                     - id: "507f1f77bcf86cd799439012"
 *                       name: "Military Training Area"
 *                       type: "restricted"
 *                       minAltitude: 0
 *                       maxAltitude: 1500
 *       400:
 *         description: Thiếu thông tin bắt buộc (lat, lng, altitude)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "lat, lng, and altitude are required"
 *       401:
 *         description: Không được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Spatial check failed"
 */

/**
 * @swagger
 * /api/zones/{id}:
 *   delete:
 *     summary: Xoá (archive) một zone
 *     description: |
 *       Thực hiện soft delete bằng cách chuyển status của zone thành 'archived'.
 *       Zone bị archived sẽ không hiển thị trong danh sách mặc định và không được tính khi check point.
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId của zone cần xoá
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Archive zone thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Zone archived successfully"
 *                 zone:
 *                   $ref: '#/components/schemas/ZoneResponse'
 *       401:
 *         description: Không được xác thực
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Không tìm thấy zone
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Zone not found"
 *       500:
 *         description: Lỗi server
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Failed to archive zone"
 */
