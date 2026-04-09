const User = require("../models/user.models");
const bcrypt = require("bcryptjs");
const Drone = require("../models/drone.model");
const Payment = require("../models/payment.model");

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

            const isUpgradeToFleet =
                user.role === "INDIVIDUAL_OPERATOR" && role === "FLEET_OPERATOR";
            user.role = role;

            if (isUpgradeToFleet) {
                await Drone.updateMany(
                    { owner: user._id, ownerType: "INDIVIDUAL" },
                    { $set: { ownerType: "FLEET" } },
                );
            }
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
        const user = await User.findById(id);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const droneDeleteResult = await Drone.deleteMany({ owner: user._id });
        await User.findByIdAndDelete(id);

        res.json({
            message: "User deleted successfully",
            deletedDrones: droneDeleteResult.deletedCount || 0,
        });
    } catch (err) {
        console.error("deleteUserByAdmin error:", err);
        res.status(500).json({ message: "Failed to delete user" });
    }
};

/**
 * GET /api/admin/analytics/drones
 * Admin xem tổng số drone trong toàn hệ thống
 */
exports.getDroneSystemStats = async (req, res) => {
    try {
        const [totalDrones, byOwnerType, drones] = await Promise.all([
            Drone.countDocuments(),
            Drone.aggregate([
                {
                    $group: {
                        _id: "$ownerType",
                        count: { $sum: 1 },
                    },
                },
            ]),
            Drone.find()
                .select("droneId serialNumber model owner ownerType status createdAt")
                .populate("owner", "email profile.fullName role")
                .sort({ createdAt: -1 })
                .lean(),
        ]);

        const ownerTypeStats = {
            INDIVIDUAL: 0,
            FLEET: 0,
        };

        byOwnerType.forEach((item) => {
            if (item && item._id && ownerTypeStats[item._id] !== undefined) {
                ownerTypeStats[item._id] = item.count;
            }
        });

        const droneList = drones.map((drone) => ({
            _id: drone._id,
            droneId: drone.droneId,
            serialNumber: drone.serialNumber,
            model: drone.model,
            name: drone.model || drone.droneId || drone.serialNumber,
            ownerType: drone.ownerType,
            status: drone.status,
            createdAt: drone.createdAt,
            owner: drone.owner
                ? {
                    _id: drone.owner._id,
                    fullName: drone.owner.profile?.fullName || null,
                    email: drone.owner.email,
                    role: drone.owner.role,
                }
                : null,
        }));

        return res.status(200).json({
            success: true,
            data: {
                totalDrones,
                byOwnerType: ownerTypeStats,
                drones: droneList,
            },
        });
    } catch (err) {
        console.error("getDroneSystemStats error:", err);
        return res.status(500).json({ message: "Failed to fetch drone analytics" });
    }
};

/**
 * GET /api/admin/analytics/fleet-operators
 * Admin xem user đã thanh toán thành công để lên Fleet Operator và tổng tiền đã chi
 */
exports.getPaidFleetOperators = async (req, res) => {
    try {
        const paidFleetOperators = await Payment.aggregate([
            {
                $match: {
                    status: "SUCCESS",
                    customer_id: { $type: "string", $ne: "" },
                },
            },
            {
                $addFields: {
                    customerObjectId: {
                        $convert: {
                            input: "$customer_id",
                            to: "objectId",
                            onError: null,
                            onNull: null,
                        },
                    },
                },
            },
            {
                $match: {
                    customerObjectId: { $ne: null },
                },
            },
            {
                $lookup: {
                    from: "users",
                    localField: "customerObjectId",
                    foreignField: "_id",
                    as: "user",
                },
            },
            {
                $unwind: "$user",
            },
            {
                $match: {
                    "user.role": "FLEET_OPERATOR",
                },
            },
            {
                $group: {
                    _id: "$user._id",
                    email: { $first: "$user.email" },
                    fullName: { $first: "$user.profile.fullName" },
                    role: { $first: "$user.role" },
                    totalSpent: { $sum: "$order_amount" },
                    successfulPaymentCount: { $sum: 1 },
                    firstPaymentAt: { $min: "$createdAt" },
                    lastPaymentAt: { $max: "$createdAt" },
                },
            },
            {
                $sort: {
                    totalSpent: -1,
                },
            },
        ]);

        return res.status(200).json({
            success: true,
            data: {
                totalPaidFleetOperators: paidFleetOperators.length,
                operators: paidFleetOperators,
            },
        });
    } catch (err) {
        console.error("getPaidFleetOperators error:", err);
        return res.status(500).json({ message: "Failed to fetch paid fleet operators" });
    }
};

/**
 * GET /api/admin/analytics/revenue
 * Admin xem doanh thu theo tháng, quý, năm
 */
exports.getRevenueAnalytics = async (req, res) => {
    try {
        const successMatch = {
            $match: { status: "SUCCESS" },
        };

        const [monthly, quarterly, yearly] = await Promise.all([
            Payment.aggregate([
                successMatch,
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            month: { $month: "$createdAt" },
                        },
                        totalRevenue: { $sum: "$order_amount" },
                        transactionCount: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        "_id.year": -1,
                        "_id.month": -1,
                    },
                },
            ]),
            Payment.aggregate([
                successMatch,
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                            quarter: {
                                $ceil: {
                                    $divide: [{ $month: "$createdAt" }, 3],
                                },
                            },
                        },
                        totalRevenue: { $sum: "$order_amount" },
                        transactionCount: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        "_id.year": -1,
                        "_id.quarter": -1,
                    },
                },
            ]),
            Payment.aggregate([
                successMatch,
                {
                    $group: {
                        _id: {
                            year: { $year: "$createdAt" },
                        },
                        totalRevenue: { $sum: "$order_amount" },
                        transactionCount: { $sum: 1 },
                    },
                },
                {
                    $sort: {
                        "_id.year": -1,
                    },
                },
            ]),
        ]);

        return res.status(200).json({
            success: true,
            data: {
                monthly,
                quarterly,
                yearly,
            },
        });
    } catch (err) {
        console.error("getRevenueAnalytics error:", err);
        return res.status(500).json({ message: "Failed to fetch revenue analytics" });
    }
};

