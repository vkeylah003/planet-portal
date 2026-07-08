-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — Partner Private Links + Selections
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (IF NOT EXISTS / drop-then-create, like schema.sql).
--
-- Approach: NO partner login. Each partner gets an unguessable private
-- link /partner/<select_token>. The token identifies the partner. All
-- reads/writes for that page go through SECURITY DEFINER functions that
-- validate the token, so the anon key never needs broad table access.
--
-- Adds:
--   1) partners.select_token            — per-partner secret (backfilled)
--   2) public.partner_selections table  — a partner's chosen pieces
--   3) get_partner_by_token()           — partner + kit + pieces for the page
--   4) submit_partner_selection()       — token-validated insert
--   5) RLS so only the admin (Sofia) can read/manage selections directly
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto;  -- for gen_random_bytes()

-- Old login-gate helper from the previous approach — no longer used.
drop function if exists public.is_partner_email(text);

-- ─────────────────────────────────────────────────────────────
-- 1) PRIVATE LINK TOKEN on partners
--    48 hex chars (24 random bytes = 192 bits) — unguessable.
-- ─────────────────────────────────────────────────────────────
alter table public.partners
  add column if not exists select_token text;

-- Backfill any existing partners that don't have a token yet.
update public.partners
  set select_token = encode(gen_random_bytes(24), 'hex')
  where select_token is null;

-- New partners get one automatically.
alter table public.partners
  alter column select_token set default encode(gen_random_bytes(24), 'hex');

create unique index if not exists idx_partners_select_token
  on public.partners(select_token);

-- ─────────────────────────────────────────────────────────────
-- 2) PARTNER SELECTIONS — pieces a partner chose from the live catalog
-- ─────────────────────────────────────────────────────────────
create table if not exists public.partner_selections (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid references public.partners(id) on delete set null,
  partner_email text not null,
  partner_name  text,
  items         jsonb not null default '[]'::jsonb,  -- [{product_id,title,variant_id,color,price,image}]
  note          text,                                 -- optional sizes / preferences
  shipping_address jsonb,                             -- {name,line1,line2,city,state,zip}
  status        text not null default 'new'
                  check (status in ('new','reviewed')),
  created_at    timestamptz not null default now()
);

create index if not exists idx_partner_selections_status
  on public.partner_selections(status);

-- Re-runnable on an existing deployment: add the ship-to column if it's not
-- there yet (installs created before this feature won't have it).
alter table public.partner_selections
  add column if not exists shipping_address jsonb;

-- ─────────────────────────────────────────────────────────────
-- 3) READ: partner home payload for a valid token (or null)
--    security definer so it can read partners/kits/kit_pieces past RLS.
--    The caller already holds the secret token, so returning that
--    partner's own data is expected.
-- ─────────────────────────────────────────────────────────────
create or replace function public.get_partner_by_token(p_token text)
returns json
language sql
security definer
set search_path = public
as $$
  with p as (
    select * from public.partners
    where select_token = p_token
    limit 1
  ),
  k as (
    select * from public.kits
    where partner_id = (select id from p)
    order by created_at desc
    limit 1
  )
  select case
    when (select id from p) is null then null
    else json_build_object(
      'partner', json_build_object(
        'id',              (select id from p),
        'name',            (select name from p),
        'email',           (select email from p),
        'commission_link', (select commission_link from p),
        'platform',        (select platform from p)
      ),
      'kit', (select row_to_json(k) from k),
      'pieces', coalesce(
        (select json_agg(row_to_json(kp) order by kp.created_at)
           from public.kit_pieces kp
          where kp.kit_id = (select id from k)),
        '[]'::json
      )
    )
  end;
$$;

grant execute on function public.get_partner_by_token(text) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4) WRITE: submit a selection, keyed to a valid token
--    security definer validates the token and stamps the row with the
--    correct partner — the anon client can only ever submit as itself.
-- ─────────────────────────────────────────────────────────────
-- The signature gains p_shipping, so drop the older 3-arg version first —
-- otherwise this would create a second overload rather than replacing it,
-- leaving the RPC ambiguous. Safe to run whether or not the old one exists.
drop function if exists public.submit_partner_selection(text, jsonb, text);

create or replace function public.submit_partner_selection(
  p_token    text,
  p_items    jsonb,
  p_note     text,
  p_shipping jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_partner public.partners;
  v_id      uuid;
begin
  select * into v_partner
  from public.partners
  where select_token = p_token
  limit 1;

  if v_partner.id is null then
    raise exception 'Invalid or expired link';
  end if;

  insert into public.partner_selections
    (partner_id, partner_email, partner_name, items, note, shipping_address, status)
  values
    (v_partner.id,
     lower(v_partner.email),
     v_partner.name,
     coalesce(p_items, '[]'::jsonb),
     nullif(btrim(coalesce(p_note, '')), ''),
     -- Store only when at least one field is filled; otherwise leave null.
     case
       when p_shipping is null then null
       when coalesce(btrim(concat(
              p_shipping->>'name', p_shipping->>'line1', p_shipping->>'line2',
              p_shipping->>'city', p_shipping->>'state', p_shipping->>'zip')), '') = '' then null
       else p_shipping
     end,
     'new')
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.submit_partner_selection(text, jsonb, text, jsonb) to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5) ROW LEVEL SECURITY on partner_selections
--    Inserts happen ONLY through submit_partner_selection() above
--    (which bypasses RLS as definer), so there is NO anon insert policy.
--    Reuses public.is_admin() from schema.sql.
-- ─────────────────────────────────────────────────────────────
alter table public.partner_selections enable row level security;

-- Admin (Sofia) — full read/write (list pending, mark reviewed).
drop policy if exists selections_admin_all on public.partner_selections;
create policy selections_admin_all on public.partner_selections
  for all using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCRIPT:
--   • Every partner now has a private link:
--       https://<your-domain>/partner/<select_token>
--     View/copy each one from the Internal Dashboard → Partners tab.
--   • Partners open their link (no login), see their affiliate link,
--     commissions, kit status, and the "pick your box" catalog.
--   • Their submissions land in Dashboard → Selections (with a count badge).
-- ════════════════════════════════════════════════════════════════════
