import type { FamilyMember, FamilySavedPlace, Hazard } from "@prisma/client";
import prisma from "../utils/prisma_client.util.js";
import { SocketEvent } from "../models/socket_event_types.js";
import { PushNotificationType } from "../models/push_notification_types.js";
import { convertLatLngToAddress } from "./google_map.service.js";
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

// ---------------------------------------------------------------------------
// Location ping processing
// ---------------------------------------------------------------------------

export const processLocationPing = async (
  userId: string,
  ping: {
    latitude: number;
    longitude: number;
    accuracy?: number | undefined;
    speed?: number | undefined;
    heading?: number | undefined;
    batteryLevel?: number | undefined;
    isMoving?: boolean | undefined;
  },
) => {
  const membership = await requireMembership(userId);

  // Members who turned sharing off are never tracked server-side.
  if (membership.sharingLevel === "off") {
    return { accepted: false, reason: "sharing is off" };
  }

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

  const [updatedMember] = await prisma.$transaction([
    prisma.familyMember.update({
      where: { id: membership.id },
      data: {
        latitude: ping.latitude,
        longitude: ping.longitude,
        ...(locationLabel && { locationLabel }),
        locationUpdatedAt: new Date(),
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

  // Live pin update for the rest of the circle (respects sharing level).
  await notifyCircle({
    circleId: membership.circleId,
    excludeMemberIds: [membership.id],
    socketEvent: SocketEvent.familyLocationUpdate,
    socketData: serializeMember(updatedMember!),
  });

  // Fire-and-forget: geofence transitions and hazard proximity must never
  // fail the ping itself.
  detectPlaceTransitions(updatedMember!).catch((error) =>
    console.error("Family place transition detection failed:", error),
  );
  checkMemberHazardProximity(updatedMember!).catch((error) =>
    console.error("Family hazard proximity check failed:", error),
  );

  return { accepted: true, member: serializeMember(updatedMember!, { forSelf: true }) };
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
