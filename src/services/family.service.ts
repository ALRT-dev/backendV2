import crypto from "crypto";
import type {
  FamilyCheckInStatus,
  FamilyMember,
  FamilyPlaceIcon,
  FamilyScheduledCheckInMode,
  FamilySharingLevel,
  FamilySosResponseType,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import { sendSocketEventToUsers } from "./socket.service.js";
import { sendPushNotificationToUser } from "./notification.service.js";
import { touchActivityStreak } from "./xp_ledger.service.js";

const INVITE_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L
const DEFAULT_MAX_MEMBERS = 10;

// ---------------------------------------------------------------------------
// Geo helpers
// ---------------------------------------------------------------------------

/** Great-circle distance between two points in kilometres. */
export const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Reduces a full reverse-geocoded address to a short suburb-level label,
 * e.g. "123 Macquarie Dr, Eleebana NSW 2282, Australia" -> "Eleebana".
 */
export const toSuburbLabel = (formattedAddress: string): string => {
  const parts = formattedAddress.split(",").map((p) => p.trim());
  const locality = parts.length >= 2 ? parts[1]! : parts[0]!;
  // Strip trailing state + postcode ("Eleebana NSW 2282" -> "Eleebana")
  return locality.replace(/\s+[A-Z]{2,3}\s+\d{4}$/, "").trim() || locality;
};

// ---------------------------------------------------------------------------
// Membership lookups & serialization
// ---------------------------------------------------------------------------

/**
 * Returns the user's family membership (with circle), or null.
 *
 * With [circleId] the membership in that specific circle is returned;
 * without it the user's first (oldest) membership is the default, which
 * keeps every single-circle client working unchanged.
 */
export const getMembershipForUser = async (
  userId: string,
  circleId?: string,
) => {
  return prisma.familyMember.findFirst({
    where: { userId, ...(circleId && { circleId }) },
    orderBy: { createdAt: "asc" },
    include: { circle: true },
  });
};

/** Returns the user's membership or throws 404 if they have no circle. */
export const requireMembership = async (userId: string, circleId?: string) => {
  const membership = await getMembershipForUser(userId, circleId);
  if (!membership) {
    throw new HttpError(
      404,
      circleId
        ? "You are not a member of this circle"
        : "You are not part of a family circle yet",
    );
  }
  return membership;
};

type MemberWithUser = FamilyMember & {
  user: { id: string; name: string | null; profilePictureUrl: string | null };
};

/**
 * Serializes a member for other circle members, honouring the member's own
 * sharing level. `forSelf` bypasses filtering so users always see their own
 * full state.
 */
export const serializeMember = (
  member: MemberWithUser,
  { forSelf = false }: { forSelf?: boolean } = {},
) => {
  const base = {
    id: member.id,
    userId: member.userId,
    name: member.nickname || member.user.name || "Family member",
    profilePictureUrl: member.photoUrl || member.user.profilePictureUrl,
    colorHex: member.colorHex,
    role: member.role,
    sharingLevel: member.sharingLevel,
    lastCheckInAt: member.lastCheckInAt,
    createdAt: member.createdAt,
  };

  // Snapshots expire: past their TTL they are hidden from everyone,
  // including the member themself (the app re-shares on demand).
  const snapshotIsLive =
    member.locationExpiresAt != null && member.locationExpiresAt > new Date();

  const shareLocation =
    snapshotIsLive &&
    (forSelf ||
      member.sharingLevel === "precise" ||
      member.sharingLevel === "approximate");
  const sharePreciseCoords =
    snapshotIsLive && (forSelf || member.sharingLevel === "precise");

  return {
    ...base,
    latitude: sharePreciseCoords ? member.latitude : null,
    longitude: sharePreciseCoords ? member.longitude : null,
    locationLabel: shareLocation ? member.locationLabel : null,
    locationUpdatedAt: shareLocation ? member.locationUpdatedAt : null,
    locationExpiresAt: shareLocation ? member.locationExpiresAt : null,
    locationSharedVia: shareLocation ? member.locationSharedVia : null,
    batteryLevel: shareLocation ? member.batteryLevel : null,
    isMoving: shareLocation ? member.isMoving : false,
    currentPlaceId: shareLocation ? member.currentPlaceId : null,
  };
};

// ---------------------------------------------------------------------------
// Circle notifications (push + socket to every member except excluded)
// ---------------------------------------------------------------------------

export const getCircleUserIds = async (
  circleId: string,
  excludeMemberIds: string[] = [],
): Promise<string[]> => {
  const members = await prisma.familyMember.findMany({
    where: { circleId, id: { notIn: excludeMemberIds } },
    select: { userId: true },
  });
  return members.map((m) => m.userId);
};

export const notifyCircle = async ({
  circleId,
  excludeMemberIds = [],
  title,
  body,
  data,
  type,
  socketEvent,
  socketData,
}: {
  circleId: string;
  excludeMemberIds?: string[];
  title?: string;
  body?: string;
  data?: object;
  type?: PushNotificationType;
  socketEvent?: SocketEvent;
  socketData?: any;
}) => {
  const userIds = await getCircleUserIds(circleId, excludeMemberIds);
  if (userIds.length === 0) return;

  if (socketEvent) {
    sendSocketEventToUsers({
      userIds,
      event: socketEvent,
      data: socketData ?? data ?? {},
    });
  }

  if (title && body && type) {
    await Promise.allSettled(
      userIds.map((userId) =>
        sendPushNotificationToUser({
          userId,
          title,
          body,
          data: data ?? {},
          type,
        }),
      ),
    );
  }
};

// ---------------------------------------------------------------------------
// Circle CRUD
// ---------------------------------------------------------------------------

// Seat model (locked spec): ALRT+ grants 8 seats spendable across up to 4
// owned circles. A seat is a (person, circle) pair in a circle you own —
// the same person in two of your circles uses two seats. Joining someone
// else's circle consumes nothing of your own.
const MAX_OWNED_CIRCLES = 4;
const MAX_SEATS_TOTAL = 8;

/** Seats used across every circle the user owns (each membership row = 1). */
export const countOwnedSeats = async (ownerUserId: string) => {
  return prisma.familyMember.count({
    where: { circle: { createdById: ownerUserId } },
  });
};

export const createCircle = async (userId: string, name: string) => {
  const ownedCircles = await prisma.familyCircle.count({
    where: { createdById: userId },
  });
  if (ownedCircles >= MAX_OWNED_CIRCLES) {
    throw new HttpError(
      400,
      `You can own up to ${MAX_OWNED_CIRCLES} circles on your plan`,
    );
  }

  // The creator's own membership in the new circle consumes a seat.
  const seatsUsed = await countOwnedSeats(userId);
  if (seatsUsed >= MAX_SEATS_TOTAL) {
    throw new HttpError(
      400,
      `All ${MAX_SEATS_TOTAL} seats on your plan are in use. Remove a member or delete a circle first.`,
    );
  }

  return prisma.familyCircle.create({
    data: {
      name,
      createdById: userId,
      maxMembers: DEFAULT_MAX_MEMBERS,
      members: {
        create: { userId, role: "owner" },
      },
    },
    include: { members: true },
  });
};

/** The user's circles with their role and member counts, oldest first. */
export const listCirclesForUser = async (userId: string) => {
  const memberships = await prisma.familyMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    include: {
      circle: { include: { _count: { select: { members: true } } } },
    },
  });

  return memberships.map((membership) => ({
    circleId: membership.circleId,
    name: membership.circle.name,
    plan: membership.circle.plan,
    themeColor: membership.circle.themeColor,
    role: membership.role,
    myMemberId: membership.id,
    memberCount: membership.circle._count.members,
    isOwned: membership.circle.createdById === userId,
    joinedAt: membership.createdAt,
  }));
};

