const User = require("../models/user.models");
const bcrypt = require("bcryptjs");

/* =========================================================
   ADMIN ENDPOINTS
   ========================================================= */

// Create a new user (Admin)
exports.createUser = async (req, res) => {
  try {
    const { email, password, fullName, role, status } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing email or password" });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "Email already exists" });
    }

    const allowedRoles = ["INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"];
    if (role && !allowedRoles.includes(role)) {
      return res.status(400).json({
        message: "Invalid role. Allowed: INDIVIDUAL_OPERATOR, FLEET_OPERATOR",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const profileData = fullName ? { fullName } : {};

    const user = await User.create({
      email,
      password: hashedPassword,
      providers: { local: true },
      profile: profileData,
      role: role || "INDIVIDUAL_OPERATOR",
      status: status || "active",
    });

    // Don't return password in response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json({
      data: { user: userResponse },
    });
  } catch (err) {
    console.error("createUser error:", err);
    res.status(500).json({ message: "Failed to create user" });
  }
};

// Get all users (Admin)
exports.getUsers = async (req, res) => {
  try {
    // Exclude passwords
    const users = await User.find().select("-password");
    res.json({
      data: users,
    });
  } catch (err) {
    console.error("getUsers error:", err);
    res.status(500).json({ message: "Failed to fetch users" });
  }
};

// Get user by id (Admin)
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      data: user,
    });
  } catch (err) {
    console.error("getUserById error:", err);
    res.status(500).json({ message: "Failed to fetch user" });
  }
};

// Update user by id (Admin)
exports.updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, fullName, role, status } = req.body;

    const user = await User.findById(id);
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
        return res.status(400).json({
          message: "Invalid status. Allowed: active, inactive, banned",
        });
      }
      user.status = status;
    }

    if (typeof role !== "undefined") {
      const allowedRoles = ["INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"];
      if (!allowedRoles.includes(role)) {
        return res.status(400).json({
          message: "Invalid role. Allowed: INDIVIDUAL_OPERATOR, FLEET_OPERATOR",
        });
      }
      user.role = role;
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;

    res.json({
      data: { user: userResponse },
    });
  } catch (err) {
    console.error("updateUserById error:", err);
    res.status(500).json({ message: "Failed to update user" });
  }
};

// Delete user by id (Admin - hard delete)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ message: "User deleted successfully" });
  } catch (err) {
    console.error("deleteUser error:", err);
    res.status(500).json({ message: "Failed to delete user" });
  }
};

/* =========================================================
   USER EXPLICIT ENDPOINTS (ME)
   ========================================================= */

// Get current user profile
exports.getMyProfile = async (req, res) => {
  try {
    // req.user is set by authenticate middleware
    const user = await User.findById(req.user.id).select(
      "-password -refreshTokens",
    );

    if (!user) {
      return res.status(404).json({ message: "User profile not found" });
    }

    res.json({
      data: user,
    });
  } catch (err) {
    console.error("getMyProfile error:", err);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// Update current user profile
exports.updateMyProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { fullName, avatar, phone, password } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User profile not found" });
    }

    user.profile = user.profile || {};

    if (typeof fullName !== "undefined") {
      user.profile.fullName = fullName;
    }

    if (typeof avatar !== "undefined") {
      user.profile.avatar = avatar;
    }

    if (typeof phone !== "undefined") {
      user.profile.phone = phone;
    }

    if (password) {
      user.password = await bcrypt.hash(password, 10);
      user.providers = user.providers || { local: false };
      user.providers.local = true;
    }

    await user.save();

    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshTokens;

    res.json({
      data: { user: userResponse },
    });
  } catch (err) {
    console.error("updateMyProfile error:", err);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// Delete current user account (Soft delete)
exports.deleteMyAccount = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Soft delete by setting status to inactive
    user.status = "inactive";

    // Optional: clear refresh tokens to force immediate logout across devices
    user.refreshTokens = [];

    await user.save();

    res.json({ message: "Account has been deactivated successfully" });
  } catch (err) {
    console.error("deleteMyAccount error:", err);
    res.status(500).json({ message: "Failed to deactivate account" });
  }
};
