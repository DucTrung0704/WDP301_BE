const PackageModel = require("../models/package.model");

// Tạo gói mới
exports.createPackage = async (req, res) => {
    try {
        const { name, description, price, duration_months, features, status } = req.body;
        
        const newPackage = await PackageModel.create({
            name,
            description,
            price,
            status
        });

        return res.status(201).json({
            success: true,
            data: newPackage,
            message: "Tạo gói thành viên thành công"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

exports.getAllPackages = async (req, res) => {
    try {
        const filters = {};
        if (req.query.status) {
            filters.status = req.query.status;
        }

        const packages = await PackageModel.find(filters).sort({ price: 1 });
        return res.status(200).json({
            success: true,
            data: packages
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

exports.getPackageById = async (req, res) => {
    try {
        const { id } = req.params;
        const pkg = await PackageModel.findById(id);

        if (!pkg) {
            return res.status(404).json({ success: false, message: "Không tìm thấy gói thành viên" });
        }

        return res.status(200).json({
            success: true,
            data: pkg
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

exports.updatePackage = async (req, res) => {
    try {
        const { id } = req.params;
        
        const updatedPackage = await PackageModel.findByIdAndUpdate(
            id,
            { $set: req.body },
            { new: true, runValidators: true }
        );

        if (!updatedPackage) {
            return res.status(404).json({ success: false, message: "Không tìm thấy gói thành viên" });
        }

        return res.status(200).json({
            success: true,
            data: updatedPackage,
            message: "Cập nhật gói thành viên thành công"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};

exports.deletePackage = async (req, res) => {
    try {
        const { id } = req.params;

        const PaymentModel = require("../models/payment.model");
        const existingPayment = await PaymentModel.findOne({ package_id: id });
        
        if (existingPayment) {
            return res.status(400).json({ 
                success: false, 
                message: "Không thể xóa gói này vì đã có người từng mua (có Payment tham chiếu)." 
            });
        }

        const deletedPackage = await PackageModel.findByIdAndDelete(id);

        if (!deletedPackage) {
            return res.status(404).json({ success: false, message: "Không tìm thấy gói thành viên" });
        }

        return res.status(200).json({
            success: true,
            message: "Xoá gói thành viên thành công"
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Lỗi server", error: error.message });
    }
};