/** Full circle payload for the family hub screen. */
export const getCircleForUser = async (userId: string, circleId?: string) => {
  const membership = await getMembershipForUser(userId, circleId);
  if (!membership) return null;

  const circle = await prisma.familyCircle.findUnique({
    where: { id: membership.circleId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, name: true, profilePictureUrl: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      places: {
        include: { notificationPrefs: true },
        orderBy: { createdAt: "asc" },
      },
      sosEvents: {
        where: { status: "active" },
        include: { responses: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!circle) return null;

  const latestRequest = await prisma.familyCheckInRequest.findFirst({
    where: { circleId: circle.id },
    orderBy: { createdAt: "desc" },
    include: { checkIns: { select: { memberId: true } } },
  });

  return {
    id: circle.id,
    name: circle.name,
    plan: circle.plan,
    maxMembers: circle.maxMembers,
    myMemberId: membership.id,
    members: circle.members.map((m) =>
      serializeMember(m, { forSelf: m.userId === userId }),
    ),
    places: circle.places,
    activeSosEvents: circle.sosEvents,
    latestCheckInRequest: latestRequest,
    createdAt: circle.createdAt,
  };
};

export const updateCircle = async (
  userId: string,
  input: { name?: string | undefined; themeColor?: string | null | undefined },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  if (membership.role !== "owner") {
    throw new HttpError(403, "Only the circle owner can edit the circle");
  }
  const circle = await prisma.familyCircle.update({
    where: { id: membership.circleId },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.themeColor !== undefined && { themeColor: input.themeColor }),
    },
  });
  await notifyCircle({
    circleId: circle.id,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: circle.id },
  });
  return circle;
};

export const deleteCircle = async (userId: string, circleId?: string) => {
  const membership = await requireMembership(userId, circleId);
  if (membership.role !== "owner") {
    throw new HttpError(403, "Only the circle owner can delete the circle");
  }
  const userIds = await getCircleUserIds(membership.circleId);
  await prisma.familyCircle.delete({ where: { id: membership.circleId } });
  sendSocketEventToUsers({
    userIds,
    event: SocketEvent.familyCircleUpdate,
    data: { circleId: membership.circleId, deleted: true },
  });
};

export const leaveCircle = async (userId: string, circleId?: string) => {
  const membership = await requireMembership(userId, circleId);

  if (membership.role === "owner") {
    const otherMembers = await prisma.familyMember.count({
      where: { circleId: membership.circleId, id: { not: membership.id } },
    });
    if (otherMembers > 0) {
      throw new HttpError(
        400,
        "Transfer ownership or remove other members before leaving, or delete the circle.",
      );
    }
    await prisma.familyCircle.delete({ where: { id: membership.circleId } });
    return;
  }

  await prisma.familyMember.delete({ where: { id: membership.id } });
  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });
};

