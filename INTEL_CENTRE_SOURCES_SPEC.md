# Intel Centre — New Source Build Spec

## Purpose

This is a build handoff, not a design document. It specifies exactly what a
developer (or a Claude Code session) needs to wire four new raw-data
sources into the existing ingestion pipeline
(`src/services/ingestion.service.ts`), following the same pattern already
used for WAQI, Open-Meteo and USGS: fetch raw measurements, apply a
deterministic numeric threshold to decide severity, no AI call.

Legal clearance for each source was verified separately (see
`ALRT-intel-centre-feeds.docx` / this session's chat history) — this
document assumes that's settled and focuses on implementation.

**Convention reminder** (from the existing codebase): every new source
needs an `ExternalSourceId` entry, an `HazardSource` row (name, url,
licenseId, copyrightText, advisoryText), an entry in the
`externalSources` array in `ingestion.service.ts`, and a `parse*ToHazards`
function in `src/utils/ingestion.util.ts` that returns hazard objects with
a deterministic `id`.

---

## 1. Copernicus GloFAS — global river flood forecasting

**Adds a capability ALRT does not have today**: predictive flood risk,
not just after-the-fact SES warnings.

- **Enum**: `ExternalSourceId.glofas = "glofas"`
- **Endpoint**: Copernicus Early Warning Data Store (EWDS),
  `https://ewds.climate.copernicus.eu/api`, via the `cdsapi` client
  library (Python) or its documented REST calls — this is a request/poll
  API, not a simple GET.
- **Auth**: personal API token from a free Copernicus/CDS account,
  configured once (`.cdsapirc` pattern); store as `config.glofas.apiKey`
  alongside the other source configs in `src/utils/config.js`.
- **⚠️ Access caveat — confirm before building**: Copernicus states the
  CDS/EWDS data service is *not* maintained as a time-critical
  operational service and should not be relied on for real-time alerting.
  For a live hazard feed, contact Copernicus support about an operational
  access arrangement before committing engineering time; the free tier
  may only be reliable for periodic (e.g. 6-hourly) polling, not minute-level
  freshness.
- **Key fields**: forecast river discharge (m³/s) per grid point/reporting
  point, plus a return-period exceedance probability (e.g. "20% chance of
  exceeding the 20-year flood level").
- **Proposed severity mapping** (mirrors the existing AQI/UV threshold
  pattern in `ingestion.util.ts`):
  | Return-period exceedance probability | `severityBand` |
  |---|---|
  | ≥ 50% chance of exceeding 20-yr level | `critical` |
  | ≥ 50% chance of exceeding 5-yr level | `action` |
  | ≥ 50% chance of exceeding 2-yr level | `monitor` |
  | below that | not stored (filtered, same as low-AQI/low-UV today) |
- **Category**: new subcategory under Weather & Environment, e.g.
  `floodForecast` (distinct from the existing `flood` AWS category, which
  is reserved for official agency-issued flood warnings).
- **ID scheme**: `` `glofas-${reportingPointId}-${forecastIssueDate}` ``
- **Attribution** (required by licence): *"Generated using Copernicus
  Emergency Management Service information [year]."*
- **Licence**: CC BY 4.0 — commercial use explicitly permitted.

---

## 2. OpenAQ — global air quality (replaces WAQI)

- **Enum**: `ExternalSourceId.openAq = "openAq"`
- **Endpoint**: `https://api.openaq.org/v3/locations` (station metadata) +
  `https://api.openaq.org/v3/locations/{id}/latest` (latest readings).
  Bound to Australia (or expand globally later) using the locations
  endpoint's bounding-box query params, same pattern as the existing WAQI
  `map/bounds` call.
- **Auth**: free API key, sent as header `X-API-Key`; store as
  `config.openAqApi.apiKey`.
- **Key fields**: `parameter` (pm25, pm10, no2, o3, so2, co), `value`,
  `unit`, station `coordinates`.
- **Severity mapping**: reuse the existing AQI severity-band thresholds
  already implemented for WAQI (`critical`/`action`/`monitor`/`info` by
  AQI value) — no new methodology needed, just point the existing
  threshold function at OpenAQ's `pm25`/`pm10` readings converted to AQI,
  or use OpenAQ's own AQI conversion if available in the response.
- **Category**: existing `airQualityAlert` subcategory — no change.
- **ID scheme**: `` `openAq-${locationId}-${parameter}` ``
- **Attribution**: *"Air quality data provided by OpenAQ, licensed under
  CC BY 4.0."* Link to `https://openaq.org`.
- **Licence**: CC BY 4.0 — commercial use explicitly permitted.
- **Migration note**: once live, WAQI can be retired for regions OpenAQ
  covers, resolving the WAQI paid-app licensing conflict without losing
  air-quality coverage. Confirm OpenAQ station density in target
  AU regions before fully retiring WAQI — coverage can be patchier in
  regional/remote areas.

---

## 3. NASA FIRMS — satellite fire hotspot detection

**Framing requirement, not just a technical one**: a FIRMS hotspot is an
unconfirmed thermal anomaly (can be a fire, but also agricultural burn-off,
gas flaring, or sensor artifact), not a confirmed, graded hazard. It must
not be presented with the same visual weight as an RFS/CFS incident.

- **Enum**: `ExternalSourceId.nasaFirms = "nasaFirms"`
- **Endpoint**: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{SOURCE}/{AREA_COORDINATES}/{DAY_RANGE}`
  — CSV response. `SOURCE` = `VIIRS_SNPP_NRT` (recommended — finer
  resolution than MODIS). `AREA_COORDINATES` = Australia bounding box.
- **Auth**: free `MAP_KEY` from FIRMS registration; store as
  `config.nasaFirmsApi.mapKey`. Rate limit: 5,000 transactions per 10
  minutes per key — generous for a 15-minute poll cycle.
- **Key fields**: `latitude`, `longitude`, `brightness` (Kelvin),
  `confidence` (0–100%), `frp` (fire radiative power, a proxy for
  intensity), `acq_date`/`acq_time`, `daynight`.
- **Proposed severity mapping**:
  | Condition | `severityBand` |
  |---|---|
  | `confidence` ≥ 80% AND `frp` above a high-intensity threshold (tune against historical AU fire season data) | `action` |
  | `confidence` ≥ 50% | `monitor` |
  | `confidence` < 50% | filtered out (too noisy to surface) |
  Never map a FIRMS detection to `critical` on its own — that band should
  be reserved for confirmed official warnings.
- **Category**: new subcategory, e.g. `unconfirmedHeatDetection`, kept
  visually and taxonomically distinct from `bushfire`.
- **Dedup consideration**: this is the source most likely to overlap with
  RFS/CFS/QLD Fire incidents for the same real event — route FIRMS rows
  through the existing export-time dedup logic
  (`src/utils/export_dedup.util.ts`) logic pattern, or an equivalent at
  ingestion time, so a hotspot doesn't create a second alert once an
  agency has issued the real one.
- **ID scheme**: `` `nasaFirms-${latitude.toFixed(3)}-${longitude.toFixed(3)}-${acq_date}-${acq_time}` ``
- **Attribution**: replicate NASA's FIRMS citation/disclaimer notice
  (see `https://www.earthdata.nasa.gov/data/tools/firms` "Citation,
  Acknowledgements and Disclaimer" page) — required when redistributing
  FIRMS data to a third party, which serving it in-app counts as.
- **Licence**: NASA open data — no commercial restriction found, subject
  to the citation/disclaimer requirement above.

---

## 4. Geoscience Australia — earthquakes (replaces USGS for AU events)

- **Enum**: `ExternalSourceId.gaEarthquake = "gaEarthquake"`
- **Endpoint**: `https://earthquakes.ga.gov.au` OGC API (pygeoapi-based);
  confirm exact collection/feature endpoint path at build time — GA's API
  follows the OGC API - Features standard (GeoJSON output), magnitude
  ≥ 2.0 nationally.
- **Auth**: none required (public feed).
- **Key fields**: magnitude, depth, origin time, GeoJSON point geometry.
- **Severity mapping**: reuse the existing USGS magnitude-to-band logic
  in `parseUSGSEarthquakeToHazards` unchanged — same methodology, new
  source.
- **Category**: existing `earthquake` AWS-compliant subcategory.
- **ID scheme**: `` `gaEarthquake-${eventId}` `` (GA's own event ID).
- **Attribution** (exact required wording): *"[Data] by Geoscience
  Australia, which is © Commonwealth of Australia and is provided under a
  Creative Commons Attribution 4.0 International Licence and is subject
  to the disclaimer of warranties in section 5 of that licence."*
- **Licence**: CC BY 4.0 — commercial use explicitly permitted.
- **Migration note**: keep USGS active for non-AU global events (its
  `all_hour.geojson` feed already covers the globe); scope GA to
  Australia/region only, and exclude AU-region duplicates from the USGS
  feed once GA is live (bounding-box filter, same idea as the dedup logic
  elsewhere in the codebase).

---

## 5. NASA EONET — global natural events (context layer)

**Framing requirement**: NASA's own documentation states EONET is
"intended to support natural event applications by providing information
primarily for visualization and general reference, and should not be
regarded as an official source for precise spatial or temporal data."
Treat this the same way as FIRMS — a lower-confidence situational layer,
never a substitute for an official warning, and never mapped to
`critical`.

- **Enum**: `ExternalSourceId.nasaEonet = "nasaEonet"`
- **Endpoint**: `https://eonet.gsfc.nasa.gov/api/v3/events` — filterable
  by category (`wildfires`, `severeStorms`, `volcanoes`, `floods`,
  `seaLakeIce`, `drought`) and by bounding box.
- **Auth**: `api.nasa.gov` key (free, generous rate limit) shared with
  any future use of other `api.nasa.gov` services.
- **Key fields**: `title`, `category`, `geometry` (point or polygon,
  time-stamped), event `status` (open/closed) — no magnitude or severity
  field is provided for most categories.
- **Proposed severity mapping**: since EONET carries no intensity value
  for most categories, do not attempt a graded severity — surface as a
  flat `info`/`monitor` band "situational awareness" marker only,
  distinct from graded hazards. Where a category overlaps a source ALRT
  already has graded data for (e.g. `wildfires` vs FIRMS/RFS), suppress
  the EONET row via the same dedup approach as FIRMS.
- **Category**: new subcategory, e.g. `globalEventTracker`, kept
  separate from graded hazard categories.
- **ID scheme**: `` `nasaEonet-${eventId}` `` (EONET's own event ID).
- **Attribution**: same NASA open-data citation/disclaimer requirement
  as FIRMS.
- **Licence**: NASA open data — no commercial restriction found.

---

## 6. USGS Volcano Hazards Program — volcanic activity

ALRT currently has no volcanic-hazard coverage at all. Use the **USGS**
side specifically, not raw Smithsonian Global Volcanism Program data —
USGS inherits the same US-government public-domain status already relied
on for the USGS earthquake feed; GVP's own terms could not be confirmed
and should not be assumed to match.

- **Enum**: `ExternalSourceId.usgsVolcano = "usgsVolcano"`
- **Endpoint**: `https://volcanoes.usgs.gov/vsc/api/volcanoApi/` —
  confirm exact current-activity/alert-level path at build time; this
  API's coverage is US volcanoes (including Hawaii, Alaska, Pacific
  Northwest) — it is not a global feed.
- **Auth**: none required (public feed).
- **Key fields**: USGS/VONA alert level (`Normal` / `Advisory` /
  `Watch` / `Warning`) and aviation colour code — this is a
  **pre-graded** field, similar to how RFS/BoM provide their own
  severity rather than a raw number.
- **Severity mapping**: pass the USGS alert level straight through via a
  fixed lookup (`Warning → critical`, `Watch → action`, `Advisory →
  monitor`, `Normal` → not stored) rather than deriving one — no
  threshold logic needed here, this source is closer to a relayed
  official warning for the volcanoes it covers.
- **Category**: new AWS-adjacent subcategory, e.g. `volcanicActivity`.
- **ID scheme**: `` `usgsVolcano-${volcanoId}` ``
- **Attribution**: US Government public domain — courtesy credit to
  USGS Volcano Hazards Program recommended, not legally required.
- **Licence**: public domain (US Government work).
- **Gap remaining**: this covers US volcanoes only. Global volcanic
  coverage (e.g. Indonesia, Japan, PNG — relevant to Australian
  travellers) would still need GVP's own terms confirmed, or a
  country-specific agency feed, before it could be added.

---

## Also worth adding — finished alerts, not Intel Centre sources

These two are **not** raw-data sources for ALRT to analyse — the issuing
body already assigns its own graded severity, so ALRT would relay them
the same way it relays RFS or BoM, not run them through threshold logic.
Listed here for completeness since they came up in the same research
pass; they belong with the ordinary source-ingestion backlog, not the
Intel Centre pattern.

- **GDACS** (Global Disaster Alert and Coordination System) — global
  multi-hazard (earthquake, cyclone, flood, volcano) alerts, each already
  graded Green/Orange/Red by GDACS's own impact model.
  **Licence confirmed**: CC BY 4.0, commercial use explicit. Attribution:
  *"Global Disaster Alert and Coordination System, GDACS."* Endpoint
  details in `https://www.gdacs.org/Documents/2025/GDACS_API_quickstart_v1.pdf`
  — confirm the exact REST path at build time. `ExternalSourceId.gdacsGlobal`
  already exists as a placeholder enum value in `ingestion.service.ts` —
  no new enum entry needed, just implementation.
- **NOAA National Hurricane Center** — tropical cyclone/hurricane
  Watches and Warnings, already graded by NHC. Very likely public domain
  (same basis as NWS/USGS data), but the exact terms page for this
  specific product was not confirmed in this pass — verify before
  building. Would need a new `ExternalSourceId` entry (e.g. `noaaNhc`).
  Fills a hazard type (cyclones) ALRT has no dedicated global source for
  today.

---

## Build order (suggested)

1. **Geoscience Australia** — lowest effort, no auth, reuses existing
   USGS parsing logic almost verbatim.
2. **OpenAQ** — clean CC BY 4.0 licence, resolves the WAQI conflict,
   reuses existing AQI threshold logic.
3. **GDACS** — licence now confirmed; low effort since severity is
   pre-graded, no threshold logic to design.
4. **USGS Volcano** — pre-graded severity, no threshold logic, but a
   genuinely new hazard type (fills a real gap) so allow time for new
   category/UI work.
5. **NASA FIRMS** — new category and dedup work needed, but no blocked
   dependencies; do the "unconfirmed" framing and dedup pass before
   shipping, not after.
6. **NASA EONET** — similar effort to FIRMS; do the dedup pass against
   FIRMS/RFS/BoM for the `wildfires` category specifically before
   shipping.
7. **NOAA NHC** — confirm the commercial-use terms for this specific
   product first.
8. **GloFAS** — confirm the operational-access question with Copernicus
   first; this is the only one with an open access question rather than
   just an implementation task.

## Explicitly out of scope here

EMSC (earthquakes) is not in this spec — its terms bar commercial use
without written permission, same blocker as ARPANSA. Do not build against
it until/unless that's resolved. Global (non-US) volcanic coverage is
also out of scope until Smithsonian GVP's own terms are confirmed.
