// ════════════════════════════════════════════════════════════════════
// Vercel Serverless Function: GET /api/cron/purchase-pending
//
// TEAM-OPERABLE automation #3 — runs on Vercel cron (see vercel.json), NOT
// off anyone's machine. Finds Returned kits where a piece was marked "Keep"
// but never got a purchase_amount — i.e. the partner kept something and
// still needs a purchase call (collect card info, log the sale). Raises a
// RED "Purchase needed" flag in public.ops_alerts, distinct from the amber
// kit-less / teal quiz-not-done alerts so it doesn't blend in.
//
// Auto-resolves once purchase_amount is set on the piece (or it's no longer
// marked Keep) — same idempotent pattern as the other two automations.
//
// Protected by CRON_SECRET (Vercel attaches Authorization: Bearer <CRON_SECRET>).
// Run manually:  curl -H "Authorization: Bearer <CRON_SECRET>" \
//                     https://planet-portal-bay.vercel.app/api/cron/purchase-pending
// Disable:  set PURCHASE_PENDING_ENABLED=false, or remove the cron from vercel.json.
//
// Requires the `purchase_pending` value to be allowed by ops_alerts' type
// check constraint — see supabase/ops_purchase_pending.sql (one-time SQL
// Editor paste, same as the other ops_alerts migrations).
//
// Note: ops_alerts is unique on (type, partner_id), so if a partner somehow
// has two different kept-unpaid pieces at once, only the most-recently-seen
// one appears in the message — rare enough not to special-case.
//
// Env (all server-only, all optional except CRON_SECRET + SUPABASE_*):
//   CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//   PURCHASE_PENDING_ENABLED (default true), DRY_RUN (default off).
// ════════════════════════════════════════════════════════════════════

import {
  isSupabaseAdminConfigured,
  getKeptUnpaidPieces,
  upsertOpsAlert,
  listOpenOpsAlerts,
  resolveOpsAlerts,
} from '../_lib/supabaseAdmin.js'
import { authorizedCron, isDryRun, purchasePendingConfig } from '../_lib/opsConfig.js'

const ALERT_TYPE = 'purchase_pending'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }
  if (!authorizedCron(req)) return res.status(401).json({ error: 'Unauthorized' })

  const cfg = purchasePendingConfig()
  if (!cfg.enabled) return res.status(200).json({ ok: true, enabled: false })
  if (!isSupabaseAdminConfigured()) {
    return res.status(200).json({ ok: false, configured: false })
  }

  const summary = { checked: 0, flagged: 0, resolved: 0, errors: 0 }
  const flaggedList = []

  try {
    const pieces = await getKeptUnpaidPieces()
    summary.checked = pieces.length
    const stillPending = new Set()

    for (const piece of pieces) {
      const kit = piece.kit
      const partner = kit?.partner
      if (!partner) continue

      stillPending.add(partner.id)
      const label = `${piece.piece_name}${piece.color ? ` (${piece.color})` : ''}`
      flaggedList.push(`${partner.name || partner.email}: ${label}`)

      if (isDryRun()) {
        console.log(`[DRY_RUN] Would flag purchase-pending: ${partner.name || partner.email} kept ${label}`)
        continue
      }

      try {
        await upsertOpsAlert({
          type: ALERT_TYPE,
          partner_id: partner.id,
          partner_name: partner.name || null,
          partner_email: (partner.email || '').toLowerCase() || null,
          message: `${partner.name || partner.email} kept ${label} — needs a purchase call to collect payment.`,
          details: {
            piece: piece.piece_name,
            color: piece.color || null,
            kit_id: kit.id,
            outcome: 'needs_manual',
          },
          status: 'open',
        })
        summary.flagged++
      } catch (err) {
        summary.errors++
        console.error(`purchase-pending: failed to flag ${partner.email}: ${err.message}`)
      }
    }

    // Auto-resolve open alerts for partners whose kept piece since got a
    // purchase_amount (call happened) or is no longer marked Keep.
    if (!isDryRun()) {
      try {
        const open = await listOpenOpsAlerts(ALERT_TYPE)
        const stale = open.filter((a) => a.partner_id && !stillPending.has(a.partner_id)).map((a) => a.id)
        summary.resolved = await resolveOpsAlerts(stale)
      } catch (err) {
        console.error(`purchase-pending: resolve pass failed: ${err.message}`)
      }
    }

    console.log(
      `purchase-pending: ${summary.flagged} flagged / ${summary.checked} kept-unpaid pieces checked ` +
        `(${isDryRun() ? 'DRY_RUN' : 'live'}).` +
        (flaggedList.length ? ` → ${flaggedList.join('; ')}` : '')
    )
    return res.status(200).json({ ok: true, dryRun: isDryRun(), flagged: flaggedList, ...summary })
  } catch (err) {
    console.error('purchase-pending error:', err.message)
    return res.status(500).json({ ok: false, error: err.message, ...summary })
  }
}