export const removeMember = async (userId: string, memberId: string) => {
  // Anchor on the target so the right circle's ownership is checked even
  // when the caller belongs to several circles.
  const target = await prisma.familyMember.findUnique({
    where: { id: memberId },
  });
  if (!target) {
    throw new HttpError(404, "Member not found in your circle");
  }

  const membership = await requireMembership(userId, target.circleId);
  if (membership.role !== "owner") {
    throw new HttpError(403, "Only the circle owner can remove members");
  }
  if (membership.id === memberId) {
    throw new HttpError(400, "Use leave/delete instead of removing yourself");
  }

  await prisma.familyMember.delete({ where: { id: target.id } });

  sendSocketEventToUsers({
    userIds: [target.userId],
    event: SocketEvent.familyCircleUpdate,
    data: { circleId: membership.circleId, removed: true },
  });
  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });
};

export const updateOwnMember = async (
  userId: string,
  input: {
    nickname?: string | undefined;
    sharingLevel?: FamilySharingLevel | undefined;
    colorHex?: string | null | undefined;
  },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);

  const data: Record<string, unknown> = {};
  if (input.nickname !== undefined) data.nickname = input.nickname;
  if (input.colorHex !== undefined) data.colorHex = input.colorHex;
  if (input.sharingLevel !== undefined) {
    data.sharingLevel = input.sharingLevel;
    // Turning sharing off clears the stored live location immediately.
    if (input.sharingLevel === "off") {
      data.latitude = null;
      data.longitude = null;
      data.locationLabel = null;
      data.locationUpdatedAt = null;
      data.batteryLevel = null;
      data.isMoving = false;
      data.currentPlaceId = null;
    }
  }

  const updated = await prisma.familyMember.update({
    where: { id: membership.id },
    data,
  });

  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });

  return updated;
};

