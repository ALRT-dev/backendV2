-- The wide-corroboration award (+10) is once per report, but the check was
-- read-then-write with nothing enforcing it: two confirmations crossing
-- the threshold at the same moment could both pay. This index makes the
-- database the referee. Partial, so it constrains only the once-per-report
-- event type and leaves every other ledger row alone.
--
-- The event type shipped in this same release wave, so there are no
-- historical duplicates to clean up first.
CREATE UNIQUE INDEX IF NOT EXISTS "XpEvent_wide_corroboration_once_key"
    ON "XpEvent"("hazardId", "type")
    WHERE "type" = 'reportWidelyCorroborated';
