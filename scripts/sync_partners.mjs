#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// Hands-off sync: pushes scripts/partners_data.json into Supabase.
//
//   npm run sync:partners
//
// Uses the SERVICE ROLE key (bypasses RLS) to upsert partners, kits, and
// kit_pieces idempotently — same deterministic UUIDs / onConflict behavior
// as scripts/update_partners.sql. Safe to re-run.
//
// Credentials are read from local env files (never hardcoded):
//   • SUPABASE_SERVICE_ROLE_KEY  → .env.local        (server-only secret)
//   • VITE_SUPABASE_URL          → .env/.env (or .env / process.env)
//
// Does NOT touch frontend, auth, or RLS policies.
// ════════════════════════════════════════════════════════════════════

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

// ── Minimal .env parser (no dependency). Returns {KEY: value}. ─────────
function parseEnvFile(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return {} // file absent — fine, we try other locations
  }
  const out = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const eq = line.indexOf('=')
    if (eq === -1) continue
    let key = line.slice(0, eq).trim().replace(/^export\s+/, '')
    let val = line.slice(eq + 1).trim()
    // strip surrounding single or double quotes
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    out[key] = val
  }
  return out
}

// Merge env from the quirky layout: .env.local, the .env directory's file,
// a plain .env file if it exists, then the real process env (highest win).
const fileEnv = {
  ...parseEnvFile(join(root, '.env')), // only if .env is actually a file
  ...parseEnvFile(join(root, '.env', '.env')), // the directory case
  ...parseEnvFile(join(root, '.env.local')),
}
function env(name) {
  return process.env[name] ?? fileEnv[name]
}

const SUPABASE_URL = env('VITE_SUPABASE_URL') || env('SUPABASE_URL')
const SERVICE_ROLE_KEY = env('SUPABASE_SERVICE_ROLE_KEY')

function fail(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

if (!SUPABASE_URL) {
  fail('Missing VITE_SUPABASE_URL (looked in .env/.env, .env, .env.local, process.env).')
}
if (!SERVICE_ROLE_KEY) {
  fail(
    'Missing SUPABASE_SERVICE_ROLE_KEY in .env.local. Add it from ' +
      'Supabase → Project Settings → API → service_role secret.'
  )
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ── Load data ─────────────────────────────────────────────────────────
const data = JSON.parse(readFileSync(join(__dirname, 'partners_data.json'), 'utf8'))
const { partners, kits, kit_pieces } = data

async function main() {
  console.log(`→ Supabase: ${SUPABASE_URL}`)
  console.log(
    `→ Source:   scripts/partners_data.json ` +
      `(${partners.length} partners, ${kits.length} kits, ${kit_pieces.length} pieces)\n`
  )

  // 1) PARTNERS — conflict on email; only name+status+platform sent, so we
  //    never clobber instagram / commission_link / partner_message.
  //    (Requires the `platform` column — run scripts/add_platform_column.sql once.)
  {
    const { error } = await supabase
      .from('partners')
      .upsert(partners, { onConflict: 'email' })
    if (error) fail(`partners upsert failed: ${error.message}`)
    console.log(`✓ partners upserted (${partners.length})`)
  }

  // Resolve email → partner_id (partner ids may pre-exist with other UUIDs).
  const { data: partnerRows, error: selErr } = await supabase
    .from('partners')
    .select('id,email')
  if (selErr) fail(`partner re-select failed: ${selErr.message}`)
  const idByEmail = new Map(partnerRows.map((p) => [p.email.toLowerCase(), p.id]))

  // 2) KITS — attach resolved partner_id, conflict on id.
  const kitRows = kits.map((k) => {
    const partner_id = idByEmail.get(k.partner_email.toLowerCase())
    if (!partner_id) fail(`no partner row for kit ${k.id} (${k.partner_email})`)
    const { partner_email, ...rest } = k
    return { ...rest, partner_id }
  })
  {
    const { error } = await supabase.from('kits').upsert(kitRows, { onConflict: 'id' })
    if (error) fail(`kits upsert failed: ${error.message}`)
    console.log(`✓ kits upserted (${kitRows.length})`)
  }

  // 3) KIT PIECES — conflict on id. Normalize purchase_amount and
  //    purchase_status so every row carries both columns (null = unset):
  //    keeps the bulk upsert's column set consistent and round-trips
  //    kept-item sale prices + payment status from the JSON.
  {
    const pieceRows = kit_pieces.map((pc) => ({
      purchase_amount: null,
      purchase_status: null,
      ...pc,
    }))
    const { error } = await supabase
      .from('kit_pieces')
      .upsert(pieceRows, { onConflict: 'id' })
    if (error) fail(`kit_pieces upsert failed: ${error.message}`)
    console.log(`✓ kit_pieces upserted (${pieceRows.length})`)
  }

  // ── Verify straight from the DB (authoritative) ─────────────────────
  const [{ count: partnerCount }, { count: kitCount }, { count: pieceCount }] =
    await Promise.all([
      supabase.from('partners').select('*', { count: 'exact', head: true }),
      supabase.from('kits').select('*', { count: 'exact', head: true }),
      supabase.from('kit_pieces').select('*', { count: 'exact', head: true }),
    ])

  // pieces-per-partner via the deterministic kit ids in our data
  const { data: dbPieces, error: pErr } = await supabase
    .from('kit_pieces')
    .select('kit_id')
  if (pErr) fail(`verify select failed: ${pErr.message}`)
  const piecesByKit = new Map()
  for (const row of dbPieces) {
    piecesByKit.set(row.kit_id, (piecesByKit.get(row.kit_id) || 0) + 1)
  }

  console.log('\n──────────── SYNC SUMMARY ────────────')
  console.log(`Partners in DB: ${partnerCount}`)
  console.log(`Kits in DB:     ${kitCount}`)
  console.log(`Pieces in DB:   ${pieceCount}`)
  console.log('\nPieces per partner (synced kits):')
  const counts = []
  for (const k of kits) {
    const name = partners.find((p) => p.email === k.partner_email)?.name || k.partner_email
    const n = piecesByKit.get(k.id) || 0
    counts.push(n)
    console.log(`  ${String(n).padStart(2)}  ${name}`)
  }
  console.log(`\nSequence: ${counts.join(',')} = ${counts.reduce((a, b) => a + b, 0)} pieces`)
  console.log('──────────────────────────────────────\n')
  console.log('✓ Sync complete.')
}

main().catch((e) => fail(e?.stack || String(e)))
