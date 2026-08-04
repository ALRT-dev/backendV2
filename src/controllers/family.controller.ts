import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import type {
  CreateFamilyCircleInput,
  CreateFamilyPlaceInput,
  FamilyCheckInInput,
  FamilyCheckInRequestInput,
  FamilyLocationPingInput,
  FamilyScheduledCheckInInput,
  ExtendFamilyJourneyInput,
  FamilyJourneyPointInput,
  FamilySosListInput,
  FamilySosListUpdateInput,
  StartFamilyJourneyInput,
  JoinFamilyCircleInput,
  RespondFamilyLocationRequestInput,
  RespondFamilySosInput,
  TransferFamilyOwnershipInput,
  TriggerFamilySosInput,
  UpdateFamilyCircleInput,
  UpdateFamilyMemberInput,
  UpdateFamilyPlaceInput,
  UpdateFamilyPlacePrefInput,
} from "../validators/family.validator.js";
import * as familyService from "../services/family.service.js";
import * as familyJourneyService from "../services/family_journey.service.js";
import {
  deleteFileFromS3,
  extractS3KeyFromUrl,
  uploadFileToS3,
} from "../services/s3.service.js";
import {
  createLocationRequest,
  getPendingLocationRequests,
  respondToLocationRequest,
  shareLocationSnapshot,
} from "../services/family_alert.service.js";

const requireUserId = (res: Response): string => {
  const { userId } = res;
  if (!userId) throw new HttpError(400, "Unauthenticated user");
  return userId;
};

// --- Circle ---------------------------------------------------------------

/** Optional ?circleId= scoping; absent means the user's first circle. */
const circleIdOf = (req: Request): string | undefined => {
  const circleId = req.query.circleId;
  return typeof circleId === "string" && circleId.length > 0
    ? circleId
    : undefined;
};

export const createCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { name }: CreateFamilyCircleInput = req.body;
    const created = await familyService.createCircle(userId, name);
    const circle = await familyService.getCircleForUser(userId, created.id);
    res.status(201).json(circle);
  } catch (error) {
    next(error);
  }
};

export const listCirclesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const circles = await familyService.listCirclesForUser(userId);
    res.status(200).json(circles);
  } catch (error) {
    next(error);
  }
};

export const getCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const circle = await familyService.getCircleForUser(
      userId,
      circleIdOf(req),
    );
    if (!circle) {
      res.status(200).json(null);
      return;
    }
    res.status(200).json(circle);
  } catch (error) {
    next(error);
  }
};

export const updateCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: UpdateFamilyCircleInput = req.body;
    const circle = await familyService.updateCircle(userId, input, circleIdOf(req));
    res.status(200).json(circle);
  } catch (error) {
    next(error);
  }
};

export const listTransferCandidatesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const result = await familyService.listTransferCandidates(
      userId,
      circleIdOf(req),
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const transferOwnershipController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { newOwnerMemberId }: TransferFamilyOwnershipInput = req.body;
    await familyService.transferOwnership(
      userId,
      newOwnerMemberId,
      circleIdOf(req),
    );
    const circle = await familyService.getCircleForUser(userId, circleIdOf(req));
    res.status(200).json(circle);
  } catch (error) {
    next(error);
  }
};

export const deleteCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    await familyService.deleteCircle(userId, circleIdOf(req));
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const leaveCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    await familyService.leaveCircle(userId, circleIdOf(req));
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const removeMemberController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { memberId } = req.params;
    if (!memberId) throw new HttpError(400, "memberId is required");
    await familyService.removeMember(userId, memberId);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const updateOwnMemberController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: UpdateFamilyMemberInput = req.body;
    const member = await familyService.updateOwnMember(userId, input, circleIdOf(req));
    res.status(200).json(member);
  } catch (error) {
    next(error);
  }
};

/** PUT /api/family/members/me/photo — circle-specific member photo. */
export const updateOwnMemberPhotoController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);

    const file = req.file;
    if (!file) throw new HttpError(400, "Photo file is required");
    if (!file.mimetype.startsWith("image/")) {
      throw new HttpError(400, "Photo must be an image file");
    }

    const uploadResult = await uploadFileToS3(file, "family-member-photos");
    const { updated, previousPhotoUrl } =
      await familyService.updateOwnMemberPhoto(userId, uploadResult.url, circleIdOf(req));

    // Best-effort cleanup of the replaced photo.
    if (previousPhotoUrl) {
      try {
        const oldKey = extractS3KeyFromUrl(previousPhotoUrl);
        if (oldKey) await deleteFileFromS3(oldKey);
      } catch (error) {
        console.error("Error deleting old family member photo:", error);
      }
    }

    res.status(200).json(updated);
  } catch (error) {
    next(error);
  }
};

// --- Invites ----------------------------------------------------------------

