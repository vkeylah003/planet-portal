-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Purchase-pending ops alert
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (drop-then-recreate the constraint, like the rest of /supabase).
--
-- Backs team-operable automation #3: /api/cron/purchase-pending (daily).
-- Flags any Returned kit where a piece was marked "Keep" but never got a
-- purchase_amount — i.e. the partner kept something and still needs a
-- purchase call. Shows up as a RED "Purchase needed" flag in the admin
-- dashboard's "Needs attention" banner, distinct from the amber/teal alerts
-- the other two automations raise.
--
-- This only widens the existing ops_alerts.type check constraint (added by
-- ops_automations.sql) to allow the new 'purchase_pending' value — no new
-- table or column needed, since ops_alerts.details is already a free-form
-- jsonb column that can hold {piece, color, kit_id, outcome}.
-- ════════════════════════════════════════════════════════════════════

alter table public.ops_alerts drop constraint if exists ops_alerts_type_check;

alter table public.ops_alerts
  add constraint ops_alerts_type_check
  check (type in ('kitless_partner', 'quiz_not_done', 'purchase_pending'));

-- ════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCRIPT:
--   • Add the cron to Vercel: it's already declared in vercel.json
--     (/api/cron/purchase-pending, daily 15:00 UTC) — a normal deploy
--     picks it up, no extra Vercel setup needed.
--   • Nothing else to do — the banner already knows how to render this
--     alert type in red (OPS_ALERT_META in AdminDashboard.jsx).
-- ════════════════════════════════════════════════════════════════════
