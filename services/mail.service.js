// =====================================================================
// Mail service — wraps the Nodemailer transporter with app-specific
// email templates so controllers never touch raw HTML.
// =====================================================================
import transporter from "../config/mail.js";

function otpEmailHtml(otp) {
  return `
  <div style="font-family:'Segoe UI',Arial,sans-serif;background:#FBF6EC;padding:32px;">
    <div style="max-width:420px;margin:0 auto;background:#ffffff;border-radius:14px;
                overflow:hidden;border:1px solid #D9D0BC;">
      <div style="background:#2B2420;padding:22px 28px;">
        <span style="color:#FBF6EC;font-size:20px;font-weight:700;">MessMate</span>
      </div>
      <div style="padding:28px;">
        <p style="color:#2B2420;font-size:15px;margin:0 0 6px;">Your verification code</p>
        <p style="color:#8C8577;font-size:13px;margin:0 0 20px;">
          Use this code to verify your email. It expires in 10 minutes.
        </p>
        <div style="background:#F3ECDC;border:1.5px solid #D9D0BC;border-radius:9px;
                    padding:16px;text-align:center;margin-bottom:20px;">
          <span style="font-family:'Courier New',monospace;font-size:30px;
                       letter-spacing:0.35em;color:#B8800A;font-weight:700;">${otp}</span>
        </div>
        <p style="color:#8C8577;font-size:12.5px;margin:0;">
          Didn't request this? You can safely ignore this email — no account
          changes will be made without this code.
        </p>
      </div>
    </div>
  </div>`;
}

export async function sendOtpEmail(email, otp) {
  await transporter.sendMail({
    from: `"MessMate" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your MessMate verification code",
    text: `Your MessMate verification code is ${otp}. It expires in 10 minutes.`,
    html: otpEmailHtml(otp),
  });
}
