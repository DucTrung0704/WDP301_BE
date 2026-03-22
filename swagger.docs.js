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
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
 *               refreshToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
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
 *     summary: Đăng xuất khỏi hệ thống (xóa tất cả refresh tokens)
 *     description: Xóa tất cả refresh tokens của user khỏi cơ sở dữ liệu, vô hiệu hóa toàn bộ phiên
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Đăng xuất thành công, tất cả refresh tokens đã bị xóa
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logged out successfully"
 *       401:
 *         description: Chưa được xác thực (JWT token không hợp lệ hoặc hết hạn)
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
 *   - name: Users
 *     description: Quản lý tài khoản công khai và cá nhân (Admin CRUD & User Profile)
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
 * /api/users/me:
 *   get:
 *     summary: Lấy thông tin profile cá nhân (Bất kỳ user nào đã login)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *
 *   patch:
 *     summary: Cập nhật thông tin profile cá nhân
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fullName:
 *                 type: string
 *               avatar:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *
 *   delete:
 *     summary: Vô hiệu hóa tài khoản cá nhân (Xóa mềm - đổi status thành inactive)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Vô hiệu hóa thành công
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Not found
 *
 * /api/users:
 *   get:
 *     summary: Danh sách tất cả người dùng (chỉ UTM_ADMIN)
 *     tags: [Users]
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
 *       403:
 *         description: Forbidden
 *
 *   post:
 *     summary: Tạo mới người dùng (chỉ UTM_ADMIN)
 *     tags: [Users]
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
 *                 example: "newuser"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "newuser@example.com"
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
 *         description: Success
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       409:
 *         description: Conflict
 *
 * /api/users/{id}:
 *   get:
 *     summary: Xem chi tiết người dùng (chỉ UTM_ADMIN)
 *     tags: [Users]
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
 *       404:
 *         description: Not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 *   put:
 *     summary: Cập nhật người dùng bằng PUT (chỉ UTM_ADMIN)
 *     tags: [Users]
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
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Not found
 *
 *   patch:
 *     summary: Cập nhật người dùng bằng PATCH (chỉ UTM_ADMIN)
 *     tags: [Users]
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
 *     tags: [Users]
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
 *   - name: Flights
 *     description: Quản lý lịch sử bay của drone
 *   - name: Drones
 *     description: Quản lý drone của người dùng
 */

