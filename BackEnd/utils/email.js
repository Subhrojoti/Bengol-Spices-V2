import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = "Bengol Spices <noreply@bengolspices.com>";

export const sendAdminNotification = async ({
  customAgentId,
  name,
  email,
  phone,
}) => {
  const { error } = await resend.emails.send({
    from: FROM,
    to: process.env.ADMIN_EMAIL,
    subject: "New Marketing Agent Application",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

          <div style="background: #1f2937; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0;">New Marketing Agent Applied</h2>
          </div>

          <div style="padding: 20px; color: #333;">
            <p style="font-size: 15px;">
              A new marketing agent has submitted an application. Below are the details:
            </p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Agent ID</td>
                <td style="padding: 8px;">${customAgentId}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 8px; font-weight: bold;">Name</td>
                <td style="padding: 8px;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 8px; font-weight: bold;">Email</td>
                <td style="padding: 8px;">${email}</td>
              </tr>
              <tr style="background: #f9fafb;">
                <td style="padding: 8px; font-weight: bold;">Phone</td>
                <td style="padding: 8px;">${phone}</td>
              </tr>
            </table>

            <div style="margin-top: 25px; text-align: center;">
              <a
                href="${process.env.ADMIN_PANEL_URL || "#"}"
                style="
                  background: #2563eb;
                  color: #ffffff;
                  padding: 12px 24px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: bold;
                  display: inline-block;
                "
              >
                Login to Admin Panel
              </a>
            </div>
          </div>

          <div style="background: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
            © ${new Date().getFullYear()} Bengol Spices Pvt Ltd
          </div>

        </div>
      </div>
    `,
  });

  if (error) {
    console.error("sendAdminNotification error:", error);
    throw new Error(error.message || "Failed to send admin notification");
  }
};

export const sendAgentApprovalMail = async ({ email, agentId, token }) => {
  const link = `${process.env.FRONTEND_URL}/agent-set-password?token=${token}`;

  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Agent Account is Approved",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

          <div style="background: #1f2937; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0;">Congratulations! Account Approved</h2>
          </div>

          <div style="padding: 20px; color: #333;">
            <p style="font-size: 15px;">Your documents are verified successfully.</p>

            <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
              <tr>
                <td style="padding: 8px; font-weight: bold;">Agent ID</td>
                <td style="padding: 8px;">${agentId}</td>
              </tr>
            </table>

            <p style="margin-top: 20px;">Set your password using the button below. <strong>This link expires in 15 minutes.</strong></p>

            <div style="margin-top: 25px; text-align: center;">
              <a
                href="${link}"
                style="
                  background: #16a34a;
                  color: #ffffff;
                  padding: 12px 24px;
                  text-decoration: none;
                  border-radius: 6px;
                  font-weight: bold;
                  display: inline-block;
                "
              >
                Set My Password
              </a>
            </div>

            <p style="font-size: 12px; color: #6b7280; margin-top: 16px;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${link}">${link}</a>
            </p>
          </div>

          <div style="background: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
            © ${new Date().getFullYear()} Bengol Spices Pvt Ltd
          </div>

        </div>
      </div>
    `,
  });

  if (error) {
    console.error("sendAgentApprovalMail error:", error);
    throw new Error(error.message || "Failed to send approval email");
  }
};

