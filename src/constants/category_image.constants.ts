import { CategoryImageType } from "@prisma/client";

/**
 * Form field names for category image uploads (multipart).
 * Maps to CategoryImageType for create/update category routes.
 */
export const CATEGORY_IMAGE_FIELD_TO_TYPE: Record<string, CategoryImageType> = {
  infoImage: CategoryImageType.info,
  monitorImage: CategoryImageType.monitor,
  actionImage: CategoryImageType.action,
  criticalImage: CategoryImageType.critical,
  adviceImage: CategoryImageType.advice,
  watchAndActImage: CategoryImageType.watchAndAct,
  emergencyImage: CategoryImageType.emergency,
  userImage: CategoryImageType.user,
  fireActiveImage: CategoryImageType.fireActive,
  fireBeingControlledImage: CategoryImageType.fireBeingControlled,
  fireUnderControlImage: CategoryImageType.fireUnderControl,
  fireClosedImage: CategoryImageType.fireClosed,
};

export const CATEGORY_IMAGE_FIELD_NAMES = Object.keys(
  CATEGORY_IMAGE_FIELD_TO_TYPE
) as (keyof typeof CATEGORY_IMAGE_FIELD_TO_TYPE)[];

export const CATEGORY_IMAGE_UPLOAD_FIELDS = CATEGORY_IMAGE_FIELD_NAMES.map(
  (name) => ({ name, maxCount: 1 as const })
);
