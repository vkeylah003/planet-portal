import { supabase } from './supabase'

// Loads a partner's home payload from their private-link token via the
// get_partner_by_token security-definer RPC. Returns { partner, kit, pieces }
// or null if the token doesn't match a partner.
export async function fetchPartnerByToken(token) {
  const { data, error } = await supabase.rpc('get_partner_by_token', {
    p_token: token,
  })
  if (error) throw new Error(error.message)
  return data // null when the token is invalid
}

// Submits the partner's selected pieces via the token-validated RPC. The
// server stamps the row with the correct partner, so the anon client can
// only ever submit as itself. `shipping` is the ship-to address object
// ({name,line1,line2,city,state,zip}) or null. Returns the new selection id.
export async function submitSelection(token, items, note, shipping) {
  const { data, error } = await supabase.rpc('submit_partner_selection', {
    p_token: token,
    p_items: items,
    p_note: note || null,
    p_shipping: shipping || null,
  })
  if (error) throw new Error(error.message)
  return data
}

// Fetches this partner's commission summary from the serverless function,
// identified by their token (the GoAffPro admin token stays server-side).
// Returns { configured, found, message, earnings? } — same shape the old
// session-based endpoint used, so the Earnings UI is unchanged.
export async function fetchCommissionsByToken(token) {
  const resp = await fetch(`/api/commissions?token=${encodeURIComponent(token)}`)
  if (!resp.ok) {
    let detail = ''
    try {
      detail = (await resp.json())?.error || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Commission lookup failed (${resp.status})`)
  }
  return resp.json()
}