// SEND REJECTION EMAIL TO AGENT
export const sendAgentRejectionMail = async ({ email, agentId }) => {
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Marketing Agent Application Status",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

          <div style="background: #1f2937; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0;">Application Status Update</h2>
          </div>

          <div style="padding: 20px; color: #333;">
            <p style="font-size: 15px;">Hello,</p>
            <p>
              We regret to inform you that your marketing agent application has been
              rejected after verification.
            </p>
            <p>If you believe this is a mistake, you may contact our support team.</p>
            <p>Thank you for your interest.</p>
            <br/>
            <p>Regards,<br/><strong>Bengol Spices Team</strong></p>
          </div>

          <div style="background: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
            © ${new Date().getFullYear()} Bengol Spices Pvt Ltd
          </div>

        </div>
      </div>
    `,
  });

  if (error) {
    console.error("sendAgentRejectionMail error:", error);
    throw new Error(error.message || "Failed to send rejection email");
  }
};

export const sendEmployeeWelcomeMail = async ({ name, email, employeeId }) => {
  try {
    const { error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: "Bengol Spices – Employee Access Details",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2>Welcome to Bengol Spices</h2>

          <p>Hello <strong>${name}</strong>,</p>

          <p>
            You have been successfully added as an <strong>Employee</strong> at
            <strong>Bengol Spices</strong>.
          </p>

          <p><strong>Your Employee ID:</strong></p>
          <h3 style="color: #2c3e50;">${employeeId}</h3>

          <p>
            This <strong>Employee ID</strong> will be used to log in to the system.
          </p>

          <p style="color: #c0392b;">
            <strong>Password Information:</strong><br/>
            Your password is currently managed by the <strong>Admin</strong>.
            Please contact the admin directly to obtain your login password.
          </p>

          <p>
            For security reasons, do not share your login credentials with anyone.
          </p>

          <br/>
          <p>Regards,</p>
          <p><strong>Bengol Spices Team</strong></p>
        </div>
      `,
    });

    if (error) {
      console.error("sendEmployeeWelcomeMail error:", error);
      // Email failure does NOT block employee creation — matches original behaviour
    } else {
      console.log("Employee welcome email sent to:", email);
    }
  } catch (error) {
    console.error("SEND EMPLOYEE EMAIL ERROR:", error);
    // Email failure does NOT block employee creation — matches original behaviour
  }
};

// DELIVERY PARTNER ✅ APPROVAL EMAIL
export const sendDeliveryPartnerApprovalMail = async ({ name, email }) => {
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Delivery Partner Account is Approved 🎉",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

          <div style="background: #16a34a; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0;">Account Approved</h2>
          </div>

          <div style="padding: 20px; color: #333;">
            <p>Hello ${name},</p>

            <p>
              Great news! Your delivery partner account has been <strong>approved</strong>.
            </p>

            <p>
              You can now login using your registered phone number and password.
            </p>

            <br/>

            <p>Welcome aboard 🚀</p>

            <p>Regards,<br/><strong>Bengol Spices Team</strong></p>
          </div>

          <div style="background: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
            © ${new Date().getFullYear()} Bengol Spices Pvt Ltd
          </div>

        </div>
      </div>
    `,
  });

  if (error) {
    console.error("sendDeliveryPartnerApprovalMail error:", error);
    throw new Error(error.message || "Failed to send approval email");
  }
};

// DELIVERY PARTNER ❌ REJECTION EMAIL
export const sendDeliveryPartnerRejectionMail = async ({ name, email }) => {
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "Your Delivery Partner Application Status",
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #f4f6f8; padding: 20px;">
        <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">

          <div style="background: #dc2626; color: #ffffff; padding: 16px 20px;">
            <h2 style="margin: 0;">Application Rejected</h2>
          </div>

          <div style="padding: 20px; color: #333;">
            <p>Hello ${name},</p>

            <p>
              We regret to inform you that your delivery partner application has been 
              <strong>rejected</strong> after review.
            </p>

            <p>
              This could be due to incomplete or invalid information provided during registration.
            </p>

            <p>
              You may reapply again with correct details or contact our support team for assistance.
            </p>

            <br/>

            <p>Thank you for your interest.</p>

            <p>Regards,<br/><strong>Bengol Spices Team</strong></p>
          </div>

          <div style="background: #f3f4f6; padding: 12px; text-align: center; font-size: 12px; color: #6b7280;">
            © ${new Date().getFullYear()} Bengol Spices Pvt Ltd
          </div>

        </div>
      </div>
    `,
  });

  if (error) {
    console.error("sendDeliveryPartnerRejectionMail error:", error);
    throw new Error(error.message || "Failed to send rejection email");
  }
};
