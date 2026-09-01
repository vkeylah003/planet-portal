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

// The Shopify storefront that honors affiliate links/coupons. Override with
// AFFILIATE_STORE_URL in Vercel if the referral domain ever changes.
const STORE_URL = (process.env.AFFILIATE_STORE_URL || 'https://shopplanetbylaureng.com')
  .replace(/\/+$/, '')

// Build a partner's shareable referral link from their GoAffPro affiliate
// object. PLANET's affiliates are coupon-based (no ref_id), so the link is a
// Shopify /discount/<CODE> URL that auto-applies their code at checkout. We
// still prefer a ref_id link if one ever exists. Returns { link, coupon } or
// null when the affiliate has neither.
function buildAffiliate(me) {
  // GoAffPro's real field is `ref_code`, not `ref_id` (there is no `ref_id`
  // field in their API — this was a bug: a field that never existed always
  // read as undefined, so this branch never fired even for affiliates that
  // do have a referral code).
  const refCode = (me?.ref_code || '').toString().trim()
  const coupon = (me?.coupon?.code || '').toString().trim()
  if (refCode) {
    return { link: `${STORE_URL}/?ref=${encodeURIComponent(refCode)}`, coupon: coupon || null }
  }
  if (coupon) {
    return { link: `${STORE_URL}/discount/${encodeURIComponent(coupon)}`, coupon }
  }
  return null
}

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
    // 1 + 2: identify the partner. Two supported modes:
    //   (a) Private-link token  → ?token=…  (current partner pages)
    //   (b) Supabase session    → Authorization: Bearer …  (legacy/admin)
    const token = (req.query?.token || '').trim()
    let email = ''

    if (token) {
      // Resolve the partner's email from their token via the security-definer
      // RPC. The GoAffPro admin token still never leaves the server.
      if (!supabaseUrl || !supabaseKey) {
        return res.status(500).json({ error: 'Supabase not configured' })
      }
      const rpcResp = await fetch(`${supabaseUrl}/rest/v1/rpc/get_partner_by_token`, {
        method: 'POST',
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ p_token: token }),
      })
      if (rpcResp.ok) {
        const payload = await rpcResp.json()
        email = (payload?.partner?.email || '').toLowerCase()
      }
      if (!email) {
        // Unknown token → no earnings, but don't leak whether it exists.
        return res.status(200).json({
          configured: true,
          found: false,
          message: 'No commission account is linked to this partner yet.',
        })
      }
    } else {
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
      email = (user?.email || '').toLowerCase()
      if (!email) {
        return res.status(401).json({ error: 'No email on session' })
      }
    }

    // 3: fetch affiliates from GoAffPro admin API and match by email.
    const affHeaders = { 'x-goaffpro-access-token': accessToken }
    // The public token is optional — only send it when configured.
    if (publicToken) affHeaders['x-goaffpro-public-token'] = publicToken

    // Field names must match GoAffPro's actual Affiliate schema (verified
    // against their live API docs at https://api.goaffpro.com/docs/admin/ —
    // fields like `balance`/`unpaid_commissions`/`paid_commissions`/
    // `total_commissions`/`total_sales`/`orders_count`/`ref_id` DO NOT EXIST
    // and previously silently returned undefined for every affiliate).
    const affResp = await fetch(
      `${GOAFFPRO_BASE}/admin/affiliates?fields=id,email,ref_code,coupon,total_referral_earnings,total_network_earnings,total_amount_paid,total_amount_pending,total_other_earnings,number_of_orders`,
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

    // 4: return this partner's earnings + their shareable affiliate link.
    // `total_amount_pending` is GoAffPro's own "amount due" figure (matches
    // what the admin sees on the affiliate's Payments tab), so that's what we
    // surface as both the headline "balance" and "unpaid" — there are two UI
    // labels for the same real number. `total` sums every earnings bucket
    // GoAffPro tracks (referral + MLM/network + other one-off rewards).
    const pending = Number(me.total_amount_pending || 0)
    const paid = Number(me.total_amount_paid || 0)
    const total =
      Number(me.total_referral_earnings || 0) +
      Number(me.total_network_earnings || 0) +
      Number(me.total_other_earnings || 0)

    // "sales" is deliberately a COUNT, not a dollar figure — showing the raw
    // order revenue (e.g. $1,003.49) right next to her much smaller actual
    // commission ($185.40) reads as misleading, as if that bigger number were
    // what she's owed. `number_of_orders` is GoAffPro's own count of referral
    // orders, so sales and orders are intentionally the same count here.
    const orderCount = Number(me.number_of_orders || 0)

    return res.status(200).json({
      configured: true,
      found: true,
      affiliate: buildAffiliate(me),
      earnings: {
        balance: pending,
        unpaid: pending,
        paid,
        total,
        sales: orderCount,
        orders: orderCount,
      },
    })
  } catch (err) {
    return res.status(500).json({ error: 'Server error', detail: String(err).slice(0, 300) })
  }
}