export const createInviteController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const invite = await familyService.createInvite(
      userId,
      circleIdOf(req),
      req.body?.isGuestInvite === true,
    );
    res.status(201).json(invite);
  } catch (error) {
    next(error);
  }
};

export const listInvitesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const invites = await familyService.listInvites(userId, circleIdOf(req));
    res.status(200).json(invites);
  } catch (error) {
    next(error);
  }
};

export const revokeInviteController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { inviteId } = req.params;
    if (!inviteId) throw new HttpError(400, "inviteId is required");
    const invite = await familyService.revokeInvite(userId, inviteId);
    res.status(200).json(invite);
  } catch (error) {
    next(error);
  }
};

export const joinCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { code }: JoinFamilyCircleInput = req.body;
    const member = await familyService.joinCircleWithCode(userId, code);
    const circle = await familyService.getCircleForUser(
      userId,
      member.circleId,
    );
    res.status(200).json(circle);
  } catch (error) {
    next(error);
  }
};

// --- Location snapshots ------------------------------------------------------
// ALRT never live-tracks: these endpoints write one-time, expiring snapshots
// triggered by deliberate member actions only.

export const shareSnapshotController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: FamilyLocationPingInput = req.body;
    const result = await shareLocationSnapshot(
      userId,
      { ...input, via: "manual" },
      circleIdOf(req),
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const createLocationRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { memberId } = req.params;
    if (!memberId) throw new HttpError(400, "memberId is required");
    const request = await createLocationRequest(userId, memberId);
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
};

export const getPendingLocationRequestsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const requests = await getPendingLocationRequests(userId);
    res.status(200).json(requests);
  } catch (error) {
    next(error);
  }
};

export const respondToLocationRequestController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { requestId } = req.params;
    if (!requestId) throw new HttpError(400, "requestId is required");
    const input: RespondFamilyLocationRequestInput = req.body;
    const result = await respondToLocationRequest(userId, requestId, input);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// --- Check-ins ---------------------------------------------------------------

export const checkInController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: FamilyCheckInInput = req.body;
    const checkIn = await familyService.createCheckIn(userId, input, circleIdOf(req));

    // Checking in with a location is a deliberate share — stamp it as a
    // snapshot so the circle sees where the check-in came from (1h TTL).
    if (input.latitude !== undefined && input.longitude !== undefined) {
      shareLocationSnapshot(
        userId,
        { latitude: input.latitude, longitude: input.longitude, via: "checkIn" },
        circleIdOf(req),
      ).catch((error) =>
        console.error("Check-in snapshot stamping failed:", error),
      );
    }

    res.status(201).json(checkIn);
  } catch (error) {
    next(error);
  }
};

export const requestCheckInController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: FamilyCheckInRequestInput = req.body;
    const request = await familyService.requestCheckIn(userId, input, circleIdOf(req));
    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
};

export const listCheckInsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const limit = req.query.limit ? Number(req.query.limit) : 30;
    const checkIns = await familyService.listRecentCheckIns(userId, limit, circleIdOf(req));
    res.status(200).json(checkIns);
  } catch (error) {
    next(error);
  }
};

// --- Scheduled check-ins -----------------------------------------------------

export const createScheduledCheckInController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: FamilyScheduledCheckInInput = req.body;
    const schedule = await familyService.createScheduledCheckIn(userId, input, circleIdOf(req));
    res.status(201).json(schedule);
  } catch (error) {
    next(error);
  }
};

export const listScheduledCheckInsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const schedules = await familyService.listScheduledCheckIns(userId, circleIdOf(req));
    res.status(200).json(schedules);
  } catch (error) {
    next(error);
  }
};

export const deleteScheduledCheckInController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { scheduledCheckInId } = req.params;
    if (!scheduledCheckInId) {
      throw new HttpError(400, "scheduledCheckInId is required");
    }
    const result = await familyService.deleteScheduledCheckIn(
      userId,
      scheduledCheckInId,
    );
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /family/circle/take-over — an eligible member takes over hosting a
 * paused circle. No body: the caller is the new host, the circle comes from
 * ?circleId= or their oldest membership like every circle-scoped endpoint.
 */
export const takeOverCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const circleId = req.query.circleId as string | undefined;
    const circle = await familyService.takeOverCircle(userId, circleId);
    res.status(200).json(circle);
  } catch (error) {
    next(error);
  }
};

// --- SOS recipient presets ---------------------------------------------------

/** GET /family/sos-recipients — every circle with its members, for the list editor. */
export const listSosRecipientsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const groups = await familyService.listSosRecipients(userId);
    res.status(200).json(groups);
  } catch (error) {
    next(error);
  }
};

export const listSosListsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const lists = await familyService.listSosLists(userId);
    res.status(200).json(lists);
  } catch (error) {
    next(error);
  }
};

export const createSosListController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: FamilySosListInput = req.body;
    const list = await familyService.createSosList(userId, input);
    res.status(201).json(list);
  } catch (error) {
    next(error);
  }
};

