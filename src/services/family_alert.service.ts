import type {
  FamilyMember,
  FamilySavedPlace,
  FamilySnapshotSource,
  Hazard,
} from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { HttpError } from "../models/http_error.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import { convertLatLngToAddress } from "./google_map.service.js";
import { sendPushNotificationToUser } from "./notification.service.js";
import {
  haversineKm,
  notifyCircle,
  requireMembership,
  serializeMember,
  toSuburbLabel,
} from "./family.service.js";

/**
 * Hazards this severe (or worse) trigger family proximity alerts.
 * Advice-level noise is deliberately excluded — the family layer is for
 * "someone you love is near something serious", not every roadwork notice.
 */
const PROXIMITY_SEVERITY_BANDS = ["action", "critical"] as const;
const MEMBER_PROXIMITY_KM = 5; // member-to-hazard alert radius
const PLACE_PROXIMITY_KM = 10; // saved-place-to-hazard alert radius

/** Re-geocode the member's suburb label after moving this far. */
const RELABEL_DISTANCE_KM = 1;

/** Exit hysteresis so members sitting on a geofence edge don't flap. */
const EXIT_RADIUS_MULTIPLIER = 1.5;
const EXIT_RADIUS_PADDING_M = 50;

/**
 * How long a shared snapshot stays visible and matchable. ALRT never
 * live-tracks: snapshots are deliberate member actions and they expire.
 */
const SNAPSHOT_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Location requests go stale if unanswered. */
const LOCATION_REQUEST_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// ---------------------------------------------------------------------------
// Snapshot sharing — the ONLY way a member's location is ever written.
// Called when the member checks in, answers a location request, triggers
// SOS, or explicitly re-shares. Never on a timer.
// ---------------------------------------------------------------------------

export const shareLocationSnapshot = async (
  userId: string,
  snapshot: {
    latitude: number;
    longitude: number;
    accuracy?: number | undefined;
    speed?: number | undefined;
    heading?: number | undefined;
    batteryLevel?: number | undefined;
    isMoving?: boolean | undefined;
    via?: FamilySnapshotSource | undefined;
  },
  circleId?: string,
) => {
  const membership = await requireMembership(userId, circleId);

  // Members who turned sharing off never share, even via other actions.
  if (membership.sharingLevel === "off") {
    return { accepted: false, reason: "sharing is off" };
  }

  const ping = snapshot;

  // Refresh the suburb label only after meaningful movement — reverse
  // geocoding every ping would be slow and expensive.
  let locationLabel = membership.locationLabel;
  const movedKm =
    membership.latitude != null && membership.longitude != null
      ? haversineKm(
          membership.latitude,
          membership.longitude,
          ping.latitude,
          ping.longitude,
        )
      : Infinity;
  if (!locationLabel || movedKm >= RELABEL_DISTANCE_KM) {
    try {
      const address = await convertLatLngToAddress(
        ping.latitude,
        ping.longitude,
      );
      if (address) locationLabel = toSuburbLabel(address);
    } catch {
      // Keep the previous label; a stale suburb is better than a failed ping.
    }
  }

  const now = new Date();
  const [updatedMember] = await prisma.$transaction([
    prisma.familyMember.update({
      where: { id: membership.id },
      data: {
        latitude: ping.latitude,
        longitude: ping.longitude,
        ...(locationLabel && { locationLabel }),
        locationUpdatedAt: now,
        locationExpiresAt: new Date(now.getTime() + SNAPSHOT_TTL_MS),
        locationSharedVia: snapshot.via ?? "manual",
        ...(ping.batteryLevel !== undefined && {
          batteryLevel: ping.batteryLevel,
        }),
        isMoving: ping.isMoving ?? false,
      },
      include: {
        user: { select: { id: true, name: true, profilePictureUrl: true } },
      },
    }),
    prisma.familyLocationPing.create({
      data: {
        memberId: membership.id,
        latitude: ping.latitude,
        longitude: ping.longitude,
        ...(ping.accuracy !== undefined && { accuracy: ping.accuracy }),
        ...(ping.speed !== undefined && { speed: ping.speed }),
        ...(ping.heading !== undefined && { heading: ping.heading }),
        ...(ping.batteryLevel !== undefined && {
          batteryLevel: ping.batteryLevel,
        }),
        isMoving: ping.isMoving ?? false,
      },
    }),
  ]);

  // Snapshot update for the rest of the circle (respects sharing level).
  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    socketEvent: SocketEvent.familyLocationUpdate,
    socketData: serializeMember(updatedMember!),
  });

  // Fire-and-forget: place transitions and hazard proximity are computed on
  // snapshot write — never on a timer — and must never fail the share.
  detectPlaceTransitions(updatedMember!).catch((error) =>
    console.error("Family place transition detection failed:", error),
  );
  checkMemberHazardProximity(updatedMember!).catch((error) =>
    console.error("Family hazard proximity check failed:", error),
  );

  return { accepted: true, member: serializeMember(updatedMember!, { forSelf: true }) };
};

