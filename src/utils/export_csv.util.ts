/**
 * CSV serialization for hazard exports.
 *
 * Serves the same rows as the GeoJSON feed so both formats share one query
 * path. Values are RFC 4180 escaped, and cells that could be interpreted as
 * spreadsheet formulas are prefixed to prevent CSV injection when the file
 * is opened in Excel/Sheets.
 */

const CSV_COLUMNS: { header: string; get: (h: any) => unknown }[] = [
  { header: "id", get: (h) => h.id },
  { header: "title", get: (h) => h.title },
  { header: "description", get: (h) => h.description },
  { header: "aiSummary", get: (h) => h.aiSummary },
  { header: "callsToAction", get: (h) => (h.callsToAction ?? []).join(" | ") },
  { header: "severity", get: (h) => h.severity },
  { header: "severityBand", get: (h) => h.severityBand },
  { header: "isAwsCompliant", get: (h) => h.isAwsCompliant },
  { header: "confidenceScore", get: (h) => h.confidenceScore },
  { header: "reviewStatus", get: (h) => h.reviewStatus },
  { header: "fireStatus", get: (h) => h.fireStatus },
  { header: "categoryId", get: (h) => h.categoryId },
  { header: "categoryName", get: (h) => h.categoryName },
  { header: "latitude", get: (h) => h.latitude },
  { header: "longitude", get: (h) => h.longitude },
  { header: "locationName", get: (h) => h.locationName },
  { header: "sourceId", get: (h) => h.sourceId },
  { header: "sourceName", get: (h) => h.sourceName },
  { header: "sourceUrl", get: (h) => h.sourceUrl },
  { header: "sourceCopyrightText", get: (h) => h.sourceCopyrightText },
  { header: "sourceLicenseBadge", get: (h) => h.sourceLicenseBadge },
  { header: "sourceLicenseLink", get: (h) => h.sourceLicenseLink },
  { header: "duplicateIds", get: (h) => (h.duplicateIds ?? []).join(" | ") },
  { header: "occurredAt", get: (h) => toIso(h.occurredAt) },
  { header: "createdAt", get: (h) => toIso(h.createdAt) },
  { header: "updatedAt", get: (h) => toIso(h.updatedAt) },
  { header: "expiresAt", get: (h) => toIso(h.expiresAt) },
];

const toIso = (value: unknown): string | null => {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value as string);
  return isNaN(date.getTime()) ? null : date.toISOString();
};

const escapeCsvCell = (value: unknown): string => {
  if (value == null) return "";
  let str = String(value);

  // Guard against formula injection in spreadsheet apps
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  if (/[",\n\r]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export function toHazardsCsv(hazards: any[]): string {
  const header = CSV_COLUMNS.map((c) => c.header).join(",");
  const rows = hazards.map((h) =>
    CSV_COLUMNS.map((c) => escapeCsvCell(c.get(h))).join(","),
  );
  return [header, ...rows].join("\r\n") + "\r\n";
}
