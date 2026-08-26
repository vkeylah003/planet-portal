-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Kit Invoice Tracking
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (IF NOT EXISTS, like schema.sql).
--
-- Adds an invoice_url column to `kits` — the public Supabase Storage URL of
-- a purchase invoice (PDF/image) an admin attaches from KitModal, via the
-- 'kit-invoices' bucket created in supabase/kit_invoice_storage.sql. Run
-- THIS file first — kit_invoice_storage.sql's bucket/policies have no effect
-- on the app until this column exists for the app to write the resulting
-- URL into.
-- ════════════════════════════════════════════════════════════════════

alter table public.kits
  add column if not exists invoice_url text;

-- ─────────────────────────────────────────────────────────────
-- No RLS changes needed — same as kit_shipment_tracking.sql /
-- kit_returned_tracking.sql: the admin dashboard reads/writes kits as an
-- authenticated admin (existing kits_admin_all policy) and sees the new
-- column via select *.
-- ─────────────────────────────────────────────────────────────
