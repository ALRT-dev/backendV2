# Data Export — GeoJSON / CSV Feed

## Overview

`GET /api/alerts/geo` is ALRT's single data-out feed. It reads the same
hazard rows the app uses (one source of truth, no AI calls at export
time — AI-generated fields are served from what was persisted at
ingestion) and can respond as GeoJSON or CSV.

## Authentication

Two options:

- **App users**: `Authorization: Bearer <access token>` (unchanged).
- **External integrations**: `X-Webhook-Api-Key: <key>` — the same keys
  created via `POST /api/admin/webhook-api-keys`, with the same logging,
  expiry and abuse tracking. API-key clients only receive hazards with
  `reviewStatus = accepted` (the same rule the public share pages
  enforce); personal data (users, family, SOS) is never part of this
  feed.

## Query parameters

All existing filters still apply (`status`, `dateFrom`, `dateTo`,
`source`, `severity`, `severityBands`, `categoryIds`, bounding box,
`limit` 1–2000). New:

| Parameter | Values | Purpose |
|---|---|---|
| `updatedAfter` | ISO 8601 datetime | Incremental pulls — only rows changed since your last sync, so the same data is never downloaded twice. |
| `cursor` | opaque string | Keyset pagination. Pass the `metadata.nextCursor` from the previous page; `nextCursor: null` means you have everything. |
| `format` | `geojson` (default) \| `csv` | CSV responds as a `text/csv` attachment; page cursor arrives in the `X-Next-Cursor` header. |
| `dedupe` | `true` | Export-time collapse of cross-source duplicates: same category within 1 km and 12 h. The surviving row (official source preferred, then higher severity band, then newest) lists collapsed ids in `duplicateIds` for traceability. Stored data is untouched. |

When `updatedAfter`, `cursor` or `format=csv` is used, rows are ordered
by `(updatedAt, id)` ascending so pages stitch together deterministically.
Otherwise the existing severity-first ordering is kept unchanged.

## Attribution

Each row now carries its source attribution so licence terms of the
government feeds can be honoured downstream: `sourceName`, `sourceUrl`,
`sourceCopyrightText`, `sourceCopyrightLink`, `sourceLicenseBadge`,
`sourceLicenseLink`, plus `occurredAt` and `confidenceScore`.

## Typical incremental sync

```
# First pull (full)
GET /api/alerts/geo?limit=2000
# Follow metadata.nextCursor until it is null…
GET /api/alerts/geo?limit=2000&cursor=<nextCursor>

# Every later sync: only what changed
GET /api/alerts/geo?limit=2000&updatedAfter=<last sync time>&dedupe=true
```
