// middleware/auth.middleware.js
const jwt = require("jsonwebtoken");

/**
 * Xác thực JWT, gắn thông tin user vào req.user
 */
const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({ message: "Unauthorized" });
        }

        const token = authHeader.split(" ")[1];

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
            id: decoded.userId,
            role: decoded.role,
        };

        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid token" });
    }
};

/**
 * Phân quyền theo vai trò
 * Ví dụ dùng trong route:
 *   const { authenticate, authorizeRoles } = require("../middleware/auth.middleware");
 *   router.get("/admin", authenticate, authorizeRoles("UTM_ADMIN"), handler);
 */
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !allowedRoles.includes(req.user.role)) {
            return res
                .status(403)
                .json({ message: "Forbidden: insufficient permissions" });
        }
        next();
    };
};

// Giữ export mặc định là middleware xác thực để không phá vỡ code cũ
module.exports = authenticate;
module.exports.authenticate = authenticate;
module.exports.authorizeRoles = authorizeRoles;
