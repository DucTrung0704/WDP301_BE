const User = require("../models/user.models");
const bcrypt = require("bcryptjs");

/**
 * GET /api/admin/users
 * Lấy danh sách tất cả account người dùng
 */
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.json(users);
    } catch (err) {
        console.error("getAllUsers error:", err);
        res.status(500).json({ message: "Failed to fetch users" });
    }
};

/**
 * GET /api/admin/users/:id
 * Lấy thông tin chi tiết 1 account
 */
exports.getUserById = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json(user);
    } catch (err) {
        console.error("getUserById error:", err);
        res.status(500).json({ message: "Failed to fetch user" });
    }
};

/**
 * POST /api/admin/users
 * Admin tạo mới một account (bất kỳ role nào)
 */
exports.createUserByAdmin = async (req, res) => {
    try {
        const { email, password, fullName, role, status } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Missing email or password" });
        }

        const existing = await User.findOne({ email });
        if (existing) {
            return res.status(409).json({ message: "Email already exists" });
        }

        const allowedRoles = [
            "INDIVIDUAL_OPERATOR",
            "FLEET_OPERATOR",
        ];

        if (role && !allowedRoles.includes(role)) {
            return res.status(400).json({
                message:
                    "Invalid role. Allowed: INDIVIDUAL_OPERATOR, FLEET_OPERATOR",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Đảm bảo profile object luôn được tạo đúng cách (kể cả khi rỗng)
        const profileData = fullName ? { fullName } : {};

        const user = await User.create({
            email,
            password: hashedPassword,
            providers: { local: true },
            profile: profileData,
            role: role || "INDIVIDUAL_OPERATOR",
            status: status || "active",
        });

        res.status(201).json({
            data: {
                user,
            }
        });
    } catch (err) {
        console.error("createUserByAdmin error:", err);
        res.status(500).json({ message: "Failed to create user" });
    }
};

/**
 * PUT /api/admin/users/:id
 * Admin cập nhật thông tin account (role, status, profile, mật khẩu,...)
 */
exports.updateUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, password, fullName, role, status } = req.body;

        const user = await User.findById(id); // không trả password cho admin
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (email && email !== user.email) {
            const existEmail = await User.findOne({ email });
            if (existEmail) {
                return res.status(409).json({ message: "Email already exists" });
            }
            user.email = email;
        }

        if (password) {
            user.password = await bcrypt.hash(password, 10);
            user.providers.local = true;
        }

        if (typeof fullName !== "undefined") {
            user.profile = user.profile || {};
            user.profile.fullName = fullName;
        }

        if (typeof status !== "undefined") {
            const allowedStatus = ["active", "inactive", "banned"];
            if (!allowedStatus.includes(status)) {
                return res
                    .status(400)
                    .json({ message: "Invalid status. Allowed: active, inactive, banned" });
            }
            user.status = status;
        }

        if (typeof role !== "undefined") {
            const allowedRoles = [
                "INDIVIDUAL_OPERATOR",
                "FLEET_OPERATOR",
            ];
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({
                    message:
                        "Invalid role. Allowed: INDIVIDUAL_OPERATOR, FLEET_OPERATOR",
                });
            }
            user.role = role;
        }

        await user.save();

        res.json({
            data: {
                user,
            }
        });
    } catch (err) {
        console.error("updateUserByAdmin error:", err);
        res.status(500).json({ message: "Failed to update user" });
    }
};

/**
 * DELETE /api/admin/users/:id
 * Admin xoá hẳn account (hard delete)
 */
exports.deleteUserByAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const user = await User.findByIdAndDelete(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        res.json({ message: "User deleted successfully" });
    } catch (err) {
        console.error("deleteUserByAdmin error:", err);
        res.status(500).json({ message: "Failed to delete user" });
    }
};

