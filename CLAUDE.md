# ALRT backend (Express + Prisma) — locked product rules

These rules are locked. Do not weaken, remove, or "improve" them without an
explicit instruction from the product owner in the current session.

## Safety and privacy (non-negotiable)

- ALRT never contacts emergency services; the disclaimer travels on the
  alert payload itself.
- Location leaves a phone only by the owner's action. No endpoint may
  create a continuous location stream except SOS live share.
- Snapshots expire after 1 hour: keep the event log (who was notified,
  seen, on their way, called, when sharing started/ended), delete the
  location data. Never archive or aggregate expired locations.
- SOS live share caps at 4 hours; on stop the last point is deleted, and
  history keeps only time and duration.
- Journeys are snap points by default; live is per-journey opt-in.
- Scheduled snapshots: one point per time, 1-hour expiry, never continuous.
- Call buttons only by advance grant; phone numbers are never returned to
  the caller's client for display.
- Guests never request locations. No mute/snooze for circle SOS receipt.
- Leaderboard responses never identify other users (anonymise name, no
  email/id for anyone but the caller).

## Commercial rules

- Invited members never hit a paywall; join-by-code is free.
- Seats: ALRT+ = 8 seats across up to 4 owned circles (MAX_SEATS_TOTAL=8,
  MAX_OWNED_CIRCLES=4 in family.service.ts). A seat is a (person, circle)
  pair in an owned circle; the host's own membership consumes a seat;
  joining someone else's circle consumes nothing of the joiner's.
- Billing is not launched: every circle defaults to plan `plus`. When the
  entitlement system ships, new circles default to `free`.
- Ownership transfer (§29): eligible = active subscription + enough free
  seats to absorb the whole circle; ineligible members are returned greyed
  with a reason, never hidden.

## Engineering conventions

- `npx tsc --noEmit` must be clean before every push, except the
  pre-existing serviceAccountKey.json import error.
- Migrations are hand-authored SQL in timestamped dirs under
  prisma/migrations/ (match the existing naming).
- Zod validators in src/validators/, thin controllers, logic in
  src/services/.
- Circle-scoped endpoints accept optional ?circleId= and default to the
  user's oldest membership; id-addressed endpoints anchor the circle on
  the resource.
- Australia/Brisbane is fixed UTC+10 (no DST) for day boundaries and cron.
- QLD Traffic API key comes from env (QLD_TRAFFIC_API_KEY); ingestion
  skips the source when empty. Never commit API keys.
- Work happens on branch `claude/safety-alert-repo-audit-8exgvn`.
- Never touch SafetyALRT org repos; never deploy.
- No en-dashes in any output.
