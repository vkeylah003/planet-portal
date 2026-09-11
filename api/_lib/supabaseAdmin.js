// ════════════════════════════════════════════════════════════════════
// Server-side Supabase access for the shipment-tracking pipeline.
//
// The webhook and cron run with NO user session, but they must WRITE to the
// `kits` table — which RLS locks to admins only. So these helpers use the
// Supabase SERVICE ROLE key (server-only, never shipped to the browser),
// which bypasses RLS. We talk to PostgREST directly with `fetch` to match the
// rest of /api (no supabase-js dependency needed server-side).
//
// Required env (all server-only, no VITE_ prefix):
//   SUPABASE_URL                (falls back to VITE_SUPABASE_URL)
//   SUPABASE_SERVICE_ROLE_KEY
// ════════════════════════════════════════════════════════════════════

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/+$/,
  ''
)
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

export function isSupabaseAdminConfigured() {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

function restHeaders(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

async function rest(path, init = {}) {
  if (!isSupabaseAdminConfigured()) {
    throw new Error('Supabase service role not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: restHeaders(init.headers),
  })
  if (!resp.ok) {
    const body = (await resp.text().catch(() => '')).slice(0, 400)
    throw new Error(`Supabase REST ${resp.status} on ${path}: ${body}`)
  }
  // 204 (no content) on some PATCH/DELETE — guard the JSON parse.
  const text = await resp.text()
  return text ? JSON.parse(text) : null
}

// Embed the owning partner (name + email) so the follow-up step has what it
// needs in one round-trip.
const KIT_SELECT = 'select=*,partner:partners(id,name,email)'

// A single kit + its partner, or null.
export async function getKitById(id) {
  const rows = await rest(`kits?${KIT_SELECT}&id=eq.${encodeURIComponent(id)}&limit=1`)
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// Find the kit a webhook event belongs to: prefer AfterShip's tracking id,
// fall back to the raw tracking number.
export async function getKitByTracking({ aftershipId, trackingNumber }) {
  if (aftershipId) {
    const rows = await rest(
      `kits?${KIT_SELECT}&aftership_tracking_id=eq.${encodeURIComponent(aftershipId)}&limit=1`
    )
    if (Array.isArray(rows) && rows.length) return rows[0]
  }
  if (trackingNumber) {
    const rows = await rest(
      `kits?${KIT_SELECT}&tracking_number=eq.${encodeURIComponent(trackingNumber)}&order=created_at.desc&limit=1`
    )
    if (Array.isArray(rows) && rows.length) return rows[0]
  }
  return null
}

// All shipments the cron should reconcile: have a tracking number, not yet
// delivered. Embeds the partner for the follow-up step.
export async function getActiveShipments() {
  const rows = await rest(
    `kits?${KIT_SELECT}&tracking_number=not.is.null&delivery_status=neq.delivered&order=created_at.desc`
  )
  return Array.isArray(rows) ? rows : []
}

// Patch a kit and return the updated row (with partner embedded).
export async function patchKit(id, fields) {
  const rows = await rest(`kits?id=eq.${encodeURIComponent(id)}&${KIT_SELECT}`, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(fields),
  })
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// Is this Supabase user id an admin? Used to gate the create-tracking route.
export async function isAdminUser(userId) {
  if (!userId) return false
  const rows = await rest(`admins?select=user_id&user_id=eq.${encodeURIComponent(userId)}&limit=1`)
  return Array.isArray(rows) && rows.length > 0
}

// ── Partners (used by the GoAffPro roster sync) ──────────────────────
// Only the columns the sync compares/writes — never the manually-managed
// ones (status, gifted, instagram, partner_message, notes), so we can't
// accidentally clobber them.
export async function listPartnersForSync() {
  const rows = await rest('partners?select=id,name,email,commission_link')
  return Array.isArray(rows) ? rows : []
}

// Bulk-insert brand-new partner rows. `select_token` is left unset so the
// column DEFAULT (gen_random_bytes) mints one automatically. Returns the
// inserted rows.
export async function insertPartners(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return []
  const inserted = await rest('partners', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify(rows),
  })
  return Array.isArray(inserted) ? inserted : []
}

// Patch a single existing partner (used to refresh GoAffPro-derived data
// like commission_link only — never manually-managed fields).
export async function patchPartner(id, fields) {
  return rest(`partners?id=eq.${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  })
}

// ── Ops automations (kit-less alert + quiz-not-done nudge) ───────────
// These read partners with their kits / selections embedded (one round-trip
// each via PostgREST FK embedding) so the cron can compute "has no shipped
// box" / "never did the quiz" in JS, and write flags to public.ops_alerts.

const enc = encodeURIComponent

// Active Partners with every kit embedded (status only) so the cron can tell
// who has never had a box SHIPPED (Preparing doesn't count — the box hasn't
// left yet). Includes the onboarding clock (link_sent_at, created_at).
export async function getActivePartnersWithKits() {
  const rows = await rest(
    `partners?select=id,name,email,status,created_at,link_sent_at,kits(status)` +
      `&status=eq.${enc('Active Partner')}`
  )
  return Array.isArray(rows) ? rows : []
}

// Partners in the given statuses with their selections embedded (id only) so
// the cron can tell who has never submitted the style quiz. Includes the
// select_token (to build the portal link) and the drafted-stamp (idempotency).
export async function getPartnersWithSelections(statuses) {
  const list = (statuses || []).map((s) => `"${s}"`).join(',')
  const rows = await rest(
    `partners?select=id,name,email,status,created_at,link_sent_at,select_token,` +
      `quiz_reminder_drafted_at,partner_selections(id)` +
      `&status=in.(${enc(list)})`
  )
  return Array.isArray(rows) ? rows : []
}

// Upsert one alert keyed on (type, partner_id) — idempotent re-flagging. Sets
// updated_at; created_at is left to the row default on first insert.
export async function upsertOpsAlert(alert) {
  const row = { ...alert, updated_at: new Date().toISOString() }
  const rows = await rest(`ops_alerts?on_conflict=type,partner_id`, {
    method: 'POST',
    headers: { Prefer: 'return=representation,resolution=merge-duplicates' },
    body: JSON.stringify(row),
  })
  return Array.isArray(rows) && rows.length ? rows[0] : null
}

// All currently-open alerts of a type (used to auto-resolve stale ones).
export async function listOpenOpsAlerts(type) {
  const rows = await rest(
    `ops_alerts?select=id,partner_id&type=eq.${enc(type)}&status=eq.open`
  )
  return Array.isArray(rows) ? rows : []
}

// Mark a set of alert ids resolved (the problem cleared — box shipped / quiz done).
export async function resolveOpsAlerts(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return 0
  await rest(`ops_alerts?id=in.(${ids.map(enc).join(',')})`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'resolved', updated_at: new Date().toISOString() }),
  })
  return ids.length
}

// ── Automation 3: purchase-pending flag ───────────────────────────────
// Kit pieces the partner decided to KEEP on a kit that's already been
// Returned, but that have no purchase_amount yet — i.e. someone still needs
// to call the partner, collect payment, and log what she paid. Embeds the
// owning kit (must be Returned) and partner so the cron can build a message
// and flag the right person.
export async function getKeptUnpaidPieces() {
  const rows = await rest(
    `kit_pieces?select=id,piece_name,color,purchase_amount,partner_decision,` +
      `kit:kits(id,status,partner:partners(id,name,email))` +
      `&partner_decision=eq.Keep&purchase_amount=is.null`
  )
  const list = Array.isArray(rows) ? rows : []
  return list.filter((r) => r.kit?.status === 'Returned' && r.kit?.partner)
}