/**
 * @swagger
 * /api/drones:
 *   post:
 *     summary: Tạo mới drone (droneId được tự động tạo)
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
 *   get:
 *     summary: Lấy chi tiết một zone theo ID
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId của zone
 *         example: "507f1f77bcf86cd799439011"
 *     responses:
 *       200:
 *         description: Lấy chi tiết thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZoneResponse'
 *       400:
 *         description: ID không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Invalid zone ID format"
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
 *
 *   put:
 *     summary: Cập nhật thông tin một zone
 *     description: |
 *       Cập nhật zone với các field được cung cấp. Chỉ cần gửi các field muốn thay đổi.
 *       **Lưu ý:**
 *       - Không thể edit zone đã bị archived
 *       - Không thể đổi status thành 'archived' qua endpoint này (sử dụng DELETE để archive)
 *       - Nếu thay đổi geometry, validation polygon (closed, không tự cắt) sẽ được thực hiện
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *         description: MongoDB ObjectId của zone cần cập nhật
 *         example: "507f1f77bcf86cd799439011"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Tên mới của zone
 *                 example: "Updated Zone Name"
 *               description:
 *                 type: string
 *                 description: Mô tả mới
 *                 example: "Updated description"
 *               type:
 *                 type: string
 *                 enum: [no_fly, restricted]
 *                 description: Loại zone
 *                 example: "restricted"
 *               geometry:
 *                 $ref: '#/components/schemas/GeoJSONPolygon'
 *               minAltitude:
 *                 type: number
 *                 minimum: 0
 *                 description: Độ cao tối thiểu (meters)
 *                 example: 0
 *               maxAltitude:
 *                 type: number
 *                 minimum: 0
 *                 description: Độ cao tối đa (meters)
 *                 example: 5000
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *                 description: Thời gian bắt đầu hiệu lực
 *                 example: "2026-02-01T00:00:00Z"
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
 *                 description: Thời gian hết hiệu lực
 *                 example: "2027-02-01T00:00:00Z"
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 description: "Trạng thái zone (không thể set thành 'archived')"
 *                 example: "active"
 *           example:
 *             name: "Updated Airport Zone"
 *             description: "Updated no-fly zone description"
 *             maxAltitude: 5000
 *             status: "active"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ZoneResponse'
 *       400:
 *         description: Dữ liệu không hợp lệ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               invalidId:
 *                 value:
 *                   message: "Invalid zone ID format"
 *               archivedZone:
 *                 value:
 *                   message: "Cannot edit an archived zone"
 *               invalidPolygon:
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
 *               message: "Failed to update zone"
 *
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

/**
 * @swagger
 * /api/flights:
 *   post:
 *     summary: Tạo mới một bản ghi chuyến bay
 *     description: Ghi nhận một chuyến bay mới vào hệ thống. Yêu cầu drone phải thuộc sở hữu của người tạo.
 *     tags: [Flights]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlightRequest'
 *           example:
 *             droneId: "507f1f77bcf86cd799439011"
 *             startTime: "2026-01-20T08:00:00Z"
 *             endTime: "2026-01-20T09:00:00Z"
 *             origin: "Location A"
 *             destination: "Location B"
 *             status: "SCHEDULED"
 *             notes: "First test flight"
 *     responses:
 *       201:
 *         description: Flight created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Flight'
 *       400:
 *         description: Missing required fields (droneId, startTime)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "droneId and startTime are required"
 *       403:
 *         description: Unauthorized - User does not own the drone
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Unauthorized: You don't own this drone"
 *       404:
 *         description: Drone not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               message: "Drone not found"
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 *
 * /api/flights/me:
 *   get:
 *     summary: Lấy danh sách chuyến bay cá nhân
 *     description: Trả về toàn bộ lịch sử bay của operator hiện tại (được sắp xếp theo thời gian mới nhất).
 *     tags: [Flights]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of personal flights
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Flight'
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * tags:
 *   - name: Flight Plans
 *     description: Quản lý route template bay (không chứa lịch thời gian)
 *   - name: Missions
 *     description: Quản lý mission và lịch thực thi plan qua MissionPlan
 *   - name: Conflicts
 *     description: Quản lý các sự kiện xung đột giữa các kế hoạch bay (chỉ UTM_ADMIN)
 */

