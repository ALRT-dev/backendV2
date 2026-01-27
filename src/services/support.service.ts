import type { SubmitSupportRequestInput } from "../validators/support.validator.js";
import { sendEmail } from "../utils/email.util.js";
import { config } from "../utils/config.js";

/**
 * Submit a support request by sending an email to support team
 */
export const submitSupportRequest = async (
  data: SubmitSupportRequestInput,
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType: string;
  }>,
  userId?: string
): Promise<void> => {
  // Build the email body
  const emailBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">New Support Request</h2>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 5px; margin: 20px 0;">
        <p style="margin: 10px 0;"><strong>Type of Request:</strong> ${data.requestType.toUpperCase()}</p>
        ${
          data.userName
            ? `<p style="margin: 10px 0;"><strong>Name:</strong> ${data.userName}</p>`
            : ""
        }
        ${
          data.userEmail
            ? `<p style="margin: 10px 0;"><strong>Email:</strong> ${data.userEmail}</p>`
            : ""
        }
        ${
          userId
            ? `<p style="margin: 10px 0;"><strong>User ID:</strong> ${userId}</p>`
            : ""
        }
      </div>
      
      <div style="margin: 20px 0;">
        <h3 style="color: #333;">Details:</h3>
        <p style="line-height: 1.6; white-space: pre-wrap;">${escapeHtml(
          data.details
        )}</p>
      </div>
      
      ${
        attachments && attachments.length > 0
          ? `<p style="margin: 20px 0;"><strong>Attachments:</strong> ${attachments.length} file(s) attached</p>`
          : ""
      }
      
      <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;" />
      
      <p style="color: #666; font-size: 12px;">
        This email was sent from the Safety ALRT support system.
        <br />
        Date: ${new Date().toLocaleString()}
      </p>
    </div>
  `;

  // Send email to support with CC to other team members
  await sendEmail({
    to: config.email.supportAddress,
    cc: config.email.supportCcAddresses,
    subject: `[${data.requestType.toUpperCase()}] New Support Request`,
    html: emailBody,
    ...(attachments && attachments.length > 0 ? { attachments } : {}),
  });
};

/**
 * Helper function to escape HTML in user input
 */
const escapeHtml = (text: string): string => {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] || m);
};
