-- ════════════════════════════════════════════════════════════════════
-- PLANET Style Collective Portal — REFERRALS
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run (idempotent: IF NOT EXISTS / CREATE OR REPLACE / drop-then-create).
--
-- What this adds
--   1) partners.referred_by        — tag a partner as "referred by" another partner
--   2) public.sales                — the portal's record of a partner-attributed sale
--   3) public.referral_credits     — a credit owed to a referrer when their referred
--                                    partner makes a sale (auto-created by a trigger)
--   4) public.app_settings         — small key/value config; holds the DEFAULT referral
--                                    credit amount (a CONFIGURABLE placeholder, defaults 0)
--   5) flag_referral_credit()      — AFTER INSERT trigger on sales that auto-flags the
--                                    referrer's credit
--
-- ⚠️  The default referral credit is seeded to 0 as a clearly-marked placeholder.
--     Sofia still needs to decide the actual referral payout amount / rule, then set it
--     (Dashboard → Referrals → "Default referral credit", or update app_settings below).
-- ════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1) TAG: partners.referred_by  (nullable self-FK)
-- ─────────────────────────────────────────────────────────────
alter table public.partners
  add column if not exists referred_by uuid references public.partners(id) on delete set null;

create index if not exists idx_partners_referred_by on public.partners(referred_by);

-- ─────────────────────────────────────────────────────────────
-- 2) SALES — a partner-attributed sale recorded in the portal.
--    Today "manual/generated sales" live only in a bundled JSON snapshot
--    (scripts/partners_data.json → manual_sales) with no DB home and no
--    entry path. This table is that home; the admin "Log a sale" form writes
--    here, and inserts here are what trigger referral credits. `source`
--    distinguishes hand-entered sales from any future affiliate-platform sync.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.sales (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references public.partners(id) on delete cascade,
  order_number text,
  order_date   date,
  item         text,
  amount       numeric,                    -- net sale amount (USD)
  note         text,
  source       text not null default 'manual'
                 check (source in ('manual','impact','goaffpro')),
  created_at   timestamptz not null default now()
);

create index if not exists idx_sales_partner on public.sales(partner_id);

-- ─────────────────────────────────────────────────────────────
-- 3) REFERRAL CREDITS — one row per (referred partner's) sale, owed to the
--    referrer. Auto-created by the trigger below; amount is CONFIGURABLE
--    (stamped from app_settings default, editable per-credit in the UI).
--    unique(sale_id) makes the auto-flag idempotent — one credit per sale.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.referral_credits (
  id                  uuid primary key default gen_random_uuid(),
  referrer_id         uuid not null references public.partners(id) on delete cascade,
  referred_partner_id uuid not null references public.partners(id) on delete cascade,
  sale_id             uuid references public.sales(id) on delete set null,
  amount              numeric not null default 0,   -- 0 = placeholder "set amount"
  status              text not null default 'unpaid'
                        check (status in ('unpaid','paid')),
  note                text,
  created_at          timestamptz not null default now(),
  paid_at             timestamptz,
  unique (sale_id)
);

create index if not exists idx_referral_credits_referrer on public.referral_credits(referrer_id);
create index if not exists idx_referral_credits_status on public.referral_credits(status);

-- ─────────────────────────────────────────────────────────────
-- 4) APP SETTINGS — tiny key/value config. Holds the default referral credit.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.app_settings (
  key        text primary key,
  value      numeric,
  updated_at timestamptz not null default now()
);

-- Seed the default referral credit as a placeholder (0 = "not decided yet").
insert into public.app_settings (key, value)
values ('referral_credit_default', 0)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────
-- 5) AUTO-FLAG TRIGGER — when a sale is logged for a partner who was
--    referred_by someone, create a referral credit owed to that referrer.
--    security definer so it can read settings and write the credit regardless
--    of who inserted the sale. Idempotent via the unique(sale_id) constraint.
-- ─────────────────────────────────────────────────────────────
create or replace function public.flag_referral_credit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer uuid;
  v_default  numeric;
begin
  -- Who (if anyone) referred the partner that made this sale?
  select referred_by into v_referrer
  from public.partners
  where id = new.partner_id;

  -- No referrer → nothing to flag.
  if v_referrer is null then
    return new;
  end if;

  -- Don't credit a partner for their own sale (guards against a self-referral row).
  if v_referrer = new.partner_id then
    return new;
  end if;

  select coalesce(value, 0) into v_default
  from public.app_settings
  where key = 'referral_credit_default';

  insert into public.referral_credits
    (referrer_id, referred_partner_id, sale_id, amount, status)
  values
    (v_referrer, new.partner_id, new.id, coalesce(v_default, 0), 'unpaid')
  on conflict (sale_id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_flag_referral_credit on public.sales;
create trigger trg_flag_referral_credit
  after insert on public.sales
  for each row execute function public.flag_referral_credit();

-- ─────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY — admin-only, mirroring the rest of the schema.
-- ─────────────────────────────────────────────────────────────
alter table public.sales            enable row level security;
alter table public.referral_credits enable row level security;
alter table public.app_settings     enable row level security;

drop policy if exists sales_admin_all on public.sales;
create policy sales_admin_all on public.sales
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists referral_credits_admin_all on public.referral_credits;
create policy referral_credits_admin_all on public.referral_credits
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists app_settings_admin_all on public.app_settings;
create policy app_settings_admin_all on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- ════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCRIPT:
--   • Tag a referral:  Dashboard → Partners → Edit a partner → "Referred by".
--   • Set the payout:  Dashboard → Referrals → "Default referral credit"
--                      (or: update public.app_settings set value = <amount>
--                            where key = 'referral_credit_default';)
--   • Log a sale:      Dashboard → Referrals → "Log a sale". If that partner was
--                      referred, a credit for the referrer appears under
--                      "Referral credits owed" automatically.
-- ════════════════════════════════════════════════════════════════════