/**
 * @swagger
 * /api/flight-plans:
 *   post:
 *     summary: Tạo mới kế hoạch bay (DRAFT)
 *     description: |
 *       Tạo một flight plan dạng route template ở trạng thái DRAFT.
 *       Flight plan không còn chứa thời gian bay tổng thể.
 *       Lịch bay (plannedStart/plannedEnd) được quản lý ở MissionPlan.
 *       Hệ thống tự động tạo routeGeometry (GeoJSON LineString) từ waypoints.
 *       Validation chính:
 *       - waypoints từ 2 đến 500 điểm
 *       - sequenceNumber phải liên tục 1..N, không trùng
 *       - không cho phép segment quá dài
 *       - altitude waypoint không vượt maxAltitude của drone (nếu có)
 *     tags: [Flight Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateFlightPlanRequest'
 *           example:
 *             drone: "507f1f77bcf86cd799439011"
 *             priority: 1
 *             waypoints:
 *               - sequenceNumber: 1
 *                 latitude: 10.8231
 *                 longitude: 106.6297
 *                 altitude: 50
 *                 speed: 0
 *                 estimatedTime: "2026-01-20T08:00:00Z"
 *                 action: "TAKEOFF"
 *               - sequenceNumber: 2
 *                 latitude: 10.8300
 *                 longitude: 106.6400
 *                 altitude: 100
 *                 speed: 15
 *                 estimatedTime: "2026-01-20T08:30:00Z"
 *                 action: "WAYPOINT"
 *               - sequenceNumber: 3
 *                 latitude: 10.8350
 *                 longitude: 106.6450
 *                 altitude: 50
 *                 speed: 10
 *                 estimatedTime: "2026-01-20T09:00:00Z"
 *                 action: "LAND"
 *             notes: "Routine inspection flight plan"
 *     responses:
 *       201:
 *         description: Flight plan created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightPlanResponse'
 *       400:
 *         description: Validation error (waypoint/geometry/drone status)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - không sở hữu drone
 *       404:
 *         description: Drone not found
 *       500:
 *         description: Internal server error
 *
 *   get:
 *     summary: Danh sách kế hoạch bay của user hiện tại
 *     description: Lấy danh sách flight plans với pagination và filter theo status.
 *     tags: [Flight Plans]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, APPROVED, REJECTED, CANCELLED]
 *         description: Filter theo trạng thái flight plan
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FlightPlanResponse'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalCount:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/flight-plans/{id}:
 *   get:
 *     summary: Chi tiết kế hoạch bay
 *     tags: [Flight Plans]
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
 *               $ref: '#/components/schemas/FlightPlanResponse'
 *       400:
 *         description: Invalid flight plan ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Flight plan not found
 *
 *   put:
 *     summary: Cập nhật kế hoạch bay (chỉ DRAFT/REJECTED)
 *     description: |
 *       Cập nhật flight plan. Chỉ cho phép khi status là DRAFT hoặc REJECTED.
 *       Nếu plan đang REJECTED, sẽ tự động reset về DRAFT và dismiss các conflicts cũ.
 *       Mọi field route template được gửi lên đều được validate lại theo cùng rule như khi tạo mới.
 *     tags: [Flight Plans]
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
 *             $ref: '#/components/schemas/UpdateFlightPlanRequest'
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightPlanResponse'
 *       400:
 *         description: Cannot update (wrong status hoặc vi phạm rule validate)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - không sở hữu flight plan
 *       404:
 *         description: Flight plan not found
 *
 *   delete:
 *     summary: Xóa kế hoạch bay (chỉ DRAFT)
 *     tags: [Flight Plans]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Flight plan deleted successfully"
 *       400:
 *         description: Cannot delete (wrong status)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Flight plan not found
 */

/**
 * @swagger
 * /api/flight-plans/{id}/submit:
 *   post:
 *     summary: Submit kế hoạch bay (DRAFT -> APPROVED)
 *     description: |
 *       Submit flight plan route template sau khi validate lại dữ liệu route.
 *       Scheduling và kiểm tra chồng lấn theo thời gian được xử lý ở MissionPlan.
 *       Không chạy conflict/time checks ở bước submit plan.
 *     tags: [Flight Plans]
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
 *         description: Submit result (approved)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SubmitFlightPlanResponse'
 *             examples:
 *               approved:
 *                 summary: Flight plan approved
 *                 value:
 *                   message: "Flight plan approved — no conflicts detected"
 *                   approved: true
 *                   conflicts: []
 *               rejected:
 *                 summary: Flight plan rejected
 *                 value:
 *                   message: "Flight plan rejected — conflicts detected"
 *                   approved: false
 *       400:
 *         description: Cannot submit (wrong status hoặc vi phạm validate)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Flight plan not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/flight-plans/{id}/cancel:
 *   post:
 *     summary: Hủy kế hoạch bay (DRAFT/REJECTED → CANCELLED)
 *     tags: [Flight Plans]
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
 *         description: Cancelled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Flight plan cancelled"
 *                 flightPlan:
 *                   $ref: '#/components/schemas/FlightPlanResponse'
 *       400:
 *         description: Cannot cancel (wrong status)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Flight plan not found
 */

