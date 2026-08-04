import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { requireMembership, notifyCircle } from "./family.service.js";

// Locked journey rules:
// - A journey always has a hard stop the traveller chose. Nothing is
//   open-ended, and nothing renews on its own.
// - Snap points are the default; live is a per-journey opt-in and is never
//   an ALRT+ upsell.
// - Only the recipients the traveller picked can see it.
// - One hour at most per block, four hours total across extensions, which
//   matches the live-share cap.
const MAX_BLOCK_MINUTES = 60;
const MAX_TOTAL_MINUTES = 240;

/** The durations the app offers when starting a journey. */
const ALLOWED_START_MINUTES = [30, 60];

const journeyInclude = {
  member: {
    include: {
      user: { select: { id: true, name: true, profilePictureUrl: true } },
    },
  },
  recipients: {
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
    },
  },
} as const;

/** Shapes a journey for the client. Location travels only while active. */
export const serializeJourney = (journey: any) => {
  const isActive = journey.status === "active" && journey.endsAt > new Date();
  return {
    id: journey.id,
    circleId: journey.circleId,
    memberId: journey.memberId,
    memberName:
      journey.member?.nickname ||
      journey.member?.user?.name ||
      "Family member",
    status: journey.status,
    isLive: journey.isLive,
    endsAt: journey.endsAt,
    endedAt: journey.endedAt,
    grantedMinutes: journey.grantedMinutes,
    canExtend: journey.grantedMinutes < MAX_TOTAL_MINUTES,
    maxTotalMinutes: MAX_TOTAL_MINUTES,
    // A finished journey keeps its times and nothing else: the event log
    // survives, the location data does not.
    latitude: isActive ? journey.latitude : null,
    longitude: isActive ? journey.longitude : null,
    locationLabel: isActive ? journey.locationLabel : null,
    recipients: (journey.recipients ?? []).map((r: any) => ({
      memberId: r.memberId,
      name: r.member?.nickname || r.member?.user?.name || "Family member",
      profilePictureUrl:
        r.member?.photoUrl || r.member?.user?.profilePictureUrl || null,
    })),
    createdAt: journey.createdAt,
  };
};

/**
 * Starts a journey. Any journey already running for this member is ended
 * first, so a traveller can never be sharing two at once.
 */
export const startJourney = async (
  userId: string,
  input: {
    durationMinutes: number;
    isLive?: boolean | undefined;
    recipientMemberIds: string[];
  },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);

  if (!ALLOWED_START_MINUTES.includes(input.durationMinutes)) {
    throw new HttpError(
      400,
      `A journey runs for ${ALLOWED_START_MINUTES.join(" or ")} minutes`,
    );
  }
  if (input.recipientMemberIds.length === 0) {
    throw new HttpError(400, "Pick at least one person to share with");
  }

  // Recipients must be current members of this circle, and never yourself.
  const recipients = await prisma.familyMember.findMany({
    where: {
      id: { in: input.recipientMemberIds },
      circleId: membership.circleId,
      NOT: { id: membership.id },
    },
    select: { id: true },
  });
  if (recipients.length === 0) {
    throw new HttpError(400, "Those people are not in this circle");
  }

  await endActiveJourneysFor(membership.id);

  const endsAt = new Date(Date.now() + input.durationMinutes * 60 * 1000);
  const journey = await prisma.familyJourney.create({
    data: {
      circleId: membership.circleId,
      memberId: membership.id,
      isLive: input.isLive === true,
      endsAt,
      grantedMinutes: input.durationMinutes,
      recipients: {
        create: recipients.map((r) => ({ memberId: r.id })),
      },
    },
    include: journeyInclude,
  });

  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });

  return serializeJourney(journey);
};

/**
 * Extends a running journey by one more hour, never past the total cap.
 * Only the traveller can extend, and only by asking.
 */
