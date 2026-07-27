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
 * @returns Object with detailed results per file
 */
export const checkMediasForProblems = async (
  files: Express.Multer.File[]
): Promise<{
  validFiles: Express.Multer.File[];
  problematicFiles: Array<{ file: Express.Multer.File; reasons: string[] }>;
  hasProblematicFiles: boolean;
  /**
   * True when the moderation provider could not screen one or more files.
   * Unscreened files are still accepted for upload, but callers must route
   * the report to manual review instead of auto-publishing it.
   */
  moderationUnavailable: boolean;
}> => {
  const THRESHOLD = 0.5; // Probability threshold for flagging content
  const validFiles: Express.Multer.File[] = [];
  const problematicFiles: Array<{
    file: Express.Multer.File;
    reasons: string[];
  }> = [];
  let moderationUnavailable = false;

  for (const file of files) {
    const fileReasons: string[] = [];
    const isVideo = file.mimetype.startsWith("video/");
    const isImage = file.mimetype.startsWith("image/");

    try {
      if (isVideo) {
        const result = await moderateVideoFromMulterFile(file);

        if (result.summary.action === "reject") {
          const videoReasons = result.summary.reject_reason.map(
            (r) => `${r.text} detected.`
          );
          fileReasons.push(...videoReasons);
        }
      } else if (isImage) {
        const result = await moderateImageFromMulterFile(file);

        // Check nudity
        if (result.nudity.sexual_activity > THRESHOLD) {
          fileReasons.push("Sexual activity detected.");
        }
        if (result.nudity.sexual_display > THRESHOLD) {
          fileReasons.push("Sexual display detected.");
        }
        if (result.nudity.erotica > THRESHOLD) {
          fileReasons.push("Erotica content detected.");
        }

        // Check offensive content
        if (result.offensive.nazi > THRESHOLD) {
          fileReasons.push("Nazi symbols detected.");
        }
        if (result.offensive.confederate > THRESHOLD) {
          fileReasons.push("Confederate symbols detected.");
        }
        if (result.offensive.supremacist > THRESHOLD) {
          fileReasons.push("Supremacist content detected.");
        }
        if (result.offensive.terrorist > THRESHOLD) {
          fileReasons.push("Terrorist content detected.");
        }
        if (result.offensive.middle_finger > THRESHOLD) {
          fileReasons.push("Offensive gestures detected.");
        }

        // Check self-harm
        if (result["self-harm"].prob > THRESHOLD) {
          fileReasons.push("Self-harm content detected.");
        }

        // Check for faces
        if (result.faces.length > 0) {
          fileReasons.push("Faces detected.");
        }

        // Check for minors
        const hasMinor = result.faces.some(
          (face) => face.attributes.age.minor > THRESHOLD
        );
        if (hasMinor) {
          fileReasons.push("Minor detected.");
        }

        // Check text content
        if (result.text.profanity.length > 0) {
          fileReasons.push("Profanity in text detected.");
        }
        if (result.text.personal.length > 0) {
          fileReasons.push(
            "Personal information detected (names, license plates, etc.)."
          );
        }
        if (result.text.extremism.length > 0) {
          fileReasons.push("Extremism in text detected.");
        }
        if (result.text.violence.length > 0) {
          fileReasons.push("Violence in text detected.");
        }
        if (result.text["self-harm"].length > 0) {
          fileReasons.push("Self-harm in text detected.");
        }

        // Check QR codes for personal information
        if (result.qr.personal.length > 0) {
          fileReasons.push("QR code with personal information detected.");
        }
      }
    } catch (error: any) {
      // Fail safe, not open: the file is kept, but the report must go to
      // manual review because it was never screened.
      console.error(
        `Media moderation unavailable for ${file.originalname}:`,
        error?.message ?? error
      );
      moderationUnavailable = true;
    }

    // Categorize the file
    if (fileReasons.length > 0) {
      problematicFiles.push({ file, reasons: fileReasons });
    } else {
      validFiles.push(file);
    }
  }

  const result = {
    validFiles,
    problematicFiles,
    hasProblematicFiles: problematicFiles.length > 0,
    moderationUnavailable,
  };

  if (files.length > 0) {
    console.log(
      `Media moderation result: ${validFiles.length} valid, ${problematicFiles.length} problematic out of ${files.length} total files${moderationUnavailable ? " (moderation unavailable for some files — routing to manual review)" : ""}`
    );
    if (problematicFiles.length > 0) {
      problematicFiles.forEach(({ file, reasons }) => {
        console.log(`  - ${file.originalname}: ${reasons.join(", ")}`);
      });
    }
  }

  return result;
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
        // Don't let a slow moderation call hang the hazard submission.
        timeout: 15000,
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
        // Don't let a slow moderation call hang the hazard submission.
        timeout: 20000,
      }
    );

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