/** Stores an uploaded circle photo for the calling member. */
export const updateOwnMemberPhoto = async (
  userId: string,
  photoUrl: string,
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  const previous = membership.photoUrl;

  const updated = await prisma.familyMember.update({
    where: { id: membership.id },
    data: { photoUrl },
  });

  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });

  return { updated, previousPhotoUrl: previous };
};

// ---------------------------------------------------------------------------
// Invites
// ---------------------------------------------------------------------------

const generateInviteCode = (): string => {
  let code = "";
  const bytes = crypto.randomBytes(5);
  for (const b of bytes) {
    code += INVITE_CODE_ALPHABET[b % INVITE_CODE_ALPHABET.length];
  }
  return `ALRT-${code}`;
};

export const createInvite = async (userId: string, circleId?: string) => {
  const membership = await requireMembership(userId, circleId);
  if (membership.role === "child") {
    throw new HttpError(403, "Children cannot create invites");
  }

  // Retry on the (unlikely) unique-code collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.familyInvite.create({
        data: {
          circleId: membership.circleId,
          code: generateInviteCode(),
          createdById: membership.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
    } catch (error: any) {
      if (error?.code !== "P2002") throw error;
    }
  }
  throw new HttpError(500, "Could not generate an invite code. Try again.");
};

export const listInvites = async (userId: string, circleId?: string) => {
  const membership = await requireMembership(userId, circleId);
  return prisma.familyInvite.findMany({
    where: {
      circleId: membership.circleId,
      isRevoked: false,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });
};

export const revokeInvite = async (userId: string, inviteId: string) => {
  const invite = await prisma.familyInvite.findUnique({
    where: { id: inviteId },
  });
  if (!invite) throw new HttpError(404, "Invite not found");

  const membership = await requireMembership(userId, invite.circleId);
  if (membership.role === "child") {
    throw new HttpError(403, "Children cannot revoke invites");
  }
  return prisma.familyInvite.update({
    where: { id: invite.id },
    data: { isRevoked: true },
  });
};

export const joinCircleWithCode = async (userId: string, code: string) => {
  const invite = await prisma.familyInvite.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: { circle: { include: { members: true } } },
  });

  if (
    !invite ||
    invite.isRevoked ||
    (invite.expiresAt && invite.expiresAt < new Date()) ||
    invite.useCount >= invite.maxUses
  ) {
    throw new HttpError(404, "This invite code is invalid or has expired");
  }

  if (invite.circle.members.length >= invite.circle.maxMembers) {
    throw new HttpError(400, "This family circle is full");
  }

  if (invite.circle.members.some((m) => m.userId === userId)) {
    throw new HttpError(400, "You are already a member of this circle");
  }

  // Joining consumes a seat on the OWNER's plan, never the joiner's.
  const ownerSeatsUsed = await countOwnedSeats(invite.circle.createdById);
  if (ownerSeatsUsed >= MAX_SEATS_TOTAL) {
    throw new HttpError(
      400,
      "This circle's plan has no free seats. Ask the owner to free one up.",
    );
  }

  const [member] = await prisma.$transaction([
    prisma.familyMember.create({
      data: { circleId: invite.circleId, userId, role: "adult" },
      include: {
        user: { select: { id: true, name: true, profilePictureUrl: true } },
      },
    }),
    prisma.familyInvite.update({
      where: { id: invite.id },
      data: { useCount: { increment: 1 } },
    }),
  ]);

  await notifyCircle({
    circleId: invite.circleId,
    excludeMemberIds: [member!.id],
    title: invite.circle.name,
    body: `${member!.user.name || "A new member"} joined your family circle`,
    data: { circleId: invite.circleId },
    type: PushNotificationType.familyCircleUpdate,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: invite.circleId },
  });

  return member!;
};

