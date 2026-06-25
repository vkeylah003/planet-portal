// ════════════════════════════════════════════════════════════════════
// Vercel Serverless Function: GET /api/commissions
//
// Returns the authenticated partner's GoAffPro commission summary.
// The GoAffPro *admin* access token never leaves the server, so partners
// can't see each other's data and the token is never shipped to browsers.
//
// Flow:
//   1. Read the partner's Supabase access token from the Authorization header.
//   2. Ask Supabase who that token belongs to → get their email.
//   3. Look that email up in GoAffPro's admin affiliate list (server-side).
//   4. Return only that partner's earnings.
//
// Required Vercel env vars (Settings → Environment Variables):
//   GOAFFPRO_ACCESS_TOKEN   (admin token from GoAffPro → Settings → API Keys)
//   GOAFFPRO_PUBLIC_TOKEN   (the public token)
//   SUPABASE_URL            (your project URL)
// ════════════════════════════════════════════════════════════════════

const GOAFFPRO_BASE = 'https://api.goaffpro.com/v1'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const accessToken = process.env.GOAFFPRO_ACCESS_TOKEN
  const publicToken = process.env.GOAFFPRO_PUBLIC_TOKEN
  // Fall back to the VITE_ vars that are already set in Vercel for the frontend.
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY

  // Graceful "not configured" response so the UI can show a friendly note
  // instead of an error before you've added the GoAffPro admin token. Only the
  // admin access token is required; the public token is optional.
  if (!accessToken) {
    return res.status(200).json({
      configured: false,
      message:
        'Commission data is not connected yet. Add GOAFFPRO_ACCESS_TOKEN in Vercel to enable it.',
    })
  }

  try {
    // 1 + 2: identify the partner from their Supabase session.
    const authHeader = req.headers.authorization || ''
    const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!bearer || !supabaseUrl) {
      return res.status(401).json({ error: 'Not authenticated' })
    }

    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: `Bearer ${bearer}`,
        // Supabase's GoTrue endpoint requires an apikey header. Prefer the
        // anon key when configured; the user's JWT also works as a fallback.
        apikey: supabaseKey || bearer,
      },
    })

    if (!userResp.ok) {
      return res.status(401).json({ error: 'Invalid session' })
    }
    const user = await userResp.json()
    const email = (user?.email || '').toLowerCase()
    if (!email) {
      return res.status(401).json({ error: 'No email on session' })
    }

    // 3: fetch affiliates from GoAffPro admin API and match by email.
    const affHeaders = { 'x-goaffpro-access-token': accessToken }
    // The public token is optional — only send it when configured.
    if (publicToken) affHeaders['x-goaffpro-public-token'] = publicToken

    const affResp = await fetch(
      `${GOAFFPRO_BASE}/admin/affiliates?fields=id,email,balance,unpaid_commissions,paid_commissions,total_commissions,total_sales,orders_count`,
      { headers: affHeaders }
    )

    if (!affResp.ok) {
      const text = await affResp.text()
      return res
        .status(502)
        .json({ error: 'GoAffPro request failed', detail: text.slice(0, 300) })
    }

    const data = await affResp.json()
    const list = Array.isArray(data) ? data : data.affiliates || []
    const me = list.find((a) => (a.email || '').toLowerCase() === email)

    if (!me) {
      return res.status(200).json({
        configured: true,
        found: false,
        message: 'No GoAffPro affiliate account is linked to this email yet.',
      })
    }

    // 4: return only this partner's earnings.
    return res.status(200).json({
      configured: true,
      found: true,
      earnings: {
        balance: Number(me.balance || 0),
        unpaid: Number(me.unpaid_commissions || 0),
        paid: Number(me.paid_commissions || 0),
        total: Number(me.total_commissions || me.balance || 0),
        sales: Number(me.total_sales || 0),
        orders: Number(me.orders_count || 0),
      },
    })
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err).slice(0, 300) })
  }
}
