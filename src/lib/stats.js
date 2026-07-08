// Live internal metrics — computed client-side from the bundled data snapshots
// (no backend). Everything here is a pure function of scripts/partners_data.json
// (boxes + partners) and scripts/contacted_data.json (outreach roster), so it is
// recomputed fresh every time the Stats / EOD tabs mount and always reflects the
// data currently shipped in the app.
//
// The one metric NOT sourced here is the Daily Log (reels, DMs, goals) — those
// are manual, day-specific, and persisted in Supabase (see supabase/content_tracker.sql).
// The EOD draft below stitches the two together.

import partnersData from '../../scripts/partners_data.json'
import contactedData from '../../scripts/contacted_data.json'
import socialData from '../../scripts/social_posts.json'
import { catLabel } from './report'

// A contact counts as "replied / responded" once their status moves off the
// initial 'contacted' state — any other status (active, interested, declined,
// gifted, needs-follow-up, …) means they answered us in some way. contacted_data
// already carries a `status` field, so no new field was needed; 'contacted' is
// simply "reached out to, no response yet".
const NO_REPLY_STATUS = 'contacted'

export function computeOutreach() {
  const rows = contactedData.contacted || []
  const total = rows.length
  const byStatus = {}
  const byCategory = {}
  for (const r of rows) {
    const status = r.status || 'unknown'
    byStatus[status] = (byStatus[status] || 0) + 1
    const cat = r.category || 'uncategorized'
    byCategory[cat] = byCategory[cat] || { total: 0, replied: 0 }
    byCategory[cat].total += 1
    if (status !== NO_REPLY_STATUS) byCategory[cat].replied += 1
  }
  const replied = total - (byStatus[NO_REPLY_STATUS] || 0)
  const responseRate = total ? replied / total : 0
  // Category response rates (only meaningful for categories with a few contacts).
  const categoryRates = Object.entries(byCategory)
    .map(([key, v]) => ({ key, ...v, rate: v.total ? v.replied / v.total : 0 }))
    .sort((a, b) => b.rate - a.rate)
  return {
    total,
    replied,
    responseRate,
    byStatus,
    categoryRates,
    // contacted_data has no batch/template columns, so those breakdowns aren't
    // available — surfaced so the UI can say so rather than invent a split.
    supportsBatch: false,
    supportsTemplate: false,
  }
}

export function computeBoxes() {
  const kits = partnersData.kits || []
  const byStatus = {}
  for (const k of kits) byStatus[k.status] = (byStatus[k.status] || 0) + 1
  const g = (s) => byStatus[s] || 0
  const total = kits.length
  const preparing = g('Preparing')
  const shipped = total - preparing // every box that has actually left the building
  const delivered = g('Delivered')
  const returned = g('Returned')
  // Physically in a partner's hands right now (shipped/delivered, not yet back).
  const currentlyOut = g('Shipped') + g('Delivered') + g('Return Pending')
  const inTransit = g('Shipped')

  // Avg days-to-return needs an actual returned date. The bundled snapshot only
  // carries ship_date + return_by_date (the deadline), so unless a returned_at
  // is present we report this as "no data" rather than guessing from the window.
  const withReturnDates = kits.filter((k) => k.returned_at && k.ship_date)
  let avgDaysToReturn = null
  if (withReturnDates.length) {
    const totalDays = withReturnDates.reduce((sum, k) => {
      const ship = new Date(k.ship_date)
      const back = new Date(k.returned_at)
      return sum + Math.round((back - ship) / 86400000)
    }, 0)
    avgDaysToReturn = Math.round(totalDays / withReturnDates.length)
  }

  return {
    total,
    byStatus,
    preparing,
    shipped,
    delivered,
    inTransit,
    currentlyOut,
    returned,
    avgDaysToReturn,
    avgDaysCount: withReturnDates.length,
  }
}

export function computePartners() {
  const partners = partnersData.partners || []
  const byStatus = {}
  for (const p of partners) byStatus[p.status] = (byStatus[p.status] || 0) + 1
  const total = partners.length
  const onboarded = byStatus['Active Partner'] || 0
  return { total, onboarded, byStatus }
}

// Partner social posts featuring PLANET. Pure function of the bundled
// scripts/social_posts.json snapshot. Engagement counts are the visible IG
// numbers; a null count means it wasn't shown on the post (not zero), so it's
// excluded from totals rather than counted as 0. `views` is tracked as a
// first-class field but is null on every post today — we report both the sum
// (across posts that have a value) and how many posts still lack one, so the
// column reads honestly until Sofia fills the numbers in.
export function computeSocial() {
  const posts = socialData.posts || []
  const totalPosts = posts.length

  const sum = (key) => posts.reduce((s, p) => s + (p[key] || 0), 0)
  const totalLikes = sum('likes')
  const totalComments = sum('comments')
  const totalShares = sum('shares')
  const totalSends = sum('sends')

  // Views: only posts with a real number count toward the total.
  const withViews = posts.filter((p) => p.views !== null && p.views !== undefined)
  const totalViews = withViews.reduce((s, p) => s + p.views, 0)

  // Engagement = the four interaction counts. Average is per post so it stays
  // comparable as the roster grows.
  const totalEngagement = totalLikes + totalComments + totalShares + totalSends
  const avgEngagement = totalPosts ? Math.round(totalEngagement / totalPosts) : 0

  // Group by partner (keyed by handle, which is stable even when we can't match
  // a partner name). Each group carries its own roll-ups plus the raw posts.
  const groupsByHandle = {}
  for (const p of posts) {
    const key = p.partner_handle
    if (!groupsByHandle[key]) {
      groupsByHandle[key] = {
        handle: key,
        name: p.partner_name || null,
        posts: [],
        likes: 0,
        comments: 0,
        shares: 0,
        sends: 0,
        views: 0,
        viewsCount: 0,
      }
    }
    const g = groupsByHandle[key]
    g.posts.push(p)
    g.likes += p.likes || 0
    g.comments += p.comments || 0
    g.shares += p.shares || 0
    g.sends += p.sends || 0
    if (p.views !== null && p.views !== undefined) {
      g.views += p.views
      g.viewsCount += 1
    }
  }
  const partners = Object.values(groupsByHandle)
    .map((g) => ({ ...g, engagement: g.likes + g.comments + g.shares + g.sends }))
    .sort((a, b) => b.engagement - a.engagement)

  return {
    totalPosts,
    totalLikes,
    totalComments,
    totalShares,
    totalSends,
    totalEngagement,
    avgEngagement,
    totalViews,
    viewsCount: withViews.length,
    missingViews: totalPosts - withViews.length,
    partners,
  }
}