// ---------------------------------------------------------------------------
// Check-ins
// ---------------------------------------------------------------------------

export const createCheckIn = async (
  userId: string,
  input: {
    status?: FamilyCheckInStatus | undefined;
    message?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    requestId?: string | undefined;
    hazardId?: string | undefined;
  },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  const status: FamilyCheckInStatus = input.status ?? "safe";

  const checkIn = await prisma.$transaction(async (tx) => {
    const created = await tx.familyCheckIn.create({
      data: {
        circleId: membership.circleId,
        memberId: membership.id,
        status,
        ...(input.message && { message: input.message }),
        ...(input.latitude !== undefined && { latitude: input.latitude }),
        ...(input.longitude !== undefined && { longitude: input.longitude }),
        ...(input.requestId && { requestId: input.requestId }),
        ...(input.hazardId && { hazardId: input.hazardId }),
      },
      include: {
        member: {
          include: {
            user: { select: { id: true, name: true, profilePictureUrl: true } },
          },
        },
      },
    });
    await tx.familyMember.update({
      where: { id: membership.id },
      data: { lastCheckInAt: created.createdAt },
    });
    return created;
  });

  // Checking in counts as daily activity for the streak (no XP awarded —
  // safety actions never earn points, streaks only gate the report bonus).
  touchActivityStreak(userId).catch((error) =>
    console.error("Streak touch failed on check-in:", error),
  );

  const memberName =
    checkIn.member.nickname || checkIn.member.user.name || "A family member";
  const isSafe = status === "safe";

  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    title: isSafe ? `${memberName} is safe` : `${memberName} needs help`,
    body: input.message || (isSafe ? "Checked in safe" : "Reach out now"),
    data: { circleId: membership.circleId, checkInId: checkIn.id },
    type: PushNotificationType.familyCheckIn,
    socketEvent: SocketEvent.familyCheckIn,
    socketData: checkIn,
  });

  return checkIn;
};

export const requestCheckIn = async (
  userId: string,
  input: { message?: string | undefined; hazardId?: string | undefined },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);

  const request = await prisma.familyCheckInRequest.create({
    data: {
      circleId: membership.circleId,
      requestedById: membership.id,
      ...(input.message && { message: input.message }),
      ...(input.hazardId && { hazardId: input.hazardId }),
    },
    include: {
      requestedBy: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
    },
  });

  const requesterName =
    request.requestedBy.nickname ||
    request.requestedBy.user.name ||
    "A family member";

  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    title: "Check-in requested",
    body:
      input.message || `${requesterName} asked everyone to check in. Are you safe?`,
    data: { circleId: membership.circleId, requestId: request.id },
    type: PushNotificationType.familyCheckInRequest,
    socketEvent: SocketEvent.familyCheckInRequest,
    socketData: request,
  });

  return request;
};

export const listRecentCheckIns = async (
  userId: string,
  limit = 30,
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  return prisma.familyCheckIn.findMany({
    where: { circleId: membership.circleId },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
    },
  });
};

// ---------------------------------------------------------------------------
// Scheduled check-ins — a member's daily "are you safe?" routine.
// timeOfDay is Australia/Brisbane local time (fixed UTC+10, no DST in QLD).
// ---------------------------------------------------------------------------

const BRISBANE_UTC_OFFSET_MS = 10 * 60 * 60 * 1000;
const MAX_SCHEDULED_CHECK_INS_PER_MEMBER = 3;

const scheduledCheckInInclude = {
  member: {
    include: {
      user: { select: { id: true, name: true, profilePictureUrl: true } },
    },
  },
} as const;