/**
 * @swagger
 * /api/flight-plans/{id}/conflicts:
 *   get:
 *     summary: Xem danh sách xung đột của kế hoạch bay
 *     tags: [Flight Plans]
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
 *         description: List of conflict events
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ConflictEventResponse'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Flight plan not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /api/missions:
 *   post:
 *     summary: Tạo mission mới (chỉ FLEET_OPERATOR)
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateMissionRequest'
 *     responses:
 *       201:
 *         description: Mission created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MissionResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *
 *   get:
 *     summary: Danh sách mission của user hiện tại
 *     tags: [Missions]
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
 *                 $ref: '#/components/schemas/MissionResponse'
 *
 * /api/missions/{id}:
 *   get:
 *     summary: Chi tiết mission + danh sách MissionPlan
 *     tags: [Missions]
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
 *               type: object
 *               properties:
 *                 mission:
 *                   $ref: '#/components/schemas/MissionResponse'
 *                 missionPlans:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/MissionPlanResponse'
 *       404:
 *         description: Mission not found
 *
 * /api/missions/{id}/start:
 *   post:
 *     summary: Bắt đầu mission và chạy check theo lịch MissionPlan
 *     description: |
 *       Khi start mission, hệ thống mới thực hiện các kiểm tra:
 *       - Xung đột quỹ đạo theo từng cặp giữa các kế hoạch bay trong mission
 *       - Xung đột phân đoạn
 *       - Vi phạm vùng bay theo plannedStart/plannedEnd của MissionPlan
 *
 *       Nếu có blocking issues, mission không được start và trả về details.
 *     tags: [Missions]
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
 *         description: Mission started
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mission started successfully"
 *                 mission:
 *                   $ref: '#/components/schemas/MissionResponse'
 *       400:
 *         description: Blocking conflicts/zone violations or invalid mission state
 *       404:
 *         description: Mission not found
 *
 *   put:
 *     summary: Cập nhật mission
 *     tags: [Missions]
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
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               status:
 *                 type: string
 *                 enum: [DRAFT, ACTIVE, ARCHIVED]
 *     responses:
 *       200:
 *         description: Updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MissionResponse'
 *
 *   delete:
 *     summary: Xóa mission (kèm toàn bộ MissionPlan liên quan)
 *     tags: [Missions]
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
 *         description: Mission deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Mission deleted successfully"
 *                 missionId:
 *                   type: string
 *       404:
 *         description: Mission not found
 *
 * /api/missions/{id}/plans:
 *   post:
 *     summary: Thêm flight plan vào mission với lịch thời gian
 *     description: Một flight plan có thể dùng lại ở nhiều mission.
 *     tags: [Missions]
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
 *             $ref: '#/components/schemas/CreateMissionPlanRequest'
 *     responses:
 *       201:
 *         description: Mission plan created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MissionPlanResponse'
 *       400:
 *         description: Validation error (time overlap, invalid time, duplicate plan in mission)
 *
 * /api/missions/{id}/plans/{missionPlanId}:
 *   put:
 *     summary: Cập nhật lịch của MissionPlan
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: missionPlanId
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
 *               plannedStart:
 *                 type: string
 *                 format: date-time
 *               plannedEnd:
 *                 type: string
 *                 format: date-time
 *               order:
 *                 type: integer
 *               status:
 *                 type: string
 *                 enum: [SCHEDULED, CANCELLED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Mission plan updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/MissionPlanResponse'
 *
 *   delete:
 *     summary: Xóa một MissionPlan khỏi mission
 *     tags: [Missions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: missionPlanId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Removed
 */

