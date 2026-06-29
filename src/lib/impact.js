import { supabase } from './supabase'

// Fetches aggregate Impact.com affiliate performance for the admin Overview
// from our serverless function, which talks to Impact with the secret keys.
// Returns { connected, sales, orders, commission, clicks, recentActions }.
export async function fetchImpactSummary() {
  const {
    data: { session },
  } = await supabase.auth.getSession()

  const headers = {}
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`

  const resp = await fetch('/api/impact', { headers })

  if (!resp.ok) {
    let detail = ''
    try {
      detail = (await resp.json())?.error || ''
    } catch {
      /* ignore */
    }
    throw new Error(detail || `Impact lookup failed (${resp.status})`)
  }

  return resp.json()
}