export const createScheduledCheckIn = async (
  userId: string,
  input: { timeOfDay: string; mode?: FamilyScheduledCheckInMode | undefined },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);

  const count = await prisma.familyScheduledCheckIn.count({
    where: { memberId: membership.id },
  });
  if (count >= MAX_SCHEDULED_CHECK_INS_PER_MEMBER) {
    throw new HttpError(
      400,
      `You can have at most ${MAX_SCHEDULED_CHECK_INS_PER_MEMBER} scheduled check-ins`,
    );
  }

  return prisma.familyScheduledCheckIn.upsert({
    where: {
      memberId_timeOfDay: {
        memberId: membership.id,
        timeOfDay: input.timeOfDay,
      },
    },
    create: {
      circleId: membership.circleId,
      memberId: membership.id,
      timeOfDay: input.timeOfDay,
      mode: input.mode ?? "prompted",
    },
    update: { mode: input.mode ?? "prompted" },
    include: scheduledCheckInInclude,
  });
};

export const listScheduledCheckIns = async (
  userId: string,
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  return prisma.familyScheduledCheckIn.findMany({
    where: { circleId: membership.circleId },
    orderBy: { timeOfDay: "asc" },
    include: scheduledCheckInInclude,
  });
};

export const deleteScheduledCheckIn = async (
  userId: string,
  scheduledCheckInId: string,
) => {
  const schedule = await prisma.familyScheduledCheckIn.findUnique({
    where: { id: scheduledCheckInId },
  });
  if (!schedule) {
    throw new HttpError(404, "Scheduled check-in not found");
  }
  const membership = await requireMembership(userId, schedule.circleId);
  if (schedule.memberId !== membership.id && membership.role !== "owner") {
    throw new HttpError(
      403,
      "Only the member or the circle owner can remove this schedule",
    );
  }
  await prisma.familyScheduledCheckIn.delete({
    where: { id: scheduledCheckInId },
  });
  return { deleted: true };
};

/**
 * Fires every schedule whose timeOfDay matches the current Brisbane minute
 * and hasn't fired yet today. Called by the scheduler once a minute.
 */
export const fireDueScheduledCheckIns = async () => {
  const now = new Date();
  const brisbaneNow = new Date(now.getTime() + BRISBANE_UTC_OFFSET_MS);
  const hhmm = `${String(brisbaneNow.getUTCHours()).padStart(2, "0")}:${String(
    brisbaneNow.getUTCMinutes(),
  ).padStart(2, "0")}`;

  const brisbaneDayStart = new Date(brisbaneNow);
  brisbaneDayStart.setUTCHours(0, 0, 0, 0);
  const dayStartUtc = new Date(
    brisbaneDayStart.getTime() - BRISBANE_UTC_OFFSET_MS,
  );

  const due = await prisma.familyScheduledCheckIn.findMany({
    where: {
      timeOfDay: hhmm,
      OR: [{ lastFiredAt: null }, { lastFiredAt: { lt: dayStartUtc } }],
    },
    include: scheduledCheckInInclude,
  });

  for (const schedule of due) {
    // Claim the schedule first so a crash mid-fire can't double-notify.
    await prisma.familyScheduledCheckIn.update({
      where: { id: schedule.id },
      data: { lastFiredAt: now },
    });

    try {
      if (schedule.mode === "automatic") {
        // Post a "safe" check-in on the member's behalf, reusing the normal
        // check-in flow (circle notification, streak touch, lastCheckInAt).
        // Scoped to the schedule's own circle, not the member's first one.
        await createCheckIn(
          schedule.member.userId,
          { status: "safe", message: "Scheduled check-in" },
          schedule.circleId,
        );
      } else {
        await sendPushNotificationToUser({
          userId: schedule.member.userId,
          title: "Daily check-in",
          body: "Time for your check-in — let your family know you're safe.",
          data: {
            circleId: schedule.circleId,
            scheduledCheckInId: schedule.id,
          },
          type: PushNotificationType.familyScheduledCheckInPrompt,
        });
      }
    } catch (error) {
      console.error(
        `Scheduled check-in ${schedule.id} failed to fire:`,
        error,
      );
    }
  }

  return due.length;
};

// ---------------------------------------------------------------------------
// Saved places
// ---------------------------------------------------------------------------

export const listPlaces = async (userId: string, circleId?: string) => {
  const membership = await requireMembership(userId, circleId);
  return prisma.familySavedPlace.findMany({
    where: { circleId: membership.circleId },
    include: { notificationPrefs: true },
    orderBy: { createdAt: "asc" },
  });
};

