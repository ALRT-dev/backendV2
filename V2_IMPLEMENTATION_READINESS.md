# Safety ALRT — V2 Implementation Readiness

> A planning view of what's left before the map and alerts go live, synthesised
> from the Master Decisions Register (Parts 3 & 4) and the v2 design set.
> Statuses are a planning snapshot — confirm against the repo before committing
> scope.

**Legend**

- **Locked** — designed & decided
- **Build** — design done, needs implementing
- **Decide** — open decision
- **External** — waits on others

---

## The critical path — do these in order

1. **Close the open decisions** — Security colour, For You treatment, Other
   grey-vs-brown. Cheap, and they unblock build.
2. **Icon remediation + AlertIcon** — one monochrome glyph per hazard; component
   composes shape · colour · size at render.
3. **Backend basics first** — severity keyword-scan, `canonicalHazard` map,
   closed-list layer — _before_ the prompt.
4. **The extraction prompt** — `plainMeaning` + facts + location, with an eval
   set. AI never sets severity or advice.
5. **Run externals in parallel** — AWS icon pack, source licences, clinical
   sign-off — start now, they have lead time.

---

## Track 1 — Map & Alerts (frontend)

Rendering alerts on the map, in callouts, list, and the full card across every
surface.

### Locked

- **The five-system One Glance model** — shape = source, colour = urgency,
  glyph = hazard. Triangle / diamond / circle / square / shield.
- **Band vocabulary** — Info / Monitor / Action / Critical (diamond + shield);
  AWS writes Advice / Watch and Act / Emergency; square Low / Med / High.
- **Every surface is designed** — marker, callout, list row, notification,
  lock-screen Live Activity, widget, watch, full card — with the content-budget
  rule.
- **Community layer** — circle markers, category colours, states (default / ×N
  confirmed / selected / fade-to-expiry), Unverified tag, v2 glyph set.
- **For You block + safety profile** — placement, format, on-device matching,
  visitor mode.

### Build

- **The AlertIcon render component** — resolve shape · colour · glyph from the
  source registry; 3 sizes (16/24/40); fallback ladder
  hazard→sub→category→other. _(Started — see `lib/features/shared/views/widgets/alert_icon.dart` in V2-Claude.)_
- **Single-glyph icon storage + remediation** — strip composed shapes/colours to
  one monochrome glyph each (≈585 uploads → 117); SVG conversion; transparency;
  fix `officla/Utitlities` naming; reclassify the false AWS triangles (volcano,
  landslide, snow, earthquake).
- **Marker + distance consistency** — one marker per shape, no backing shapes;
  distance rounding (≤10km 1dp, ≤100km whole, >100km nearest 50).
- **Notification sound policy + Live Activity** — deterministic by band (Info
  silent → Critical breaks through DND); one activity per followed alert, tier
  track climbs in place, reuses the dedupe hash.

### Decide

- **Security & Crime colour** — Register says red→magenta; shipped community set
  uses `#FF4757` (red-coral). Pick one hex, propagate everywhere.
- **For You block treatment** — accent rail, or icon row with a compliant glyph
  set.
- **Community "Other" colour** — taxonomy grey `#888` vs live brown `#8B6F47`.
  Recommend adopting brown into the standard.
- **Fire danger ratings surface** — alert feed, or a separate home strip / map
  layer (they're forecasts, not incidents).
- **16px shape legibility** — diamond vs shield at the smallest size — confirm
  they're distinguishable.

### External

- **Official AWS national icon pack** — obtain from AIDR / agencies, reproduced
  as published. **Blocks all triangle rendering.**

---

## Track 2 — Backend: the SI extraction prompt

AI's only job is extraction. It never sets severity, never gives advice, never
invents a level.

### Locked

- **AI = extraction only** — pull facts to write `plainMeaning`, pick the
  pre-written For You line, and find location. It describes what's happening; the
  library says what to do.
- **Cost discipline** — match closed lists before any model call; one extraction
  call per alert, cached on a text hash, served to everyone nearby.
- **Voice & liability rules** — no movement advice in ALRT's voice; hedging
  ("may/usually"); attribution; ~20 words at Emergency, 35 elsewhere.

### Build

- **The prompt + output schema** — fixed JSON out: `plainMeaning`, `facts[]`,
  `canonicalHazard`, `location`, `confidence`. Nothing that sets band or advice.
  Feeds the card fields directly. _(Started — `getSIExtractionPrompt()` in
  `src/utils/ai-prompt.util.ts`, seeded as the "SI Extraction" prompt, run by
  `src/services/si_extraction.service.ts`.)_
- **Closed-list matching layer (pre-model)** — forecast districts, AWS action
  statements, AQ categories, and the `canonicalHazard` synonym map — checked
  before the prompt. _(Started — `src/utils/canonical_hazard.util.ts`.)_
- **Severity = deterministic keyword scan** — in Node, keyed on the **source**
  not the text, per the source registry. Separate module from the AI entirely.
  _(Started — `src/services/severity_scan.service.ts`.)_
- **Location extraction pipeline** — per-source strategy: CAP structured field →
  gazetteer → model, in that order.
- **Security & Crime keywords** — currently zero against 228 active hazards — the
  scan can't classify them yet.
- **Eval set + purge-list sweep** — real feed samples per source; assert no
  severity/advice leakage and clean `plainMeaning`. Sweep prompts/config for
  retired terms (Code Red, Hazardous, etc.).

### Decide

- **Keyword store home** — portal or workbook wins; the other is generated from
  it or removed.
- **Council feeds** — ingest as official, or leave local content to community
  reports.

---

## Cross-cutting — blocks go-live for both tracks

These need external action or sign-off, so start them today.

- **Source licences** (external) — nearly every source-registry row is
  `unconfirmed`; the only item with legal consequences. Start the emails.
- **For You library sign-off** (external) — 85 gated rows are drafts until
  clinical review; tsunami rows need rekeying to Emergency + threat type.
- **Repo consolidation** (build) — two GitHub orgs, eight repos with apparent
  duplicates; branch protection on main; rename `backend-`.
- **Read the AIDR republishers companion** (external) in full before launch —
  you republish warnings and it governs how.

---

## What's been started in code (this branch)

| Item | Where | Status |
|------|-------|--------|
| SI extraction prompt + fixed JSON schema | `src/utils/ai-prompt.util.ts` → `getSIExtractionPrompt()`; seeded as `SI Extraction` | first version |
| Closed-list `canonicalHazard` matcher (pre-model) | `src/utils/canonical_hazard.util.ts` | first version |
| Deterministic severity keyword-scan (source-keyed) | `src/services/severity_scan.service.ts` | first version |
| SI extraction service (pre-match → model → fallback) | `src/services/si_extraction.service.ts` | first version |
| AlertIcon render component | `lib/features/shared/views/widgets/alert_icon.dart` (V2-Claude repo) | first version |

These are wired into the existing systems (the prompt seeds into the DB-managed
AI-prompt library; the extractor degrades to the closed-list match if the model
or DB is unavailable) but are **not yet plugged into the live ingestion path** —
that swap, the eval set, and the location pipeline are the next backend steps.
