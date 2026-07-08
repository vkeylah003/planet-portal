-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Daily Log (manual daily metrics)
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (IF NOT EXISTS / drop-then-create, like partner_selections.sql).
--
-- Backs the internal dashboard's "Daily Log" tab: the numbers Sofia records by
-- hand each day that aren't in any system (reels/posts partners published,
-- reposts, IG/FB DMs sent + unread, ops notes, the weekly goal, and an
-- on-track / blockers read). One row per calendar day (log_date is unique),
-- edited in place via upsert. The EOD Draft tab reads today's row.
--
-- Adds:
--   1) public.daily_log table  — one manual-metrics row per day
--   2) admin-only RLS reusing public.is_admin() from schema.sql
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) DAILY LOG — one row per day, keyed by log_date (unique)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.daily_log (
  id           uuid primary key default gen_random_uuid(),
  log_date     date not null unique,          -- the day these metrics are for
  reels_posted integer,                        -- partner reels/posts published today
  reposts      integer,                        -- how many PLANET reposted
  dms_sent     integer,                        -- IG/FB DMs sent
  dms_unread   integer,                        -- DMs still unread / awaiting reply
  notes        text,                           -- free-text ops / notes
  weekly_goal  text,                           -- this week's goal
  on_track     boolean,                        -- null = not answered yet
  blockers     text,                           -- what's in the way, if anything
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_daily_log_date
  on public.daily_log(log_date desc);

-- ─────────────────────────────────────────────────────────────
-- 2) ROW LEVEL SECURITY — admin (Sofia) only, reusing is_admin()
--    from schema.sql. No anon/partner access: this is internal ops data.
-- ─────────────────────────────────────────────────────────────
alter table public.daily_log enable row level security;

drop policy if exists daily_log_admin_all on public.daily_log;
create policy daily_log_admin_all on public.daily_log
  for all using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCRIPT:
--   • The Internal Dashboard → "Daily Log" tab can save/edit one entry per day.
--   • The "EOD Draft" tab combines today's entry with the live Stats numbers
--     into a copy-paste end-of-day update.
-- ════════════════════════════════════════════════════════════════════