/**
 * @swagger
 * /api/conflicts:
 *   get:
 *     summary: Danh sách tất cả conflict events (chỉ UTM_ADMIN)
 *     tags: [Conflicts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, RESOLVED, DISMISSED]
 *         description: Filter theo trạng thái conflict
 *       - name: method
 *         in: query
 *         schema:
 *           type: string
 *           enum: [PAIRWISE, SEGMENTATION, ZONE_VIOLATION]
 *         description: Filter theo phương pháp phát hiện
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ConflictEventResponse'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - chỉ UTM_ADMIN
 *       500:
 *         description: Internal server error
 *
 * /api/conflicts/{id}:
 *   get:
 *     summary: Chi tiết conflict event (chỉ UTM_ADMIN)
 *     tags: [Conflicts]
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
 *               $ref: '#/components/schemas/ConflictEventResponse'
 *       400:
 *         description: Invalid conflict ID
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Conflict event not found
 *
 * /api/conflicts/{id}/resolve:
 *   put:
 *     summary: Resolve conflict event (chỉ UTM_ADMIN)
 *     description: Đánh dấu conflict là đã giải quyết, kèm ghi chú resolution.
 *     tags: [Conflicts]
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
 *             required: [resolution]
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Mô tả cách giải quyết xung đột
 *                 example: "Flight plan A đã được điều chỉnh waypoint để tránh xung đột"
 *     responses:
 *       200:
 *         description: Conflict resolved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Conflict resolved"
 *                 conflict:
 *                   $ref: '#/components/schemas/ConflictEventResponse'
 *       400:
 *         description: Conflict already resolved/dismissed, or missing resolution
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Conflict event not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * tags:
 *   - name: Flight Sessions
 *     description: Quản lý phiên bay thực tế (PLANNED hoặc FREE_FLIGHT)
 *   - name: Telemetry
 *     description: Dữ liệu bay realtime từ drone (REST fallback cho WebSocket)
 *   - name: Alerts
 *     description: Cảnh báo in-flight (conflict, zone violation, deviation, battery, connection)
 */

/**
 * @swagger
 * /api/flight-sessions/start:
 *   post:
 *     summary: Bắt đầu phiên bay theo kế hoạch (PLANNED)
 *     description: |
 *       Tạo FlightSession từ FlightPlan đã APPROVED.
 *       Drone phải ở trạng thái IDLE. Tự động chuyển drone → FLYING.
 *     tags: [Flight Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [flightPlanId]
 *             properties:
 *               flightPlanId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       201:
 *         description: Session started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightSessionResponse'
 *       400:
 *         description: Plan not APPROVED, drone not IDLE, or drone already has active session
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Flight plan or drone not found
 */

/**
 * @swagger
 * /api/flight-sessions/free-flight:
 *   post:
 *     summary: Bắt đầu bay tự do (FREE_FLIGHT — chỉ INDIVIDUAL_OPERATOR)
 *     description: |
 *       Tạo FlightSession không cần FlightPlan.
 *       Chỉ INDIVIDUAL_OPERATOR mới được sử dụng endpoint này.
 *       Drone phải thuộc sở hữu của operator và ở trạng thái IDLE.
 *     tags: [Flight Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [droneId]
 *             properties:
 *               droneId:
 *                 type: string
 *                 example: "507f1f77bcf86cd799439011"
 *     responses:
 *       201:
 *         description: Free flight session started
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/FlightSessionResponse'
 *       403:
 *         description: Chỉ INDIVIDUAL_OPERATOR hoặc không sở hữu drone
 *       400:
 *         description: Drone not IDLE or already has active session
 *       404:
 *         description: Drone not found
 */

