-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Kit Invoice Storage
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (on conflict do nothing / drop-then-create, like schema.sql).
--
-- Creates the storage bucket the admin dashboard's "Attach invoice" upload
-- (KitModal) uploads purchase invoices into, plus the access policies:
-- admins can upload/update/delete, anyone can view (these are just PDF/image
-- invoices, not sensitive account data — the URL is only ever surfaced to an
-- admin viewing that kit, and being technically public-read is no different
-- from any other unguessable Supabase Storage URL).
--
-- Prerequisite: supabase/kit_invoice_tracking.sql (adds `kits.invoice_url`)
-- must be run BEFORE this file has any effect — this file only sets up
-- storage, not the column the app writes the resulting URL into.
-- ════════════════════════════════════════════════════════════════════

-- Bucket for kit purchase invoices. Public read (these are just PDF/image
-- invoices, not sensitive account data) — writes restricted to admins below.
insert into storage.buckets (id, name, public)
values ('kit-invoices', 'kit-invoices', true)
on conflict (id) do nothing;

drop policy if exists "Admins can upload kit invoices" on storage.objects;
create policy "Admins can upload kit invoices"
on storage.objects for insert
to authenticated
with check (bucket_id = 'kit-invoices' and is_admin());

drop policy if exists "Admins can update kit invoices" on storage.objects;
create policy "Admins can update kit invoices"
on storage.objects for update
to authenticated
using (bucket_id = 'kit-invoices' and is_admin());

drop policy if exists "Admins can delete kit invoices" on storage.objects;
create policy "Admins can delete kit invoices"
on storage.objects for delete
to authenticated
using (bucket_id = 'kit-invoices' and is_admin());

drop policy if exists "Anyone can view kit invoices" on storage.objects;
create policy "Anyone can view kit invoices"
on storage.objects for select
to public
using (bucket_id = 'kit-invoices');
