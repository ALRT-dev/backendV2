import { Router } from "express";
import {
  getCategoriesForAdmin,
  createHazardCategoryForAdmin,
  updateHazardCategoryForAdmin,
  deleteHazardCategoryForAdmin,
} from "../../controllers/admin/hazard_category.controller.js";
import {
  requireAdminAuth,
  requireAnyAdmin,
  requireAdminOrAbove,
} from "../../middlewares/auth.admin.middleware.js";
import { validate } from "../../middlewares/validation.middleware.js";
import {
  createHazardCategoryForAdminBodySchema,
  updateHazardCategoryForAdminBodySchema,
} from "../../validators/admin/hazard_category.validator.js";
import {
  optionalCategoryImagesUpload,
  handleCategoryImagesMulterError,
} from "../../middlewares/upload.middleware.js";
import { normalizeCategoryMultipartBody } from "../../middlewares/category_multipart.middleware.js";

const adminHazardCategoryRouter = Router();

// All routes below require admin authentication
adminHazardCategoryRouter.use(requireAdminAuth);

// Read operations - any admin role
adminHazardCategoryRouter.get("/", requireAnyAdmin, getCategoriesForAdmin);

// Write operations - admin or above (multipart optional for images)
//
// --- POST / (create category) ---
// Request: Either JSON or multipart/form-data.
//   - JSON: Body = { name (required), id?, description?, color? (hex), keywords?, isFireRelated?, parentId?, imageDimensions? }.
//   - Multipart: Form field "data" = JSON string of the same body; optional "imageDimensions" = JSON string like
//     { "info": { "width": 100, "height": 100 }, ... } (keys: info, monitor, action, critical, advice, watchAndAct, emergency, user, fireActive, fireBeingControlled, fireUnderControl, fireClosed).
//     Optional image files (one per slot, max 5MB each): infoImage, monitorImage, actionImage, criticalImage, adviceImage, watchAndActImage, emergencyImage, userImage, fireActiveImage, fireBeingControlledImage, fireUnderControlImage, fireClosedImage.
// Response: 201, body = created category with parent, subCategories, images[] (each: id, categoryId, imageType, s3Key, width?, height?, fileSizeBytes?, presignedUrl).
//
// --- PUT /:categoryId (update category) ---
// Request: Same as create (JSON or multipart). All fields optional except for validation when present; imageDimensions and image files update only the given slots.
// Response: 200, body = updated category with parent, subCategories, images[] (same shape as create; presignedUrl generated from s3Key).
//
adminHazardCategoryRouter.post(
  "/",
  requireAdminOrAbove,
  optionalCategoryImagesUpload,
  handleCategoryImagesMulterError,
  normalizeCategoryMultipartBody,
  validate(createHazardCategoryForAdminBodySchema),
  createHazardCategoryForAdmin,
);
adminHazardCategoryRouter.put(
  "/:categoryId",
  requireAdminOrAbove,
  optionalCategoryImagesUpload,
  handleCategoryImagesMulterError,
  normalizeCategoryMultipartBody,
  validate(updateHazardCategoryForAdminBodySchema),
  updateHazardCategoryForAdmin,
);
adminHazardCategoryRouter.delete(
  "/:categoryId",
  requireAdminOrAbove,
  deleteHazardCategoryForAdmin,
);

export default adminHazardCategoryRouter;