/**
 * @swagger
 * /api/flight-sessions:
 *   get:
 *     summary: Danh sách phiên bay
 *     description: Operator xem session của mình, Admin xem tất cả.
 *     tags: [Flight Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [STARTING, IN_PROGRESS, COMPLETED, ABORTED, EMERGENCY_LANDED]
 *       - name: sessionType
 *         in: query
 *         schema:
 *           type: string
 *           enum: [PLANNED, FREE_FLIGHT]
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/FlightSessionResponse'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/flight-sessions/{id}:
 *   get:
 *     summary: Chi tiết phiên bay
 *     tags: [Flight Sessions]
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
 *               $ref: '#/components/schemas/FlightSessionResponse'
 *       400:
 *         description: Invalid session ID
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/flight-sessions/{id}/end:
 *   post:
 *     summary: Kết thúc phiên bay → COMPLETED
 *     description: |
 *       Đánh dấu session COMPLETED, drone → IDLE.
 *       Tự động build actualRoute từ dữ liệu telemetry.
 *     tags: [Flight Sessions]
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
 *         description: Session completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Flight session completed"
 *                 flightSession:
 *                   $ref: '#/components/schemas/FlightSessionResponse'
 *       400:
 *         description: Cannot end (wrong status)
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/flight-sessions/{id}/abort:
 *   post:
 *     summary: Hủy phiên bay → ABORTED
 *     tags: [Flight Sessions]
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
 *         description: Session aborted
 *       400:
 *         description: Cannot abort (wrong status)
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/flight-sessions/{id}/emergency:
 *   post:
 *     summary: Hạ cánh khẩn cấp → EMERGENCY_LANDED
 *     tags: [Flight Sessions]
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
 *         description: Emergency landing recorded
 *       400:
 *         description: Cannot emergency land (wrong status)
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/flight-sessions/{id}/telemetry:
 *   get:
 *     summary: Lấy dữ liệu telemetry của phiên bay
 *     tags: [Flight Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TelemetryResponse'
 *                 totalCount:
 *                   type: integer
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/flight-sessions/{id}/alerts:
 *   get:
 *     summary: Lấy danh sách cảnh báo của phiên bay
 *     tags: [Flight Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [CONFLICT, ZONE_VIOLATION, DEVIATION, BATTERY_LOW, CONNECTION_LOST]
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, ACKNOWLEDGED, RESOLVED]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 alerts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AlertResponse'
 *                 totalCount:
 *                   type: integer
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/telemetry:
 *   post:
 *     summary: Gửi telemetry qua REST (fallback khi WebSocket không khả dụng)
 *     description: |
 *       Lưu dữ liệu telemetry + trigger in-flight conflict detection.
 *       Ưu tiên dùng WebSocket (`ws://host/ws`) cho realtime.
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionId, lat, lng, altitude]
 *             properties:
 *               sessionId:
 *                 type: string
 *               lat:
 *                 type: number
 *                 example: 10.8231
 *               lng:
 *                 type: number
 *                 example: 106.6297
 *               altitude:
 *                 type: number
 *                 example: 100
 *               speed:
 *                 type: number
 *                 example: 15
 *               heading:
 *                 type: number
 *                 example: 180
 *               batteryLevel:
 *                 type: number
 *                 example: 85
 *     responses:
 *       201:
 *         description: Telemetry saved
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TelemetryResponse'
 *       400:
 *         description: Missing fields or session not IN_PROGRESS
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 *
 * /api/telemetry/{sessionId}:
 *   get:
 *     summary: Lấy lịch sử telemetry của phiên bay
 *     tags: [Telemetry]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: sessionId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 100
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TelemetryResponse'
 *                 totalCount:
 *                   type: integer
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Danh sách cảnh báo
 *     description: Operator xem alert của session mình, Admin xem tất cả.
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: flightSession
 *         in: query
 *         schema:
 *           type: string
 *         description: Filter theo session ID
 *       - name: type
 *         in: query
 *         schema:
 *           type: string
 *           enum: [CONFLICT, ZONE_VIOLATION, DEVIATION, BATTERY_LOW, CONNECTION_LOST]
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [ACTIVE, ACKNOWLEDGED, RESOLVED]
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           default: 1
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AlertResponse'
 *                 pagination:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *
 * /api/alerts/{id}:
 *   get:
 *     summary: Chi tiết cảnh báo
 *     tags: [Alerts]
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
 *               $ref: '#/components/schemas/AlertResponse'
 *       400:
 *         description: Invalid alert ID
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Alert not found
 *
 * /api/alerts/{id}/acknowledge:
 *   put:
 *     summary: Xác nhận cảnh báo (ACTIVE → ACKNOWLEDGED)
 *     tags: [Alerts]
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
 *         description: Alert acknowledged
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Alert acknowledged"
 *                 alert:
 *                   $ref: '#/components/schemas/AlertResponse'
 *       400:
 *         description: Alert already acknowledged/resolved
 *       404:
 *         description: Alert not found
 */

