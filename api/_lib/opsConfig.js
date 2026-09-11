// ════════════════════════════════════════════════════════════════════
// Shared config for the two team-operable ops automations
// (kit-less partner alert + quiz-not-done nudge).
//
// Every knob is an OPTIONAL env var with a sensible default, so the
// automations work out of the box and the team can tune them in
// Vercel → Settings → Environment Variables WITHOUT a code change.
// ════════════════════════════════════════════════════════════════════

function intEnv(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  const n = parseInt(raw, 10)
  return Number.isFinite(n) && n >= 0 ? n : fallback
}

// A feature flag is ON unless it's explicitly set to a falsy string. So
// leaving it unset = enabled; set to "false"/"0"/"off"/"no" to disable.
function boolEnv(name, fallback) {
  const raw = process.env[name]
  if (raw == null || raw === '') return fallback
  return !['false', '0', 'off', 'no'].includes(String(raw).trim().toLowerCase())
}

// Authorize a scheduled/manual call the same way the tracking cron does:
// Vercel attaches `Authorization: Bearer <CRON_SECRET>` to scheduled runs.
export function authorizedCron(req) {
  const secret = process.env.CRON_SECRET || ''
  if (!secret) return false
  const header = req.headers.authorization || req.headers.Authorization || ''
  return header === `Bearer ${secret}`
}

export function isDryRun() {
  return String(process.env.DRY_RUN || '').toLowerCase() === 'true'
}

// Base URL used to build each partner's portal link in the quiz reminder.
export function portalBaseUrl() {
  return (process.env.PORTAL_BASE_URL || 'https://planet-portal-bay.vercel.app').replace(/\/+$/, '')
}

export function partnerPortalUrl(selectToken) {
  return `${portalBaseUrl()}/partner/${selectToken}`
}

// ── Automation 1: kit-less partner alert ─────────────────────────────
export const kitlessConfig = () => ({
  enabled: boolEnv('KITLESS_ALERT_ENABLED', true),
  days: intEnv('KITLESS_ALERT_DAYS', 5), // flag after this many days with no box shipped
})

// ── Automation 2: quiz-not-done nudge ────────────────────────────────
export const quizNudgeConfig = () => ({
  enabled: boolEnv('QUIZ_NUDGE_ENABLED', true),
  days: intEnv('QUIZ_NUDGE_DAYS', 4), // nudge after this many days with no quiz
  // Which partner statuses count as "was sent their portal link". Comma-list.
  statuses: (process.env.QUIZ_NUDGE_STATUSES || 'Active Partner,Interested')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
})

// ── Automation 3: purchase-pending flag ──────────────────────────────
// No day threshold — the moment a kit's marked Returned with a kept piece
// that has no purchase_amount, that's already something to act on.
export const purchasePendingConfig = () => ({
  enabled: boolEnv('PURCHASE_PENDING_ENABLED', true),
})
