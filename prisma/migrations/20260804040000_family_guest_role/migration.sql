-- Guest role: receives the circle's alerts and can say "I'm Safe", but never
-- requests anyone's location and consumes no seat on the owner's plan.
ALTER TYPE "FamilyRole" ADD VALUE IF NOT EXISTS 'guest';

-- An invite can be marked as a guest invite; whoever redeems it joins as a
-- guest. Existing invites keep their current behaviour (full member).
ALTER TABLE "FamilyInvite"
  ADD COLUMN IF NOT EXISTS "isGuestInvite" BOOLEAN NOT NULL DEFAULT false;