export const createPlace = async (
  userId: string,
  input: {
    name: string;
    icon?: FamilyPlaceIcon | undefined;
    latitude: number;
    longitude: number;
    radiusMeters?: number | undefined;
    address?: string | undefined;
  },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);
  if (membership.role === "child") {
    throw new HttpError(403, "Children cannot manage places");
  }

  const place = await prisma.familySavedPlace.create({
    data: {
      circleId: membership.circleId,
      name: input.name,
      icon: input.icon ?? "other",
      latitude: input.latitude,
      longitude: input.longitude,
      radiusMeters: input.radiusMeters ?? 300,
      ...(input.address && { address: input.address }),
      createdById: membership.id,
    },
    include: { notificationPrefs: true },
  });

  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });

  return place;
};

export const updatePlace = async (
  userId: string,
  placeId: string,
  input: {
    name?: string | undefined;
    icon?: FamilyPlaceIcon | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    radiusMeters?: number | undefined;
    address?: string | undefined;
  },
) => {
  const place = await prisma.familySavedPlace.findUnique({
    where: { id: placeId },
  });
  if (!place) throw new HttpError(404, "Place not found");

  const membership = await requireMembership(userId, place.circleId);
  if (membership.role === "child") {
    throw new HttpError(403, "Children cannot manage places");
  }

  const updated = await prisma.familySavedPlace.update({
    where: { id: place.id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.icon !== undefined && { icon: input.icon }),
      ...(input.latitude !== undefined && { latitude: input.latitude }),
      ...(input.longitude !== undefined && { longitude: input.longitude }),
      ...(input.radiusMeters !== undefined && {
        radiusMeters: input.radiusMeters,
      }),
      ...(input.address !== undefined && { address: input.address }),
    },
    include: { notificationPrefs: true },
  });

  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });

  return updated;
};

export const deletePlace = async (userId: string, placeId: string) => {
  const place = await prisma.familySavedPlace.findUnique({
    where: { id: placeId },
  });
  if (!place) throw new HttpError(404, "Place not found");

  const membership = await requireMembership(userId, place.circleId);
  if (membership.role === "child") {
    throw new HttpError(403, "Children cannot manage places");
  }

  await prisma.familySavedPlace.delete({ where: { id: place.id } });
  await notifyCircle({
    circleId: membership.circleId,
    socketEvent: SocketEvent.familyCircleUpdate,
    socketData: { circleId: membership.circleId },
  });
};

export const updatePlaceNotificationPref = async (
  userId: string,
  placeId: string,
  input: {
    subjectMemberId: string;
    notifyArrivals: boolean;
    notifyDepartures: boolean;
  },
) => {
  const place = await prisma.familySavedPlace.findUnique({
    where: { id: placeId },
  });
  if (!place) throw new HttpError(404, "Place not found");

  const membership = await requireMembership(userId, place.circleId);

  const subject = await prisma.familyMember.findFirst({
    where: { id: input.subjectMemberId, circleId: membership.circleId },
  });
  if (!subject) throw new HttpError(404, "Member not found in your circle");

  return prisma.familyPlaceNotificationPref.upsert({
    where: {
      placeId_subjectMemberId: {
        placeId: place.id,
        subjectMemberId: subject.id,
      },
    },
    create: {
      placeId: place.id,
      subjectMemberId: subject.id,
      notifyArrivals: input.notifyArrivals,
      notifyDepartures: input.notifyDepartures,
    },
    update: {
      notifyArrivals: input.notifyArrivals,
      notifyDepartures: input.notifyDepartures,
    },
  });
};

// ---------------------------------------------------------------------------
// SOS
// ---------------------------------------------------------------------------

