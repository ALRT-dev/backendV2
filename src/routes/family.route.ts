import { Router } from "express";
import {
  handleMulterError,
  uploadProfilePicture,
} from "../middlewares/upload.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createFamilyCircleSchema,
  updateFamilyCircleSchema,
  joinFamilyCircleSchema,
  updateFamilyMemberSchema,
  familyLocationPingSchema,
  familyCheckInSchema,
  familyScheduledCheckInSchema,
  familyCheckInRequestSchema,
  createFamilyPlaceSchema,
  updateFamilyPlaceSchema,
  updateFamilyPlacePrefSchema,
  respondFamilyLocationRequestSchema,
  triggerFamilySosSchema,
  respondFamilySosSchema,
} from "../validators/family.validator.js";
import {
  createCircleController,
  getCircleController,
  updateCircleController,
  deleteCircleController,
  leaveCircleController,
  removeMemberController,
  updateOwnMemberController,
  updateOwnMemberPhotoController,
  createInviteController,
  listInvitesController,
  revokeInviteController,
  joinCircleController,
  shareSnapshotController,
  createLocationRequestController,
  getPendingLocationRequestsController,
  respondToLocationRequestController,
  checkInController,
  requestCheckInController,
  listCheckInsController,
  createScheduledCheckInController,
  listScheduledCheckInsController,
  deleteScheduledCheckInController,
  listPlacesController,
  createPlaceController,
  updatePlaceController,
  deletePlaceController,
  updatePlacePrefController,
  triggerSosController,
  respondSosController,
  resolveSosController,
  getActiveSosController,
} from "../controllers/family.controller.js";

const familyRouter = Router();

// All family routes require an authenticated user.
familyRouter.use(requireAuth);

// Circle
familyRouter.post("/circle", validate(createFamilyCircleSchema), createCircleController);
familyRouter.get("/circle", getCircleController);
familyRouter.put("/circle", validate(updateFamilyCircleSchema), updateCircleController);
familyRouter.delete("/circle", deleteCircleController);
familyRouter.post("/circle/leave", leaveCircleController);

// Members
familyRouter.delete("/members/:memberId", removeMemberController);
familyRouter.put("/members/me", validate(updateFamilyMemberSchema), updateOwnMemberController);
familyRouter.put(
  "/members/me/photo",
  uploadProfilePicture,
  handleMulterError,
  updateOwnMemberPhotoController,
);

// Invites
familyRouter.post("/invites", createInviteController);
familyRouter.get("/invites", listInvitesController);
familyRouter.post("/invites/:inviteId/revoke", revokeInviteController);
familyRouter.post("/join", validate(joinFamilyCircleSchema), joinCircleController);

// Location snapshots (ALRT never live-tracks: one-time, expiring shares)
familyRouter.post("/location", validate(familyLocationPingSchema), shareSnapshotController);
familyRouter.post("/members/:memberId/location-request", createLocationRequestController);
familyRouter.get("/location-requests/pending", getPendingLocationRequestsController);
familyRouter.post(
  "/location-requests/:requestId/respond",
  validate(respondFamilyLocationRequestSchema),
  respondToLocationRequestController,
);

// Check-ins
familyRouter.post("/check-in", validate(familyCheckInSchema), checkInController);
familyRouter.post(
  "/check-in/request",
  validate(familyCheckInRequestSchema),
  requestCheckInController,
);
familyRouter.get("/check-ins", listCheckInsController);

// Scheduled check-ins (daily routine; respond via the normal POST /check-in)
familyRouter.post(
  "/scheduled-check-ins",
  validate(familyScheduledCheckInSchema),
  createScheduledCheckInController,
);
familyRouter.get("/scheduled-check-ins", listScheduledCheckInsController);
familyRouter.delete(
  "/scheduled-check-ins/:scheduledCheckInId",
  deleteScheduledCheckInController,
);

// Saved places
familyRouter.get("/places", listPlacesController);
familyRouter.post("/places", validate(createFamilyPlaceSchema), createPlaceController);
familyRouter.put("/places/:placeId", validate(updateFamilyPlaceSchema), updatePlaceController);
familyRouter.delete("/places/:placeId", deletePlaceController);
familyRouter.put(
  "/places/:placeId/prefs",
  validate(updateFamilyPlacePrefSchema),
  updatePlacePrefController,
);

// SOS
familyRouter.post("/sos", validate(triggerFamilySosSchema), triggerSosController);
familyRouter.get("/sos/active", getActiveSosController);
familyRouter.post("/sos/:sosEventId/respond", validate(respondFamilySosSchema), respondSosController);
familyRouter.post("/sos/:sosEventId/resolve", resolveSosController);

export default familyRouter;
