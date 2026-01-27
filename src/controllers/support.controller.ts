import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import { submitSupportRequest } from "../services/support.service.js";
import type { SubmitSupportRequestInput } from "../validators/support.validator.js";
import { getUserById } from "../services/user.service.js";

/**
 * Controller to handle support request submission
 */
export const submitSupportRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const data = req.body as SubmitSupportRequestInput;
    const userId = res.userId;

    // Process attachments if any
    const attachments: Array<{
      filename: string;
      content: Buffer;
      contentType: string;
    }> = [];

    if (req.files && Array.isArray(req.files)) {
      for (const file of req.files) {
        attachments.push({
          filename: file.originalname,
          content: file.buffer,
          contentType: file.mimetype,
        });
      }
    }

    // If user is authenticated, get their information
    let userName: string | undefined = data.userName;
    let userEmail: string | undefined = data.userEmail;

    if (userId) {
      const user = await getUserById(userId);
      if (user) {
        userName = userName || user.name || undefined;
        userEmail = userEmail || user.email || undefined;
      }
    }

    // Submit the support request
    await submitSupportRequest(
      {
        ...data,
        userName,
        userEmail,
      },
      attachments.length > 0 ? attachments : undefined,
      userId
    );

    res.status(200).json({
      message: "Support request submitted successfully",
    });
  } catch (error) {
    next(error);
  }
};