export const extendJourney = async (
  userId: string,
  journeyId: string,
  minutes = MAX_BLOCK_MINUTES,
) => {
  const journey = await requireOwnJourney(userId, journeyId);

  if (journey.status !== "active") {
    throw new HttpError(400, "That journey has already ended");
  }
  if (minutes < 1 || minutes > MAX_BLOCK_MINUTES) {
    throw new HttpError(
      400,
      `Journeys extend by up to ${MAX_BLOCK_MINUTES} minutes at a time`,
    );
  }

  const granted = journey.grantedMinutes + minutes;
  if (granted > MAX_TOTAL_MINUTES) {
    throw new HttpError(
      400,
      `A journey can run for ${MAX_TOTAL_MINUTES / 60} hours in total`,
    );
  }

  // Extend from whichever is later: now, or the stop the traveller had.
  const base =
    journey.endsAt > new Date() ? journey.endsAt.getTime() : Date.now();

  const updated = await prisma.familyJourney.update({
    where: { id: journey.id },
    data: {
      endsAt: new Date(base + minutes * 60 * 1000),
      grantedMinutes: granted,
    },
    include: journeyInclude,
  });
  return serializeJourney(updated);
};

/**
 * Stops a journey now. The stop is one tap and always available, and the
 * last position goes with it — history keeps the times, not the places.
 */
export const stopJourney = async (userId: string, journeyId: string) => {
  const journey = await requireOwnJourney(userId, journeyId);

  const updated = await prisma.familyJourney.update({
    where: { id: journey.id },
    data: {
      status: "ended",
      endedAt: new Date(),
      latitude: null,
      longitude: null,
      locationLabel: null,
    },
    include: journeyInclude,
  });

  await notifyCircle({
    circleId: journey.circleId,
    excludeMemberIds: [journey.memberId],
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: journey.circleId },
  });

  return serializeJourney(updated);
};

/** The caller's own running journey in this circle, or null. */
export const getMyActiveJourney = async (
  userId: string,
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  const journey = await prisma.familyJourney.findFirst({
    where: {
      memberId: membership.id,
      status: "active",
      endsAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: journeyInclude,
  });
  return journey ? serializeJourney(journey) : null;
};

/**
 * Journeys shared WITH the caller that are still running. Being in the
 * circle is not enough: the traveller has to have picked you.
 */
export const listJourneysSharedWithMe = async (
  userId: string,
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  const journeys = await prisma.familyJourney.findMany({
    where: {
      circleId: membership.circleId,
      status: "active",
      endsAt: { gt: new Date() },
      recipients: { some: { memberId: membership.id } },
    },
    orderBy: { createdAt: "desc" },
    include: journeyInclude,
  });
  return journeys.map(serializeJourney);
};

/**
 * Records a point on a running journey. Snap-point journeys keep only the
 * newest position; live ones do the same on the journey row, because the
 * trail is never retained beyond the journey itself.
 */
export const recordJourneyPoint = async (
  userId: string,
  journeyId: string,
  input: {
    latitude: number;
    longitude: number;
    locationLabel?: string | undefined;
  },
) => {
  const journey = await requireOwnJourney(userId, journeyId);
  if (journey.status !== "active" || journey.endsAt <= new Date()) {
    throw new HttpError(400, "That journey has already ended");
  }

  const updated = await prisma.familyJourney.update({
    where: { id: journey.id },
    data: {
      latitude: input.latitude,
      longitude: input.longitude,
      ...(input.locationLabel !== undefined && {
        locationLabel: input.locationLabel,
      }),
    },
    include: journeyInclude,
  });
  return serializeJourney(updated);
};

/**
 * Ends every journey whose stop time has passed, clearing the location as
 * it goes. Run from the same sweep that purges expired location data.
 */
export const endLapsedJourneys = async (): Promise<number> => {
  const result = await prisma.familyJourney.updateMany({
    where: { status: "active", endsAt: { lte: new Date() } },
    data: {
      status: "ended",
      endedAt: new Date(),
      latitude: null,
      longitude: null,
      locationLabel: null,
    },
  });
  return result.count;
};

const endActiveJourneysFor = async (memberId: string) => {
  await prisma.familyJourney.updateMany({
    where: { memberId, status: "active" },
    data: {
      status: "ended",
      endedAt: new Date(),
      latitude: null,
      longitude: null,
      locationLabel: null,
    },
  });
};

/** Loads a journey and proves the caller is the traveller sharing it. */
const requireOwnJourney = async (userId: string, journeyId: string) => {
  const journey = await prisma.familyJourney.findUnique({
    where: { id: journeyId },
    include: { member: { select: { userId: true } } },
  });
  if (!journey) throw new HttpError(404, "Journey not found");
  if (journey.member.userId !== userId) {
    throw new HttpError(403, "Only the traveller can change their journey");
  }
  return journey;
};

export { MAX_BLOCK_MINUTES, MAX_TOTAL_MINUTES, ALLOWED_START_MINUTES };
