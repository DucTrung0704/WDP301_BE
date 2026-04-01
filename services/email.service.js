const { Resend } = require("resend");

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * @param {Object} options
 * @param {string} options.to - Email người nhận
 * @param {string} options.fullName - Tên người dùng
 * @param {string} options.orderId - Mã đơn hàng
 * @param {number} options.amount - Số tiền đã thanh toán
 * @param {string} options.packageName - Tên gói đã mua
 * @param {Date}   options.expiresAt - Ngày hết hạn gói
 */
async function sendPaymentSuccessEmail({ to, fullName, orderId, amount, packageName, expiresAt }) {
    const formattedAmount = Number(amount).toLocaleString("vi-VN") + " VNĐ";
    // const formattedExpiry = expiresAt
    //     ? new Date(expiresAt).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    //     : "N/A";
    const displayName = fullName || to;

    const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "UTM System <noreply@resend.dev>",
        to: [to],
        subject: `✅ Thanh toán thành công – Đơn hàng ${orderId}`,
        html: `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a73e8, #0d47a1); color: #fff; padding: 32px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 8px 0 0; opacity: 0.85; font-size: 14px; }
    .body { padding: 32px 24px; color: #333; }
    .body p { line-height: 1.7; margin: 0 0 16px; }
    .info-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
    .info-table td { padding: 10px 14px; border-bottom: 1px solid #eee; font-size: 14px; }
    .info-table td:first-child { color: #666; width: 45%; }
    .info-table td:last-child { font-weight: 600; color: #1a73e8; }
    .badge { display: inline-block; background: #e8f5e9; color: #2e7d32; padding: 4px 12px; border-radius: 12px; font-size: 13px; font-weight: 600; }
    .footer { background: #f4f7fb; text-align: center; padding: 20px 24px; font-size: 12px; color: #999; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Thanh toán thành công!</h1>
      <p>Cảm ơn bạn đã tin tưởng và sử dụng dịch vụ UTM System</p>
    </div>
    <div class="body">
      <p>Xin chào <strong>${displayName}</strong>,</p>
      <p>Chúng tôi xác nhận đã nhận được thanh toán của bạn. Tài khoản của bạn đã được nâng cấp lên <span class="badge">Fleet Operator</span>.</p>

      <table class="info-table">
        <tr><td>Mã đơn hàng</td><td>${orderId}</td></tr>
        <tr><td>Gói dịch vụ</td><td>${packageName || "Fleet Operator"}</td></tr>
        <tr><td>Số tiền</td><td>${formattedAmount}</td></tr>
        <tr><td>Hiệu lực đến</td><td>Vĩnh Viễn</td></tr>
      </table>

      <p>Nếu bạn có bất kỳ thắc mắc nào, vui lòng liên hệ với chúng tôi qua email hỗ trợ.</p>
      <p>Trân trọng,<br/><strong>Đội ngũ UTM System</strong></p>
    </div>
    <div class="footer">© ${new Date().getFullYear()} UTM System. All rights reserved.</div>
  </div>
</body>
</html>
        `,
    });

    if (error) {
        console.error("❌ Lỗi gửi email Resend:", error);
        return false;
    }

    console.log("✅ Email thanh toán thành công đã gửi:", data?.id);
    return true;
}

module.exports = { sendPaymentSuccessEmail };
