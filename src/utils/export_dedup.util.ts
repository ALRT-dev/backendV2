/**
 * Export-time deduplication of hazards that describe the same real-world
 * event but were ingested from different sources (e.g. the same fire from
 * RFS and BoM). Ingestion dedup is ID-based only, so cross-source
 * duplicates exist as independent rows; this collapses them in the
 * response without touching stored data.
 *
 * Two hazards are considered duplicates when they share a category, lie
 * within DUPLICATE_DISTANCE_KM of each other, and occurred within
 * DUPLICATE_WINDOW_MS. The thresholds mirror the proximity matching the
 * XP ledger already uses for report corroboration.
 */

const DUPLICATE_DISTANCE_KM = 1;
const DUPLICATE_WINDOW_MS = 12 * 60 * 60 * 1000;

const EARTH_RADIUS_KM = 6371;

const haversineKm = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
};

const eventTime = (h: any): number => {
  const t = h.occurredAt ?? h.createdAt;
  const date = t instanceof Date ? t : new Date(t);
  return isNaN(date.getTime()) ? 0 : date.getTime();
};

const severityBandRank: Record<string, number> = {
  critical: 4,
  action: 3,
  monitor: 2,
  info: 1,
};

/**
 * Preference order for which row survives a duplicate cluster:
 * official source over user report, then higher severity band, then most
 * recently updated.
 */
const preferHazard = (a: any, b: any): any => {
  const aOfficial = a.sourceId != null;
  const bOfficial = b.sourceId != null;
  if (aOfficial !== bOfficial) return aOfficial ? a : b;

  const aRank = severityBandRank[a.severityBand] ?? 0;
  const bRank = severityBandRank[b.severityBand] ?? 0;
  if (aRank !== bRank) return aRank > bRank ? a : b;

  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime()
    ? a
    : b;
};

/**
 * Collapses duplicate hazards within the given rows. The surviving row of
 * each cluster carries a `duplicateIds` array listing the collapsed ids so
 * consumers keep full traceability back to every source record.
 */
export function dedupeHazardsForExport(hazards: any[]): any[] {
  const clusters: { keeper: any; duplicateIds: string[] }[] = [];

  for (const hazard of hazards) {
    if (hazard.latitude == null || hazard.longitude == null) {
      clusters.push({ keeper: hazard, duplicateIds: [] });
      continue;
    }

    let matched = false;
    for (const cluster of clusters) {
      const keeper = cluster.keeper;
      if (keeper.categoryId !== hazard.categoryId) continue;
      if (keeper.latitude == null || keeper.longitude == null) continue;
      if (
        Math.abs(eventTime(keeper) - eventTime(hazard)) > DUPLICATE_WINDOW_MS
      ) {
        continue;
      }
      if (
        haversineKm(
          keeper.latitude,
          keeper.longitude,
          hazard.latitude,
          hazard.longitude,
        ) > DUPLICATE_DISTANCE_KM
      ) {
        continue;
      }

      const preferred = preferHazard(keeper, hazard);
      const dropped = preferred === keeper ? hazard : keeper;
      cluster.keeper = preferred;
      cluster.duplicateIds.push(dropped.id);
      matched = true;
      break;
    }

    if (!matched) {
      clusters.push({ keeper: hazard, duplicateIds: [] });
    }
  }

  return clusters.map(({ keeper, duplicateIds }) =>
    duplicateIds.length > 0 ? { ...keeper, duplicateIds } : keeper,
  );
}