export const triggerSos = async (
  userId: string,
  input: { latitude?: number | undefined; longitude?: number | undefined },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);

  // A member has at most one active SOS: cancel any previous one first.
  await prisma.familySosEvent.updateMany({
    where: { memberId: membership.id, status: "active" },
    data: { status: "cancelled", resolvedAt: new Date() },
  });

  const latitude = input.latitude ?? membership.latitude ?? null;
  const longitude = input.longitude ?? membership.longitude ?? null;

  const sos = await prisma.familySosEvent.create({
    data: {
      circleId: membership.circleId,
      memberId: membership.id,
      ...(latitude !== null && { latitude }),
      ...(longitude !== null && { longitude }),
      ...(membership.locationLabel && {
        locationLabel: membership.locationLabel,
      }),
    },
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
      responses: true,
    },
  });

  const memberName =
    sos.member.nickname || sos.member.user.name || "A family member";

  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    title: `🆘 ${memberName} triggered SOS`,
    body: sos.locationLabel
      ? `Live location shared near ${sos.locationLabel}. Open to respond.`
      : "Live location shared. Open to respond.",
    data: { circleId: membership.circleId, sosEventId: sos.id },
    type: PushNotificationType.familySos,
    socketEvent: SocketEvent.familySos,
    socketData: sos,
  });

  return sos;
};

export const respondToSos = async (
  userId: string,
  sosEventId: string,
  type: FamilySosResponseType,
) => {
  const sos = await prisma.familySosEvent.findUnique({
    where: { id: sosEventId },
    include: {
      member: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });
  if (!sos) throw new HttpError(404, "SOS event not found");

  const membership = await requireMembership(userId, sos.circleId);
  if (sos.status !== "active") {
    throw new HttpError(400, "This SOS is no longer active");
  }
  if (sos.memberId === membership.id) {
    throw new HttpError(400, "You cannot respond to your own SOS");
  }

  const response = await prisma.familySosResponse.upsert({
    where: {
      sosEventId_memberId_type: {
        sosEventId: sos.id,
        memberId: membership.id,
        type,
      },
    },
    create: { sosEventId: sos.id, memberId: membership.id, type },
    update: {},
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
    },
  });

  const responderName =
    response.member.nickname ||
    response.member.user.name ||
    "A family member";
  const actionText =
    type === "onMyWay"
      ? `${responderName} is on their way`
      : type === "called"
        ? `${responderName} is calling for help`
        : `${responderName} has seen the SOS`;

  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    title: "SOS update",
    body: actionText,
    data: { circleId: membership.circleId, sosEventId: sos.id },
    type: PushNotificationType.familySosResponse,
    socketEvent: SocketEvent.familySosResponse,
    socketData: response,
  });

  return response;
};

export const resolveSos = async (userId: string, sosEventId: string) => {
  const sos = await prisma.familySosEvent.findUnique({
    where: { id: sosEventId },
    include: {
      member: { include: { user: { select: { id: true, name: true } } } },
    },
  });
  if (!sos) throw new HttpError(404, "SOS event not found");

  const membership = await requireMembership(userId, sos.circleId);
  if (sos.status !== "active") return sos;

  const canResolve = sos.memberId === membership.id || membership.role === "owner";
  if (!canResolve) {
    throw new HttpError(
      403,
      "Only the person who triggered the SOS or the circle owner can resolve it",
    );
  }

  const resolved = await prisma.familySosEvent.update({
    where: { id: sos.id },
    data: { status: "resolved", resolvedAt: new Date() },
  });

  const memberName =
    sos.member.nickname || sos.member.user.name || "A family member";

  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    title: "SOS resolved",
    body: `${memberName} is now marked safe`,
    data: { circleId: membership.circleId, sosEventId: sos.id },
    type: PushNotificationType.familySosResolved,
    socketEvent: SocketEvent.familySosResolved,
    socketData: resolved,
  });

  return resolved;
};

export const getActiveSos = async (userId: string, circleId?: string) => {
  const membership = await requireMembership(userId, circleId);
  return prisma.familySosEvent.findMany({
    where: { circleId: membership.circleId, status: "active" },
    include: {
      member: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
      responses: {
        include: {
          member: {
            include: {
              user: {
                select: { id: true, name: true, profilePictureUrl: true },
              },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};
