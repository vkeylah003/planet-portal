-- ════════════════════════════════════════════════════════════════════
-- Migration: add `gifted` boolean to partners
--   • gifted  boolean  — true ONLY for partners we explicitly gifted
--     product to (no return expected). NOT the normal sample-kit partners
--     who send the kit back. Defaults to false.
--
-- HOW TO RUN (one time):
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--   Safe to re-run (IF NOT EXISTS).
--
-- WHY a migration file: adding a column is DDL, which the service-role key
-- used by scripts/sync_partners.mjs cannot do over the API. Run this once
-- here; afterwards `npm run sync:partners` round-trips the flag from
-- scripts/partners_data.json (currently true for Megan, Deborah, Cynthia).
--
-- The dashboard also treats three known emails as gifted as a fallback, so
-- the Gifted view works immediately even before this column is synced — but
-- running this makes `gifted` the persistent source of truth.
-- ════════════════════════════════════════════════════════════════════

alter table public.partners
  add column if not exists gifted boolean not null default false;

-- Mark the three explicitly-gifted partners (idempotent).
update public.partners set gifted = true
  where lower(email) in (
    'megan@meganslifestyle.com',
    'info@deborahsorlie.com',
    'cynthia@theunexpectedsomeone.com'
  );
