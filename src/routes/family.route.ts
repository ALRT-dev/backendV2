import { Router } from "express";
import {
  handleMulterError,
  uploadProfilePicture,
} from "../middlewares/upload.middleware.js";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  createFamilyCircleSchema,
  extendFamilyJourneySchema,
  familyJourneyPointSchema,
  startFamilyJourneySchema,
  updateFamilyCircleSchema,
  joinFamilyCircleSchema,
  updateFamilyMemberSchema,
  familyLocationPingSchema,
  familyCheckInSchema,
  familyScheduledCheckInSchema,
  familySosListSchema,
  familySosListUpdateSchema,
  familyCheckInRequestSchema,
  createFamilyPlaceSchema,
  updateFamilyPlaceSchema,
  updateFamilyPlacePrefSchema,
  respondFamilyLocationRequestSchema,
  triggerFamilySosSchema,
  respondFamilySosSchema,
  transferFamilyOwnershipSchema,
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
  updateCirclePhotoController,
  removeCirclePhotoController,
  createInviteController,
  extendJourneyController,
  getMyJourneyController,
  journeyPointController,
  listSharedJourneysController,
  startJourneyController,
  stopJourneyController,
  listInvitesController,
  revokeInviteController,
  joinCircleController,
  listCirclesController,
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
  listSosListsController,
  listSosRecipientsController,
  takeOverCircleController,
  createSosListController,
  updateSosListController,
  deleteSosListController,
  respondSosController,
  resolveSosController,
  getSosTrailController,
  getActiveSosController,
  listTransferCandidatesController,
  transferOwnershipController,
} from "../controllers/family.controller.js";

const familyRouter = Router();

// All family routes require an authenticated user.
familyRouter.use(requireAuth);

// Circle
// All circle-scoped endpoints accept an optional ?circleId= query param;
// without it they default to the user's first (oldest) circle.
familyRouter.get("/circles", listCirclesController);
familyRouter.post("/circle", validate(createFamilyCircleSchema), createCircleController);
familyRouter.get("/circle", getCircleController);
familyRouter.put("/circle", validate(updateFamilyCircleSchema), updateCircleController);
familyRouter.delete("/circle", deleteCircleController);

// Group picture (owner only) — how the circle is recognised on the hub,
// the switcher and the home-screen widget.
familyRouter.put(
  "/circle/photo",
  uploadProfilePicture,
  handleMulterError,
  updateCirclePhotoController,
);
familyRouter.delete("/circle/photo", removeCirclePhotoController);
familyRouter.post("/circle/leave", leaveCircleController);

// Ownership transfer (§29): host hands the circle — and its seats — to an
// eligible member. Ineligible members are listed greyed with a reason.
familyRouter.get("/circle/transfer-candidates", listTransferCandidatesController);
familyRouter.post(
  "/circle/transfer-ownership",
  validate(transferFamilyOwnershipSchema),
  transferOwnershipController,
);

// Takeover: an eligible member revives a paused circle by becoming its
// host. Only valid while the circle is paused — a live circle changes
// hands through transfer-ownership above.
familyRouter.post("/circle/take-over", takeOverCircleController);

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

// SOS recipient presets (§28) — configured in advance, never mid-emergency
familyRouter.get("/sos-lists", listSosListsController);
familyRouter.get("/sos-recipients", listSosRecipientsController);
familyRouter.post(
  "/sos-lists",
  validate(familySosListSchema),
  createSosListController,
);
familyRouter.put(
  "/sos-lists/:sosListId",
  validate(familySosListUpdateSchema),
  updateSosListController,
);
familyRouter.delete("/sos-lists/:sosListId", deleteSosListController);

familyRouter.post("/sos", validate(triggerFamilySosSchema), triggerSosController);
familyRouter.get("/sos/active", getActiveSosController);
familyRouter.post("/sos/:sosEventId/respond", validate(respondFamilySosSchema), respondSosController);
familyRouter.post("/sos/:sosEventId/resolve", resolveSosController);
// Live trail behind an active SOS: exists only until stand-down wipes it.
familyRouter.get("/sos/:sosEventId/trail", getSosTrailController);


// Journeys — a trip the traveller chooses to share, always with a hard stop
// they picked. Snap points by default; live is a per-journey opt-in.
familyRouter.post(
  "/journeys",
  validate(startFamilyJourneySchema),
  startJourneyController,
);
familyRouter.get("/journeys/me", getMyJourneyController);
familyRouter.get("/journeys/shared", listSharedJourneysController);
familyRouter.post(
  "/journeys/:journeyId/extend",
  validate(extendFamilyJourneySchema),
  extendJourneyController,
);
familyRouter.post(
  "/journeys/:journeyId/point",
  validate(familyJourneyPointSchema),
  journeyPointController,
);
familyRouter.post("/journeys/:journeyId/stop", stopJourneyController);

export default familyRouter;
