require("dotenv").config();

const PaymentModel = require("../models/payment.model");
const UserModel = require("../models/user.models");

const BANK_ACCOUNT = "09479004233";
const BANK_NAME = "TPBank";
const TEMPLATE = "compact";


exports.SepayPayment = async (req, res) => {
    const {
        order_description, order_amount, customer_id, package_id
    } = req.body;


    if (!package_id) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin package_id (Gói thành viên)." });
    }

    if (!order_amount || !customer_id) {
        return res.status(400).json({ success: false, message: "Thiếu số tiền hoặc mã khách hàng" });
    }

    const user = await UserModel.findById(customer_id);
    if (user.role == "FLEET_OPERATOR") {
        return res.status(400).json({ success: false, message: "Bạn đã là fleet operator" });
    }


    try {
        const order_invoice_number = "DH" + Math.floor(Date.now() / 1000).toString();

        await PaymentModel.create({
            order_id: order_invoice_number,
            order_description: order_description || `Nạp tiền gói Fleet Operator - ${order_invoice_number}`,
            order_amount: Number(order_amount),
            package_id: package_id,
            customer_id: customer_id,
            status: "PENDING",
        });

        const qrUrl = `https://qr.sepay.vn/img?acc=${BANK_ACCOUNT}&bank=${BANK_NAME}&amount=${order_amount}&des=${order_invoice_number}&template=${TEMPLATE}`;

        return res.status(200).json({
            success: true,
            code: 200,
            paymentCheckoutUrl: qrUrl,
            order_invoice_number: order_invoice_number,
            message: "Tạo mã QR thành công, vui lòng thanh toán trong 15 phút"
        });

    } catch (e) {
        console.error("Lỗi khi tạo QR:", e);
        return res.status(500).json({
            success: false,
            code: 500,
            error: e.message,
            message: "Lỗi hệ thống khi tạo mã thanh toán"
        });
    }
}


exports.webhook = async (req, res) => {
    const authHeader = req.headers['authorization'];
    const mySecretKey = process.env.SEPAY_WEBHOOK_KEY;

    if (!authHeader || authHeader !== `Apikey ${mySecretKey}`) {
        console.warn("🚨 CẢNH BÁO: Phát hiện request giả mạo Webhook từ IP:", req.ip);
        return res.status(401).json({ success: false, code: 401, message: "Unauthorized" });
    }

    const payload = req.body;
    console.log("👌 Webhook payload hợp lệ:", payload);

    const content = payload.content || "";
    const match = content.match(/DH\d+/);
    const order_id = match ? match[0] : (payload.order_invoice_number || payload.order_id);

    if (order_id) {
        try {
            const pendingPayment = await PaymentModel.findOne({ order_id: order_id });

            if (pendingPayment) {
                const actualAmount = Number(payload.transferAmount || payload.order_amount || 0);
                if (actualAmount >= pendingPayment.order_amount) {
                    pendingPayment.status = "SUCCESS";
                    await pendingPayment.save();

                    const customer_id = pendingPayment.customer_id;
                    if (customer_id) {
                        const PackageModel = require("../models/package.model");
                        const userModelInst = await UserModel.findById(customer_id);
                        if (userModelInst) {
                            let additionalMonths = 1; // Mặc định 1 tháng
                            if (pendingPayment.package_id) {
                                const pkg = await PackageModel.findById(pendingPayment.package_id);
                                if (pkg) additionalMonths = pkg.duration_months;
                            }
                            
                            const baseDate = (userModelInst.premium_expires_at && userModelInst.premium_expires_at > new Date()) 
                                ? userModelInst.premium_expires_at 
                                : new Date();
                            baseDate.setMonth(baseDate.getMonth() + additionalMonths);
                            
                            await UserModel.findByIdAndUpdate(customer_id, { 
                                role: "FLEET_OPERATOR", 
                                premium_expires_at: baseDate 
                            });
                        }
                    }


                    return res.status(200).json({
                        success: true,
                        code: 200,
                        message: "Thanh toán thành công, đã update role!"
                    });

                } else {
                    pendingPayment.status = "PARTIAL_PAID";
                    await pendingPayment.save();
                    return res.status(200).json({
                        success: true,
                        code: 200,
                        message: `Khách chuyển thiếu tiền (${actualAmount}/${pendingPayment.order_amount}). Cần xử lý tay.`
                    });
                }

            } else {
                await PaymentModel.create({
                    order_id: String(order_id),
                    order_description: content,
                    order_amount: Number(payload.transferAmount || 0),
                    status: "SUCCESS_UNMATCHED"
                });
                return res.status(200).json({
                    success: true,
                    code: 200,
                    message: "Đã lưu payment, cần xử lý tay vì không khớp đơn gốc"
                });
            }
        } catch (error) {
            console.error("Lỗi khi xử lý DB trong webhook:", error);
            return res.status(500).json({
                success: false,
                code: 500,
                error: error.message,
                message: "Lỗi hệ thống database khi xử lý webhook"
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            code: 400,
            message: "Thiếu thông tin order_id. Bắt buộc từ payload."
        });
    }
}

exports.getPaymentHistory = async (req, res) => {
    try {
        const customer_id = req.user.id;
        const payments = await PaymentModel.find({ customer_id: customer_id }).sort({ createdAt: -1 });

        return res.status(200).json({
            success: true,
            code: 200,
            data: payments
        });
    } catch (error) {
        console.error("Lỗi khi lấy lịch sử thanh toán:", error);
        return res.status(500).json({
            success: false,
            code: 500,
            error: error.message,
            message: "Lỗi hệ thống khi lấy lịch sử thanh toán"
        });
    }
};