export const updateSosListController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { sosListId } = req.params;
    if (!sosListId) throw new HttpError(400, "sosListId is required");
    const input: FamilySosListUpdateInput = req.body;
    const list = await familyService.updateSosList(userId, sosListId, input);
    res.status(200).json(list);
  } catch (error) {
    next(error);
  }
};

export const deleteSosListController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { sosListId } = req.params;
    if (!sosListId) throw new HttpError(400, "sosListId is required");
    const result = await familyService.deleteSosList(userId, sosListId);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

// --- Places ------------------------------------------------------------------

export const listPlacesController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const places = await familyService.listPlaces(userId, circleIdOf(req));
    res.status(200).json(places);
  } catch (error) {
    next(error);
  }
};

export const createPlaceController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: CreateFamilyPlaceInput = req.body;
    const place = await familyService.createPlace(userId, input, circleIdOf(req));
    res.status(201).json(place);
  } catch (error) {
    next(error);
  }
};

export const updatePlaceController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { placeId } = req.params;
    if (!placeId) throw new HttpError(400, "placeId is required");
    const input: UpdateFamilyPlaceInput = req.body;
    const place = await familyService.updatePlace(userId, placeId, input);
    res.status(200).json(place);
  } catch (error) {
    next(error);
  }
};

export const deletePlaceController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { placeId } = req.params;
    if (!placeId) throw new HttpError(400, "placeId is required");
    await familyService.deletePlace(userId, placeId);
    res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const updatePlacePrefController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { placeId } = req.params;
    if (!placeId) throw new HttpError(400, "placeId is required");
    const input: UpdateFamilyPlacePrefInput = req.body;
    const pref = await familyService.updatePlaceNotificationPref(
      userId,
      placeId,
      input,
    );
    res.status(200).json(pref);
  } catch (error) {
    next(error);
  }
};

// --- SOS -----------------------------------------------------------------------

export const triggerSosController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: TriggerFamilySosInput = req.body;

    // SOS shares a snapshot at trigger (sender-controlled re-shares after).
    // Stamp it first so the SOS event picks up the fresh suburb label.
    if (input.latitude !== undefined && input.longitude !== undefined) {
      try {
        await shareLocationSnapshot(
          userId,
          { latitude: input.latitude, longitude: input.longitude, via: "sos" },
          circleIdOf(req),
        );
      } catch (error) {
        console.error("SOS snapshot stamping failed:", error);
      }
    }

    const sos = await familyService.triggerSos(userId, input, circleIdOf(req));
    res.status(201).json(sos);
  } catch (error) {
    next(error);
  }
};

export const respondSosController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { sosEventId } = req.params;
    if (!sosEventId) throw new HttpError(400, "sosEventId is required");
    const { type }: RespondFamilySosInput = req.body;
    const response = await familyService.respondToSos(userId, sosEventId, type);
    res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

export const resolveSosController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { sosEventId } = req.params;
    if (!sosEventId) throw new HttpError(400, "sosEventId is required");
    const sos = await familyService.resolveSos(userId, sosEventId);
    res.status(200).json(sos);
  } catch (error) {
    next(error);
  }
};

export const getActiveSosController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const events = await familyService.getActiveSos(userId, circleIdOf(req));
    res.status(200).json(events);
  } catch (error) {
    next(error);
  }
};

// ---------------------------------------------------------------------------
// Journeys
// ---------------------------------------------------------------------------

export const startJourneyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const journey = await familyJourneyService.startJourney(
      userId,
      req.body as StartFamilyJourneyInput,
      circleIdOf(req),
    );
    res.status(201).json(journey);
  } catch (error) {
    next(error);
  }
};

export const extendJourneyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { minutes } = req.body as ExtendFamilyJourneyInput;
    const journey = await familyJourneyService.extendJourney(
      userId,
      req.params.journeyId!,
      minutes,
    );
    res.status(200).json(journey);
  } catch (error) {
    next(error);
  }
};

export const stopJourneyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const journey = await familyJourneyService.stopJourney(
      userId,
      req.params.journeyId!,
    );
    res.status(200).json(journey);
  } catch (error) {
    next(error);
  }
};

export const journeyPointController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const journey = await familyJourneyService.recordJourneyPoint(
      userId,
      req.params.journeyId!,
      req.body as FamilyJourneyPointInput,
    );
    res.status(200).json(journey);
  } catch (error) {
    next(error);
  }
};

export const getMyJourneyController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const journey = await familyJourneyService.getMyActiveJourney(
      userId,
      circleIdOf(req),
    );
    res.status(200).json(journey);
  } catch (error) {
    next(error);
  }
};

export const listSharedJourneysController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const journeys = await familyJourneyService.listJourneysSharedWithMe(
      userId,
      circleIdOf(req),
    );
    res.status(200).json(journeys);
  } catch (error) {
    next(error);
  }
};
