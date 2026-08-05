-- Onboarding awarded 20 XP with a bare `xpPoints: { increment: 20 }` and no
-- ledger row, so a user's very first 20 points had no entry in their points
-- history: the total said 20 and the history explained none of it. Routing
-- it through the ledger needs an event type to file it under.
ALTER TYPE "XpEventType" ADD VALUE IF NOT EXISTS 'onboardingCompleted';
