import axios from "axios";
import FormData from "form-data";
import fs from "fs";
import { config } from "../utils/config.js";
import type {
  ImageModerationResult,
  VideoModerationResult,
} from "../models/media_moderation_interfaces.js";

/**
 * Check multiple media files (images/videos) for problems
 * @param files - Array of uploaded media files
 * @returns Object indicating if any media is rejected and the reasons
 */
export const checkMediasForProblems = async (
  files: Express.Multer.File[]
): Promise<{ isRejected: boolean; reasons: string[] }> => {
  const reasons: string[] = [];
  const THRESHOLD = 0.5; // Probability threshold for flagging content

  try {
    for (const file of files) {
      const isVideo = file.mimetype.startsWith("video/");
      const isImage = file.mimetype.startsWith("image/");

      if (isVideo) {
        const result = await moderateVideoFromMulterFile(file);

        if (result.summary.action === "reject") {
          const videoReasons = result.summary.reject_reason.map(
            (r) => `${r.text} detected in one or more videos.`
          );
          reasons.push(...videoReasons);
        }
      } else if (isImage) {
        const result = await moderateImageFromMulterFile(file);

        // Check nudity
        if (result.nudity.sexual_activity > THRESHOLD) {
          reasons.push("Sexual activity detected in one or more images.");
        }
        if (result.nudity.sexual_display > THRESHOLD) {
          reasons.push("Sexual display detected in one or more images.");
        }
        if (result.nudity.erotica > THRESHOLD) {
          reasons.push("Erotica content detected in one or more images.");
        }

        // Check offensive content
        if (result.offensive.nazi > THRESHOLD) {
          reasons.push("Nazi symbols detected in one or more images.");
        }
        if (result.offensive.confederate > THRESHOLD) {
          reasons.push("Confederate symbols detected in one or more images.");
        }
        if (result.offensive.supremacist > THRESHOLD) {
          reasons.push("Supremacist content detected in one or more images.");
        }
        if (result.offensive.terrorist > THRESHOLD) {
          reasons.push("Terrorist content detected in one or more images.");
        }
        if (result.offensive.middle_finger > THRESHOLD) {
          reasons.push("Offensive gestures detected in one or more images.");
        }

        // Check self-harm
        if (result["self-harm"].prob > THRESHOLD) {
          reasons.push("Self-harm content detected in one or more images.");
        }

        // Check for faces
        if (result.faces.length > 0) {
          reasons.push("Faces detected in one or more images.");
        }

        // Check for minors
        const hasMinor = result.faces.some(
          (face) => face.attributes.age.minor > THRESHOLD
        );
        if (hasMinor) {
          reasons.push("Minor detected in one or more images.");
        }

        // Check text content
        if (result.text.profanity.length > 0) {
          reasons.push("Profanity in text detected in one or more images.");
        }
        if (result.text.personal.length > 0) {
          reasons.push(
            "Personal information detected (names, license plates, etc.) in one or more images."
          );
        }
        if (result.text.extremism.length > 0) {
          reasons.push("Extremism in text detected in one or more images.");
        }
        if (result.text.violence.length > 0) {
          reasons.push("Violence in text detected in one or more images.");
        }
        if (result.text["self-harm"].length > 0) {
          reasons.push("Self-harm in text detected in one or more images.");
        }

        // Check QR codes for personal information
        if (result.qr.personal.length > 0) {
          reasons.push(
            "QR code with personal information detected in one or more images."
          );
        }
      }
    }

    const result = {
      isRejected: reasons.length > 0,
      reasons: [...new Set(reasons)], // Remove duplicates
    };

    if (files.length > 0) {
      console.log("Media moderation final result:", result);
    }

    return result;
  } catch (error: any) {
    console.error("Media moderation error:", error);
    return {
      isRejected: false,
      reasons: [],
    };
  }
};

/**
 * Check image from URL
 * @param imageUrl - URL of the image to check
 * @returns Image detection results
 */