/**
 * @swagger
 * tags:
 *   - name: Sepay
 *     description: Tích hợp thanh toán Sepay
 */

/**
 * @swagger
 * /api/sepay/payment:
 *   post:
 *     summary: Khởi tạo URL thanh toán Sepay
 *     tags: [Sepay]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [order_description, order_amount, success_url, cancel_url, error_url]
 *             properties:
 *               order_description:
 *                 type: string
 *                 example: "Thanh toán đơn hàng DH... "
 *               order_amount:
 *                 type: number
 *                 example: 100000
 *               customer_id:
 *                 type: string
 *                 example: "user_123"
 *               success_url:
 *                 type: string
 *                 example: "https://yourdomain.com/success"
 *               cancel_url:
 *                 type: string
 *                 example: "https://yourdomain.com/cancel"
 *               error_url:
 *                 type: string
 *                 example: "https://yourdomain.com/error"
 *     responses:
 *       200:
 *         description: Khởi tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 paymentCheckoutUrl:
 *                   type: string
 *                   example: "https://sepay.vn/checkout/..."
 *                 paymentFormFiels:
 *                   type: object
 *                 machant_id:
 *                   type: string
 *                 machant_key:
 *                   type: string
 *       400:
 *         description: Không thể tạo mã qr thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 error:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Không thể tạo mã qr thanh toán"
 */

/**
 * @swagger
 * /api/sepay/webhook:
 *   post:
 *     summary: Khởi tạo URL thanh toán Sepay
 *     tags: [Sepay]
 *     responses:
 *       200:
 *         description: Khởi tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 code:
 *                   type: integer
 *                   example: 200
 *                 paymentCheckoutUrl:
 *                   type: string
 *                   example: "https://sepay.vn/checkout/..."
 *                 paymentFormFiels:
 *                   type: object
 *                 machant_id:
 *                   type: string
 *                 machant_key:
 *                   type: string
 *       400:
 *         description: Không thể tạo mã qr thanh toán
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: integer
 *                   example: 400
 *                 error:
 *                   type: object
 *                 message:
 *                   type: string
 *                   example: "Không thể tạo mã qr thanh toán"
 */

/**
 * @swagger
 * tags:
 *   - name: Packages
 *     description: Quản lý các gói thành viên
 * 
 * components:
 *   schemas:
 *     Package:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *         name:
 *           type: string
 *           example: "Gói Fleet Operator"
 *         description:
 *           type: string
 *           example: "Gói dành cho đối tác vận hành nhiều thiết bị"
 *         price:
 *           type: number
 *           example: 500000
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *           example: "ACTIVE"
 * 
 * /api/packages:
 *   get:
 *     summary: Lấy danh sách toàn bộ gói thành viên
 *     tags: [Packages]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE]
 *         description: Lọc theo trạng thái
 *     responses:
 *       200:
 *         description: Lấy danh sách thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Package'
 * 
 *   post:
 *     summary: Tạo gói thành viên mới (Chỉ Admin)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *             schema:
 *               $ref: '#/components/schemas/Package'
 *     responses:
 *       201:
 *         description: Tạo mới gói thành công
 * 
 * /api/packages/{id}:
 *   get:
 *     summary: Xem chi tiết một gói thành viên
 *     tags: [Packages]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lấy dữ liệu thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Package'
 * 
 *   put:
 *     summary: Cập nhật thông tin gói thành viên (Chỉ Admin)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *             schema:
 *               $ref: '#/components/schemas/Package'
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 * 
 *   delete:
 *     summary: Xóa gói thành viên (Chỉ Admin)
 *     tags: [Packages]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Xóa thành công
 */
