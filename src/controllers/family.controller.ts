import type { Request, Response, NextFunction } from "express";
import { HttpError } from "../models/http_error.js";
import type {
  CreateFamilyCircleInput,
  CreateFamilyPlaceInput,
  FamilyCheckInInput,
  FamilyCheckInRequestInput,
  FamilyLocationPingInput,
  JoinFamilyCircleInput,
  RespondFamilySosInput,
  TriggerFamilySosInput,
  UpdateFamilyCircleInput,
  UpdateFamilyMemberInput,
  UpdateFamilyPlaceInput,
  UpdateFamilyPlacePrefInput,
} from "../validators/family.validator.js";
import * as familyService from "../services/family.service.js";
import { processLocationPing } from "../services/family_alert.service.js";

const requireUserId = (res: Response): string => {
  const { userId } = res;
  if (!userId) throw new HttpError(400, "Unauthenticated user");
  return userId;
};

// --- Circle ---------------------------------------------------------------

export const createCircleController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const { name }: CreateFamilyCircleInput = req.body;
    await familyService.createCircle(userId, name);
    const circle = await familyService.getCircleForUser(userId);
    res.status(201).json(circle);
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
    const circle = await familyService.getCircleForUser(userId);
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
    const { name }: UpdateFamilyCircleInput = req.body;
    const circle = await familyService.updateCircle(userId, name);
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
    await familyService.deleteCircle(userId);
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
    await familyService.leaveCircle(userId);
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
    const member = await familyService.updateOwnMember(userId, input);
    res.status(200).json(member);
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
    const invite = await familyService.createInvite(userId);
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
    const invites = await familyService.listInvites(userId);
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
    await familyService.joinCircleWithCode(userId, code);
    const circle = await familyService.getCircleForUser(userId);
    res.status(200).json(circle);
  } catch (error) {
    next(error);
  }
};

// --- Live location ----------------------------------------------------------

export const locationPingController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = requireUserId(res);
    const input: FamilyLocationPingInput = req.body;
    const result = await processLocationPing(userId, input);
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
    const checkIn = await familyService.createCheckIn(userId, input);
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
    const request = await familyService.requestCheckIn(userId, input);
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
    const checkIns = await familyService.listRecentCheckIns(userId, limit);
    res.status(200).json(checkIns);
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
    const places = await familyService.listPlaces(userId);
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
    const place = await familyService.createPlace(userId, input);
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
    const sos = await familyService.triggerSos(userId, input);
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
    const events = await familyService.getActiveSos(userId);
    res.status(200).json(events);
  } catch (error) {
    next(error);
  }
};