const moderateImageFromUrl = async (
  imageUrl: string
): Promise<ImageModerationResult> => {
  try {
    const models =
      "nudity-2.1,type,offensive-2.0,faces,people-counting,text-content,face-age,text,qr-content,genai,self-harm";

    const response = await axios.get(
      "https://api.sightengine.com/1.0/check.json",
      {
        params: {
          url: imageUrl,
          models,
          api_user: config.sightengineApi.apiUser,
          api_secret: config.sightengineApi.apiSecret,
        },
      }
    );

    return response.data as ImageModerationResult;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Image detection failed: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Image detection request failed: ${error.message}`);
  }
};

/**
 * Check image from Multer file upload
 * @param file - Multer file object
 * @returns Image detection results
 */
const moderateImageFromMulterFile = async (
  file: Express.Multer.File
): Promise<ImageModerationResult> => {
  try {
    const formData = new FormData();

    // Use buffer if available, otherwise read from path
    if (file.buffer) {
      formData.append("media", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else if (file.path) {
      formData.append("media", fs.createReadStream(file.path));
    } else {
      throw new Error("No file buffer or path available");
    }

    formData.append(
      "models",
      "nudity-2.1,type,offensive-2.0,faces,people-counting,text-content,face-age,text,qr-content,genai,self-harm"
    );
    formData.append("api_user", config.sightengineApi.apiUser);
    formData.append("api_secret", config.sightengineApi.apiSecret);

    const response = await axios({
      method: "post",
      url: "https://api.sightengine.com/1.0/check.json",
      data: formData,
      headers: formData.getHeaders(),
    });

    console.log("Image moderation response:", response.data);

    return response.data as ImageModerationResult;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Image detection failed: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Image detection request failed: ${error.message}`);
  }
};

/**
 * Check image from file upload
 * @param imagePath - Full path to the image file
 * @returns Image detection results
 */
const moderateImageFromFile = async (
  imagePath: string
): Promise<ImageModerationResult> => {
  try {
    // Check if file exists
    if (!fs.existsSync(imagePath)) {
      throw new Error(`Image file not found: ${imagePath}`);
    }

    const formData = new FormData();
    formData.append("media", fs.createReadStream(imagePath));
    formData.append(
      "models",
      "nudity-2.1,type,offensive-2.0,faces,people-counting,text-content,face-age,text,qr-content,genai,self-harm"
    );
    formData.append("api_user", config.sightengineApi.apiUser);
    formData.append("api_secret", config.sightengineApi.apiSecret);

    const response = await axios({
      method: "post",
      url: "https://api.sightengine.com/1.0/check.json",
      data: formData,
      headers: formData.getHeaders(),
    });

    return response.data as ImageModerationResult;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Image detection failed: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Image detection request failed: ${error.message}`);
  }
};

/**
 * Check video from URL
 * @param videoUrl - URL of the video to check
 * @returns Video detection results
 */
const moderateVideoFromUrl = async (
  videoUrl: string
): Promise<VideoModerationResult> => {
  try {
    const response = await axios.get(
      "https://api.sightengine.com/1.0/video/check-workflow-sync.json",
      {
        params: {
          stream_url: videoUrl,
          workflow: config.sightengineApi.workflowId,
          api_user: config.sightengineApi.apiUser,
          api_secret: config.sightengineApi.apiSecret,
        },
      }
    );

    console.log("Video moderation response:", response.data);

    return response.data as VideoModerationResult;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Video detection failed: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Video detection request failed: ${error.message}`);
  }
};

/**
 * Check video from Multer file upload
 * @param file - Multer file object
 * @returns Video detection results
 */
const moderateVideoFromMulterFile = async (
  file: Express.Multer.File
): Promise<VideoModerationResult> => {
  try {
    const formData = new FormData();

    // Use buffer if available, otherwise read from path
    if (file.buffer) {
      formData.append("media", file.buffer, {
        filename: file.originalname,
        contentType: file.mimetype,
      });
    } else if (file.path) {
      formData.append("media", fs.createReadStream(file.path));
    } else {
      throw new Error("No file buffer or path available");
    }

    formData.append("workflow", config.sightengineApi.workflowId);
    formData.append("api_user", config.sightengineApi.apiUser);
    formData.append("api_secret", config.sightengineApi.apiSecret);

    const response = await axios({
      method: "post",
      url: "https://api.sightengine.com/1.0/video/check-workflow-sync.json",
      data: formData,
      headers: formData.getHeaders(),
    });

    console.log("Video moderation response:", response.data);

    return response.data as VideoModerationResult;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Video detection failed: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Video detection request failed: ${error.message}`);
  }
};

/**
 * Check video from file upload
 * @param videoPath - Full path to the video file
 * @returns Video detection results
 */
const moderateVideoFromFile = async (
  videoPath: string
): Promise<VideoModerationResult> => {
  try {
    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }

    const formData = new FormData();
    formData.append("media", fs.createReadStream(videoPath));
    formData.append("workflow", config.sightengineApi.workflowId);
    formData.append("api_user", config.sightengineApi.apiUser);
    formData.append("api_secret", config.sightengineApi.apiSecret);

    const response = await axios({
      method: "post",
      url: "https://api.sightengine.com/1.0/video/check-workflow-sync.json",
      data: formData,
      headers: formData.getHeaders(),
    });

    return response.data as VideoModerationResult;
  } catch (error: any) {
    if (error.response) {
      throw new Error(
        `Video detection failed: ${JSON.stringify(error.response.data)}`
      );
    }
    throw new Error(`Video detection request failed: ${error.message}`);
  }
};
