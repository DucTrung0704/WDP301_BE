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
 *                 _id: "696f32e9bd108ced66f635e0"
 *                 email: "userthul@gmail.com"
 *                 password: "$2b$10$2UEzp14XRYov8xQ5ky0hm.BfGkt2Yk2mP5UBXqPd4KDnke3FzSu30"
 *                 profile:
 *                   fullName: "userthul"
 *                 providers:
 *                   local: true
 *                 role: "FLEET_OPERATOR"
 *                 status: "active"
 *                 createdAt: "2026-01-20T07:46:49.5362"
 *                 updatedAt: "2026-01-20T07:46:49.5362"
 *                 __v: 0
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
