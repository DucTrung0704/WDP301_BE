const nodemailer = require("nodemailer");
const { Resend } = require("resend");

const EMAIL_PROVIDER = (process.env.EMAIL_PROVIDER || "auto").trim().toLowerCase();

function getResendClient() {
  const apiKey = (process.env.RESEND_API_KEY || "").trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
}

function getSmtpTransport() {
  const host = (process.env.SMTP_HOST || "").trim();
  const port = Number(process.env.SMTP_PORT || 587);
  const user = (process.env.SMTP_USER || "").trim();
  const pass = (process.env.SMTP_PASS || "").trim();

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

function getFromEmail() {
  const smtpFrom = (process.env.SMTP_FROM_EMAIL || "").trim();
  if (smtpFrom) return smtpFrom;

  const resendFrom = (process.env.RESEND_FROM_EMAIL || "").trim();
  if (resendFrom) return resendFrom;

  return "UTM System <onboarding@resend.dev>";
}

async function sendBySmtp({ to, subject, html }) {
  try {
    const transport = getSmtpTransport();
    if (!transport) {
      return false;
    }

    await transport.sendMail({
      from: getFromEmail(),
      to,
      subject,
      html,
    });

    return true;
  } catch (error) {
    console.error("SMTP send error:", error);
    return false;
  }
}

async function sendByResend({ to, subject, html }) {
  try {
    const resend = getResendClient();
    if (!resend) {
      return false;
    }

    const { data, error } = await resend.emails.send({
      from: getFromEmail(),
      to: [to],
      subject,
      html,
    });

    if (error) {
      console.error("Resend send error:", error);
      return false;
    }

    console.log("Resend email sent:", data?.id);
    return true;
  } catch (error) {
    console.error("Resend send error:", error);
    return false;
  }
}

async function sendByConsole({ to, subject, html }) {
  const otpMatch = typeof html === "string" ? html.match(/\b\d{6}\b/) : null;
  const otp = otpMatch ? otpMatch[0] : "N/A";
  console.log("[EMAIL_CONSOLE_PROVIDER] to=%s subject=%s otp=%s", to, subject, otp);
  return true;
}

async function sendEmail({ to, subject, html }) {
  if (EMAIL_PROVIDER === "smtp") {
    return sendBySmtp({ to, subject, html });
  }

  if (EMAIL_PROVIDER === "resend") {
    return sendByResend({ to, subject, html });
  }

  if (EMAIL_PROVIDER === "console") {
    return sendByConsole({ to, subject, html });
  }

  // auto mode: smtp -> resend -> console(dev only)
  if (await sendBySmtp({ to, subject, html })) return true;
  if (await sendByResend({ to, subject, html })) return true;

  if ((process.env.NODE_ENV || "development") !== "production") {
    return sendByConsole({ to, subject, html });
  }

  return false;
}

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

  const sent = await sendEmail({
    to,
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

  if (!sent) {
    console.error("Failed to send payment success email");
    return false;
  }

  console.log("Payment success email sent");
  return true;
}

async function sendGoogleVerificationCodeEmail({ to, fullName, code }) {
  const displayName = fullName || to;

  const sent = await sendEmail({
    to,
    subject: "Ma xac nhan dang ky Google - UTM System",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1a73e8, #0d47a1); color: #fff; padding: 24px; }
    .body { padding: 24px; color: #333; }
    .otp { font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #1a73e8; margin: 16px 0; }
    .note { font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>Xac minh email Google</h2></div>
    <div class="body">
      <p>Xin chao <strong>${displayName}</strong>,</p>
      <p>Ma xac minh cua ban la:</p>
      <div class="otp">${code}</div>
      <p>Ma co hieu luc trong 10 phut.</p>
      <p class="note">Neu ban khong thuc hien yeu cau nay, vui long bo qua email.</p>
    </div>
  </div>
</body>
</html>
        `,
  });

  if (!sent) {
    console.error("Failed to send Google verification email");
    return false;
  }

  console.log("Google verification email sent");
  return true;
}

async function sendRegisterVerificationCodeEmail({ to, fullName, code }) {
  const displayName = fullName || to;

  const sent = await sendEmail({
    to,
    subject: "Ma xac minh dang ky tai khoan - UTM System",
    html: `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <style>
    body { font-family: Arial, sans-serif; background: #f4f7fb; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #0f766e, #134e4a); color: #fff; padding: 24px; }
    .body { padding: 24px; color: #333; }
    .otp { font-size: 28px; letter-spacing: 6px; font-weight: 700; color: #0f766e; margin: 16px 0; }
    .note { font-size: 13px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header"><h2>Xac minh email dang ky</h2></div>
    <div class="body">
      <p>Xin chao <strong>${displayName}</strong>,</p>
      <p>Ma xac minh dang ky tai khoan cua ban la:</p>
      <div class="otp">${code}</div>
      <p>Ma co hieu luc trong 10 phut.</p>
      <p class="note">Neu ban khong tao tai khoan, vui long bo qua email nay.</p>
    </div>
  </div>
</body>
</html>
        `,
  });

  if (!sent) {
    console.error("Failed to send register verification email");
    return false;
  }

  console.log("Register verification email sent");
  return true;
}

module.exports = {
  sendPaymentSuccessEmail,
  sendGoogleVerificationCodeEmail,
  sendRegisterVerificationCodeEmail,
};
