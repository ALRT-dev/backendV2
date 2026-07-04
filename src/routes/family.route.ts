import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createFamilyCircleSchema,
  updateFamilyCircleSchema,
  joinFamilyCircleSchema,
  updateFamilyMemberSchema,
  familyLocationPingSchema,
  familyCheckInSchema,
  familyCheckInRequestSchema,
  createFamilyPlaceSchema,
  updateFamilyPlaceSchema,
  updateFamilyPlacePrefSchema,
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
  createInviteController,
  listInvitesController,
  revokeInviteController,
  joinCircleController,
  locationPingController,
  checkInController,
  requestCheckInController,
  listCheckInsController,
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

// Invites
familyRouter.post("/invites", createInviteController);
familyRouter.get("/invites", listInvitesController);
familyRouter.post("/invites/:inviteId/revoke", revokeInviteController);
familyRouter.post("/join", validate(joinFamilyCircleSchema), joinCircleController);

// Live location
familyRouter.post("/location", validate(familyLocationPingSchema), locationPingController);

// Check-ins
familyRouter.post("/check-in", validate(familyCheckInSchema), checkInController);
familyRouter.post(
  "/check-in/request",
  validate(familyCheckInRequestSchema),
  requestCheckInController,
);
familyRouter.get("/check-ins", listCheckInsController);

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