// ---------------------------------------------------------------------------
// Location requests — "Sarah asked where you are"
// ---------------------------------------------------------------------------

export const createLocationRequest = async (
  userId: string,
  targetMemberId: string,
) => {
  // Anchor on the target member so the request lands in the right circle
  // even when the requester belongs to several.
  const target = await prisma.familyMember.findUnique({
    where: { id: targetMemberId },
    include: { user: { select: { id: true, name: true } } },
  });
  if (!target) throw new HttpError(404, "Member not found in your circle");

  const membership = await requireMembership(userId, target.circleId);
  if (target.id === membership.id) {
    throw new HttpError(400, "You cannot request your own location");
  }
  if (target.sharingLevel === "off") {
    throw new HttpError(
      400,
      "This member has location sharing turned off",
    );
  }

  // Reuse an existing pending request instead of stacking duplicates.
  const existing = await prisma.familyLocationRequest.findFirst({
    where: {
      targetMemberId: target.id,
      requesterId: membership.id,
      status: "pending",
      expiresAt: { gt: new Date() },
    },
  });
  if (existing) return existing;

  const request = await prisma.familyLocationRequest.create({
    data: {
      circleId: membership.circleId,
      requesterId: membership.id,
      targetMemberId: target.id,
      expiresAt: new Date(Date.now() + LOCATION_REQUEST_TTL_MS),
    },
    include: {
      requester: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
    },
  });

  const requesterName =
    request.requester.nickname ||
    request.requester.user.name ||
    "A family member";

  // Only the target is notified. The push carries the request id so the app
  // can open the Share once / Not now screen.
  await sendPushNotificationToUser({
    userId: target.userId,
    title: `${requesterName} asked where you are`,
    body: "Share a one-time snapshot of your location? It expires after 1 hour.",
    data: {
      circleId: membership.circleId,
      locationRequestId: request.id,
      requesterName,
    },
    type: PushNotificationType.familyLocationRequest,
  });

  return request;
};

