-- The earn events from Points & Badge Logic v1.1 section 2 that the backend
-- had never implemented. Additive only: nothing existing is retired here.
-- v1.1's retirements (streaks, upvotes, paid confirmations) are explicitly
-- marked in that document as "a design direction that was not adopted in
-- production", so they are deliberately left alone.
ALTER TYPE "XpEventType" ADD VALUE IF NOT EXISTS 'firstReportPosted';
ALTER TYPE "XpEventType" ADD VALUE IF NOT EXISTS 'profileCompleted';
ALTER TYPE "XpEventType" ADD VALUE IF NOT EXISTS 'familyJoined';
ALTER TYPE "XpEventType" ADD VALUE IF NOT EXISTS 'savedPlaceAdded';
ALTER TYPE "XpEventType" ADD VALUE IF NOT EXISTS 'reportWidelyCorroborated';
