-- ════════════════════════════════════════════════════════════════════
-- Migration: add `purchase_amount` + `purchase_status` to kit_pieces
--   • purchase_amount  numeric  — nullable USD sale price of a kept piece
--   • purchase_status  text     — nullable payment state: 'paid' | 'pending'
--
-- HOW TO RUN (one time):
--   Supabase Dashboard → SQL Editor → New query → paste → Run.
--   Safe to re-run (IF NOT EXISTS).
--
-- WHY a migration file: adding a column is DDL, which the service-role key
-- used by scripts/sync_partners.mjs cannot do over the API. Run this once
-- here; afterwards `npm run sync:partners` round-trips the values from
-- scripts/partners_data.json.
--
-- Nullable on purpose: a kept piece whose sale price isn't known yet stays
-- NULL (the dashboard renders "—"). It only carries a number once a stylist
-- has actually purchased the item.
-- ════════════════════════════════════════════════════════════════════

alter table public.kit_pieces
  add column if not exists purchase_amount numeric;

alter table public.kit_pieces
  add column if not exists purchase_status text;