/** Pending location requests addressed to the calling user (any circle). */
export const getPendingLocationRequests = async (userId: string) => {
  await requireMembership(userId);
  return prisma.familyLocationRequest.findMany({
    where: {
      target: { userId },
      status: "pending",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
    include: {
      requester: {
        include: {
          user: { select: { id: true, name: true, profilePictureUrl: true } },
        },
      },
    },
  });
};

export const respondToLocationRequest = async (
  userId: string,
  requestId: string,
  response: {
    share: boolean;
    latitude?: number | undefined;
    longitude?: number | undefined;
  },
) => {
  // The request pins down which circle (and member row) is answering.
  const request = await prisma.familyLocationRequest.findFirst({
    where: { id: requestId, target: { userId } },
    include: {
      requester: { include: { user: { select: { id: true } } } },
      target: true,
    },
  });
  if (!request) throw new HttpError(404, "Location request not found");
  const membership = request.target;
  if (request.status !== "pending" || request.expiresAt < new Date()) {
    throw new HttpError(400, "This request is no longer active");
  }

  // Declining sends nothing — the requester is not notified.
  if (!response.share) {
    return prisma.familyLocationRequest.update({
      where: { id: request.id },
      data: { status: "declined", respondedAt: new Date() },
    });
  }

  if (response.latitude === undefined || response.longitude === undefined) {
    throw new HttpError(400, "Location is required to share a snapshot");
  }

  await shareLocationSnapshot(
    userId,
    {
      latitude: response.latitude,
      longitude: response.longitude,
      via: "request",
    },
    membership.circleId,
  );

  const updated = await prisma.familyLocationRequest.update({
    where: { id: request.id },
    data: { status: "shared", respondedAt: new Date() },
  });

  // Tell the requester their ask was answered.
  const targetName = membership.nickname || "A family member";
  await sendPushNotificationToUser({
    userId: request.requester.user.id,
    title: "Snapshot shared",
    body: `${targetName} shared a one-time location snapshot with the circle.`,
    data: { circleId: membership.circleId },
    type: PushNotificationType.familyLocationShared,
  });

  return updated;
};

// ---------------------------------------------------------------------------
// Saved place arrivals / departures
// ---------------------------------------------------------------------------

type MemberWithUser = FamilyMember & {
  user: { id: string; name: string | null; profilePictureUrl: string | null };
};

const memberDisplayName = (member: MemberWithUser) =>
  member.nickname || member.user.name || "A family member";

const detectPlaceTransitions = async (member: MemberWithUser) => {
  if (member.latitude == null || member.longitude == null) return;

  const places = await prisma.familySavedPlace.findMany({
    where: { circleId: member.circleId },
  });
  if (places.length === 0) return;

  const distanceToM = (place: FamilySavedPlace) =>
    haversineKm(member.latitude!, member.longitude!, place.latitude, place.longitude) *
    1000;

  // Innermost place the member is currently inside (if any).
  const containing = places
    .filter((p) => distanceToM(p) <= p.radiusMeters)
    .sort((a, b) => distanceToM(a) - distanceToM(b))[0];

  const previous = places.find((p) => p.id === member.currentPlaceId);

  // Hysteresis: only count as "left" once clearly outside the exit radius.
  if (previous && !containing) {
    const exitRadius =
      previous.radiusMeters * EXIT_RADIUS_MULTIPLIER + EXIT_RADIUS_PADDING_M;
    if (distanceToM(previous) <= exitRadius) return;
  }

  if (containing?.id === member.currentPlaceId) return;

  // Departure from the previous place
  if (previous && previous.id !== containing?.id) {
    await recordPlaceEvent(member, previous, "left");
  }
  // Arrival at the new place
  if (containing) {
    await recordPlaceEvent(member, containing, "arrived");
  }

  await prisma.familyMember.update({
    where: { id: member.id },
    data: { currentPlaceId: containing?.id ?? null },
  });
};

const recordPlaceEvent = async (
  member: MemberWithUser,
  place: FamilySavedPlace,
  type: "arrived" | "left",
) => {
  const event = await prisma.familyPlaceEvent.create({
    data: { placeId: place.id, memberId: member.id, type },
  });

  // Circle-wide toggle: "notify the family when <member> arrives/leaves".
  // No pref row means both notifications are on (model defaults).
  const pref = await prisma.familyPlaceNotificationPref.findUnique({
    where: {
      placeId_subjectMemberId: { placeId: place.id, subjectMemberId: member.id },
    },
  });
  const shouldNotify =
    type === "arrived"
      ? (pref?.notifyArrivals ?? true)
      : (pref?.notifyDepartures ?? true);

  const name = memberDisplayName(member);
  const verb = type === "arrived" ? "arrived at" : "left";

  await notifyCircle({
    circleId: member.circleId,
    excludeMemberIds: [member.id],
    ...(shouldNotify && {
      title: `${name} ${verb} ${place.name}`,
      body: place.address || place.name,
      type: PushNotificationType.familyPlaceEvent,
    }),
    data: {
      circleId: member.circleId,
      placeId: place.id,
      memberId: member.id,
      eventType: type,
    },
    socketEvent: SocketEvent.familyPlaceEvent,
    socketData: {
      ...event,
      placeName: place.name,
      memberName: name,
    },
  });
};

// ---------------------------------------------------------------------------
// Hazard proximity — member moved near an existing hazard
// ---------------------------------------------------------------------------

const activeSeriousHazardsWhere = {
  reviewStatus: "accepted" as const,
  severityBand: { in: [...PROXIMITY_SEVERITY_BANDS] },
  OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
  latitude: { not: null },
  longitude: { not: null },
};

const checkMemberHazardProximity = async (member: MemberWithUser) => {
  if (member.latitude == null || member.longitude == null) return;

  // Pre-filter with a ~. degree box before exact distance math.
  const degreePadding = MEMBER_PROXIMITY_KM / 111 + 0.02;
  const hazards = await prisma.hazard.findMany({
    where: {
      ...activeSeriousHazardsWhere,
      latitude: {
        gte: member.latitude - degreePadding,
        lte: member.latitude + degreePadding,
      },
      longitude: {
        gte: member.longitude - degreePadding,
        lte: member.longitude + degreePadding,
      },
    },
    take: 25,
  });

  for (const hazard of hazards) {
    const distanceKm = haversineKm(
      member.latitude,
      member.longitude,
      hazard.latitude!,
      hazard.longitude!,
    );
    if (distanceKm > MEMBER_PROXIMITY_KM) continue;
    await flagMemberNearHazard(member, hazard, distanceKm);
  }
};

/**
 * Flags a member as near a hazard and alerts the circle — at most once per
 * member+hazard pair (FamilyMemberHazardAlert unique constraint).
 */
const flagMemberNearHazard = async (
  member: MemberWithUser,
  hazard: Hazard,
  distanceKm: number,
) => {
  try {
    await prisma.familyMemberHazardAlert.create({
      data: { memberId: member.id, hazardId: hazard.id, distanceKm },
    });
  } catch (error: any) {
    if (error?.code === "P2002") return; // already flagged for this hazard
    throw error;
  }

  const name = memberDisplayName(member);
  const severityLabel =
    hazard.severity === "emergency"
      ? "Emergency Warning"
      : hazard.severity === "watchAndAct"
        ? "Watch and Act"
        : "Alert";

  await notifyCircle({
    circleId: member.circleId,
    title: `${severityLabel} near ${name}`,
    body: `${hazard.title} — ${distanceKm.toFixed(1)} km from ${name}'s location`,
    data: {
      circleId: member.circleId,
      memberId: member.id,
      payload: JSON.stringify(hazard),
      distanceKm: String(distanceKm),
    },
    type: PushNotificationType.familyHazardProximity,
    socketEvent: SocketEvent.familyHazardProximity,
    socketData: {
      memberId: member.id,
      memberName: name,
      hazardId: hazard.id,
      distanceKm,
      hazard,
    },
  });
};

// ---------------------------------------------------------------------------
// Hazard-side hook — a new hazard appeared near members / saved places
// ---------------------------------------------------------------------------

/**
 * Called when a serious hazard is created (ingestion + user reports).
 * Notifies circles when the hazard is near a member's live location
 * ("Emergency Warning near Emma") or near a saved place
 * ("Watch and Act issued 4 km from Home").
 */
export const notifyFamiliesAboutNewHazard = async (hazard: Hazard) => {
  try {
    if (
      hazard.latitude == null ||
      hazard.longitude == null ||
      hazard.reviewStatus !== "accepted" ||
      !PROXIMITY_SEVERITY_BANDS.includes(hazard.severityBand as any)
    ) {
      return;
    }

    // --- Members near the hazard -----------------------------------------
    const memberPadding = MEMBER_PROXIMITY_KM / 111 + 0.02;
    const nearbyMembers = await prisma.familyMember.findMany({
      where: {
        sharingLevel: { in: ["precise", "approximate", "alertsOnly"] },
        // Only match unexpired snapshots — an hour-old share is honest to
        // flag ("snapshot 12 min ago was 1.1 km from..."), a stale one isn't.
        locationExpiresAt: { gt: new Date() },
        latitude: {
          gte: hazard.latitude - memberPadding,
          lte: hazard.latitude + memberPadding,
        },
        longitude: {
          gte: hazard.longitude - memberPadding,
          lte: hazard.longitude + memberPadding,
        },
      },
      include: {
        user: { select: { id: true, name: true, profilePictureUrl: true } },
      },
      take: 200,
    });

    for (const member of nearbyMembers) {
      const distanceKm = haversineKm(
        member.latitude!,
        member.longitude!,
        hazard.latitude,
        hazard.longitude,
      );
      if (distanceKm > MEMBER_PROXIMITY_KM) continue;
      await flagMemberNearHazard(member, hazard, distanceKm);
    }

    // --- Saved places near the hazard -------------------------------------
    const placePadding = PLACE_PROXIMITY_KM / 111 + 0.02;
    const nearbyPlaces = await prisma.familySavedPlace.findMany({
      where: {
        latitude: {
          gte: hazard.latitude - placePadding,
          lte: hazard.latitude + placePadding,
        },
        longitude: {
          gte: hazard.longitude - placePadding,
          lte: hazard.longitude + placePadding,
        },
      },
      take: 200,
    });

    const severityLabel =
      hazard.severity === "emergency"
        ? "Emergency Warning"
        : hazard.severity === "watchAndAct"
          ? "Watch and Act"
          : "Alert";

    for (const place of nearbyPlaces) {
      const distanceKm = haversineKm(
        place.latitude,
        place.longitude,
        hazard.latitude,
        hazard.longitude,
      );
      if (distanceKm > PLACE_PROXIMITY_KM) continue;

      await notifyCircle({
        circleId: place.circleId,
        title: `${severityLabel} issued ${distanceKm < 1 ? "less than 1" : Math.round(distanceKm)} km from ${place.name}`,
        body: `${hazard.title}${hazard.locationName ? ` · ${hazard.locationName}` : ""}`,
        data: {
          circleId: place.circleId,
          placeId: place.id,
          payload: JSON.stringify(hazard),
        },
        type: PushNotificationType.familyHazardProximity,
        socketEvent: SocketEvent.familyHazardProximity,
        socketData: {
          placeId: place.id,
          placeName: place.name,
          hazardId: hazard.id,
          distanceKm,
          hazard,
        },
      });
    }
  } catch (error) {
    console.error("notifyFamiliesAboutNewHazard failed:", error);
  }
};

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

/** Prunes location-ping history older than 24h. Run daily. */
export const pruneFamilyLocationPings = async () => {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const result = await prisma.familyLocationPing.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  if (result.count > 0) {
    console.log(`Pruned ${result.count} family location pings older than 24h`);
  }
};
