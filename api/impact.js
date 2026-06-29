// ════════════════════════════════════════════════════════════════════
// Vercel Serverless Function: GET /api/impact
//
// Returns aggregate Impact.com (Advertiser API) affiliate performance for
// the admin Overview: total sales, orders, commission, clicks, and the most
// recent conversions. The Impact credentials never leave the server.
//
// Required Vercel env vars (Settings → Environment Variables):
//   IMPACT_ACCOUNT_SID   (Impact Advertiser account SID — Basic-auth username)
//   IMPACT_AUTH_TOKEN    (Impact auth token — Basic-auth password)
//
// If either is missing, responds 200 { connected: false } (never throws) so
// the dashboard shows a tasteful "connect Impact" state instead of an error.
//
// Response shape:
//   { connected, sales, orders, commission, clicks,
//     recentActions: [{ date, partner, amount, status }] }
// ════════════════════════════════════════════════════════════════════

const IMPACT_BASE = 'https://api.impact.com'

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sid = process.env.IMPACT_ACCOUNT_SID
  const token = process.env.IMPACT_AUTH_TOKEN

  // Graceful "not connected" — checked FIRST (before any auth), so the
  // dashboard renders a friendly prompt before credentials exist and this
  // path leaks nothing.
  if (!sid || !token) {
    return res.status(200).json({
      connected: false,
      message:
        'Impact is not connected yet. Add IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN in Vercel to see live affiliate performance.',
    })
  }

  // Require an authenticated Supabase session (this is admin-only data).
  // Reuses the same Supabase env (with VITE fallbacks) as /api/commissions.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
  const authHeader = req.headers.authorization || ''
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!bearer || !supabaseUrl) {
    return res.status(401).json({ error: 'Not authenticated' })
  }
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { Authorization: `Bearer ${bearer}`, apikey: supabaseKey || bearer },
    })
    if (!userResp.ok) return res.status(401).json({ error: 'Invalid session' })
  } catch {
    return res.status(401).json({ error: 'Auth check failed' })
  }

  // Auth: impact.com uses HTTP Basic auth — username = Account SID,
  // password = the (scoped) Auth/Access Token — NOT a Bearer token.
  const basic = 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64')
  // API version: scoped access tokens are pinned to a version, but the request
  // must still declare it. impact.com versions via the `IR-Version` header
  // (or `IrVersion` query param); the value is the integer version number
  // ("14"), not the release date.
  const impactHeaders = {
    Authorization: basic,
    Accept: 'application/json',
    'IR-Version': '14',
  }

  // Rolling 30-day window.
  const end = new Date()
  const start = new Date(end.getTime() - 30 * 86400000)
  const stamp = (d) => d.toISOString().slice(0, 19) + 'Z' // YYYY-MM-DDTHH:MM:SSZ
  const day = (d) => d.toISOString().slice(0, 10) // YYYY-MM-DD

  try {
    // ── Conversions (Actions) → sales, orders, commission, recent activity ──
    // Impact's Actions endpoint (Advertiser API) filters EventDate via
    // ActionDateStart/ActionDateEnd, both requiring a FULL ISO-8601 datetime
    // with time + timezone (e.g. 2026-06-29T00:00:00Z) — a bare YYYY-MM-DD is
    // rejected. stamp() already yields that. The span must be ≤ 45 days (ours
    // is 30).
    //
    // PageSize: Impact enforces a MINIMUM page size of 2,000 (default 20,000).
    // Sending PageSize=100 is below that floor and is rejected with HTTP 400.
    // 2000 is the smallest accepted value and is plenty for a 30-day window.
    // (Page is 1-based.)
    //
    // Build params via URLSearchParams and only append values that are
    // non-empty — Impact rejects blank filter params (e.g. an empty CampaignId
    // → {"Status":"ERROR","Message":"Parameter 'CampaignId' has invalid value
    // ''"}). We never send blank Status/SubId/CampaignId.
    const actionsParams = new URLSearchParams({
      ActionDateStart: stamp(start),
      ActionDateEnd: stamp(end),
      PageSize: '2000',
      Page: '1',
    })
    // Optional program scoping: set IMPACT_CAMPAIGN_ID in Vercel to restrict to
    // one Impact program/campaign (PLANET's is 54491). When unset we OMIT the
    // CampaignId param entirely — that returns actions across the whole
    // advertiser account, which is the default we want. Never sent when blank.
    const campaignId = (process.env.IMPACT_CAMPAIGN_ID || '').trim()
    if (campaignId) actionsParams.set('CampaignId', campaignId)

    const actionsUrl = `${IMPACT_BASE}/Advertisers/${sid}/Actions?${actionsParams.toString()}`
    const actionsResp = await fetch(actionsUrl, { headers: impactHeaders })
    if (!actionsResp.ok) {
      // Surface the REAL cause: Impact's HTTP status + the start of its
      // response body. console.error so it also lands in the Vercel logs.
      const body = (await actionsResp.text().catch(() => '')).slice(0, 300)
      console.error(
        `Impact Actions request failed: ${actionsResp.status} ${actionsResp.statusText} — ${body}`
      )
      return res.status(502).json({
        connected: true,
        error: `Impact Actions request failed (HTTP ${actionsResp.status})`,
        detail: body,
      })
    }
    const actionsData = await actionsResp.json()
    const actions = Array.isArray(actionsData?.Actions) ? actionsData.Actions : []

    let sales = 0
    let commission = 0
    for (const a of actions) {
      sales += num(a.Amount)
      commission += num(a.Payout)
    }
    // Prefer the API's total count across pages; fall back to this page's length.
    const orders = num(actionsData['@total']) || actions.length

    const recentActions = actions
      .slice()
      .sort(
        (a, b) =>
          new Date(b.EventDate || b.CreationDate || 0) -
          new Date(a.EventDate || a.CreationDate || 0)
      )
      .slice(0, 8)
      .map((a) => ({
        date: String(a.EventDate || a.CreationDate || '').slice(0, 10),
        partner: a.MediaPartnerName || a.CampaignName || a.ActionTrackerName || '—',
        amount: num(a.Amount),
        status: a.State || '—',
      }))

    // ── Clicks (best-effort advertiser performance report) ──
    // Report IDs/columns vary by account; if this isn't available we simply
    // leave clicks at 0 rather than failing the whole response.
    let clicks = 0
    try {
      const reportUrl =
        `${IMPACT_BASE}/Advertisers/${sid}/Reports/adv_performance_by_day` +
        `?START_DATE=${day(start)}&END_DATE=${day(end)}&PageSize=365`
      const rResp = await fetch(reportUrl, { headers: impactHeaders })
      if (rResp.ok) {
        const rData = await rResp.json()
        const records = rData?.Records || rData?.records || []
        for (const rec of records) {
          clicks += num(rec.Clicks ?? rec.clicks ?? rec.CLICKS)
        }
      }
    } catch {
      /* clicks are best-effort */
    }

    return res.status(200).json({
      connected: true,
      sales,
      orders,
      commission,
      clicks,
      recentActions,
    })
  } catch (err) {
    console.error('Impact request error:', err)
    return res.status(502).json({
      connected: true,
      error: 'Impact request error',
      detail: String(err).slice(0, 300),
    })
  }
}