export function computeStats() {
  return {
    outreach: computeOutreach(),
    boxes: computeBoxes(),
    partners: computePartners(),
    social: computeSocial(),
  }
}

/* ─────────────────────────── EOD draft ──────────────────────────── */

const pct = (n) => `${(n * 100).toFixed(1)}%`
// A metric with no value renders as an explicit blank — never a fabricated 0.
const val = (n) => (n === null || n === undefined || n === '' ? '(no data)' : String(n))

// Build the copy-paste end-of-day update Darien wants: context on every bullet,
// quantified wherever the data allows, blanks clearly marked. `log` is today's
// Daily Log row (or null); `dateLabel` is the human date for the header.
export function buildEodDraft({ log, dateLabel }) {
  const { outreach, boxes, partners } = computeStats()
  const L = []
  const push = (s = '') => L.push(s)

  push('PLANET Style Collective — End-of-Day Update')
  push(dateLabel)
  push('')

  // ── Where things stand: boxes ──
  push('WHERE THINGS STAND — SAMPLE BOXES')
  push(
    `• ${boxes.shipped} of ${boxes.total} sample boxes have shipped; ${boxes.currentlyOut} ${
      boxes.currentlyOut === 1 ? 'is' : 'are'
    } currently out with partners awaiting return, and ${boxes.returned} ${
      boxes.returned === 1 ? 'has' : 'have'
    } come back and been logged.` +
      (boxes.preparing
        ? ` ${boxes.preparing} more ${boxes.preparing === 1 ? 'box is' : 'boxes are'} being prepped to send.`
        : '')
  )
  push(
    `• Of the boxes with partners now, ${boxes.delivered} ${
      boxes.delivered === 1 ? 'is' : 'are'
    } confirmed delivered and ${boxes.inTransit} still in transit.`
  )
  if (boxes.avgDaysToReturn != null) {
    push(
      `• Boxes are averaging ${boxes.avgDaysToReturn} days from ship to return (across ${boxes.avgDaysCount} returned so far).`
    )
  } else {
    push('• Average days-to-return: not tracked in the current data — actual return dates aren’t captured yet.')
  }
  push('')

  // ── Partners onboarded ──
  push('PARTNERS')
  push(
    `• ${partners.onboarded} stylists/creators are onboarded as active partners (${partners.total} in the partner roster overall, GoAffPro-synced).`
  )
  push('')

  // ── Outreach ──
  push('OUTREACH')
  push(
    `• ${outreach.total} people contacted for the Style Collective to date; ${outreach.replied} have responded — a ${pct(
      outreach.responseRate
    )} response rate.`
  )
  push(
    `• Pipeline from those replies: ${outreach.byStatus.active || 0} active partners, ${
      outreach.byStatus.gifted || 0
    } gifted, ${outreach.byStatus.interested || 0} interested/in conversation, ${
      outreach.byStatus.declined || 0
    } declined.`
  )
  // "What's working" = the category actually responding best (data-derived, not narrative).
  const best = outreach.categoryRates.filter((c) => c.total >= 5)[0]
  if (best) {
    push(
      `• What’s working: ${catLabel(best.key)} are responding best so far — ${best.replied} of ${
        best.total
      } (${pct(best.rate)}).`
    )
  }
  push('')

  // ── Today's manual content + DM metrics ──
  push('TODAY — CONTENT & DMs')
  if (log) {
    push(
      `• Partners published ${val(log.reels_posted)} reels/posts today; ${val(
        log.reposts
      )} reposted to PLANET’s channels.`
    )
    push(
      `• Sent ${val(log.dms_sent)} IG/FB DMs; ${val(log.dms_unread)} still unread / awaiting a reply.`
    )
    if (log.notes) push(`• Notes: ${log.notes}`)
  } else {
    push('• No manual metrics logged for today yet — add them in the Daily Log tab.')
  }
  push('')

  // ── Weekly goal ──
  push('WEEKLY GOAL')
  push(`• ${log?.weekly_goal ? log.weekly_goal : '(not set)'}`)
  push('')

  // ── On track / blockers ──
  push('ON TRACK?')
  const ot = log?.on_track
  const otLabel = ot === null || ot === undefined ? '(not set)' : ot ? 'Yes' : 'No'
  const blockers = log?.blockers
    ? ` — ${log.blockers}`
    : ot === false
    ? ' — (blockers not specified)'
    : ''
  push(`• ${otLabel}${blockers}`)

  return L.join('\n')
}
