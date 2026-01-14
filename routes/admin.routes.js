const express = require("express");
const router = express.Router();

const {
    getAllUsers,
    getUserById,
    createUserByAdmin,
    updateUserByAdmin,
    deleteUserByAdmin,
} = require("../controllers/admin.controller");

const {
    authenticate,
    authorizeRoles,
} = require("../middleware/auth.middleware");

// Tất cả API dưới đây đều yêu cầu admin (UTM_ADMIN)

// Lấy danh sách user
router.get(
    "/users",
    authenticate,
    authorizeRoles("UTM_ADMIN"),
    getAllUsers
);

// Lấy chi tiết 1 user
router.get(
    "/users/:id",
    authenticate,
    authorizeRoles("UTM_ADMIN"),
    getUserById
);

// Tạo mới 1 user
router.post(
    "/users",
    authenticate,
    authorizeRoles("UTM_ADMIN"),
    createUserByAdmin
);

// Cập nhật 1 user
router.put(
    "/users/:id",
    authenticate,
    authorizeRoles("UTM_ADMIN"),
    updateUserByAdmin
);

// Xoá 1 user
router.delete(
    "/users/:id",
    authenticate,
    authorizeRoles("UTM_ADMIN"),
    deleteUserByAdmin
);

module.exports = router;

