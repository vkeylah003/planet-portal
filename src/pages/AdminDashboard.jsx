import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Badge, PlatformBadge, Spinner, FullPageLoader, EmptyState, Field } from '../components/ui'
import { fetchImpactSummary } from '../lib/impact'
import { syncFromGoAffPro } from '../lib/goaffproSync'
import contactedRoster from '../../scripts/contacted_data.json'
import {
  downloadContactedPDF,
  downloadContactedCSV,
  summarize,
  sortRows,
  catLabel,
  statusLabel,
} from '../lib/report'
import { computeStats, computeSocial, computeManualSales, buildEodDraft } from '../lib/stats'

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  )
}

const PARTNER_STATUSES = ['Contacted', 'Interested', 'Active Partner', 'Passed']
const KIT_STATUSES = ['Preparing', 'Shipped', 'Delivered', 'Return Pending', 'Returned']

// A kit is CURRENT (a box physically out with the partner, or being prepped to
// send) until it comes back. Once it's 'Returned' it's a PREVIOUS box — history,
// not something in the partner's hands. Everything except 'Returned' is active.
const ACTIVE_KIT_STATUSES = ['Preparing', 'Shipped', 'Delivered', 'Return Pending']
const isActiveKit = (k) => ACTIVE_KIT_STATUSES.includes(k?.status)
const CONTENT_TYPES = ['Reel', 'Feed Post', 'Story', 'Blog Post']
const PLATFORMS = ['GoAffPro', 'Impact']

// Partners we explicitly GIFTED product to (no return expected) — distinct
// from the normal sample-kit partners who send the kit back. The `gifted`
// boolean on the partners table is the source of truth; this email set is a
// fallback so the Gifted view renders immediately even before that column is
// migrated/synced. See scripts/add_gifted_column.sql.
const GIFTED_EMAILS = new Set([
  'megan@meganslifestyle.com',
  'info@deborahsorlie.com',
  'cynthia@theunexpectedsomeone.com',
])
function isGifted(p) {
  return p?.gifted === true || GIFTED_EMAILS.has((p?.email || '').toLowerCase())
}

// Gifted partners who keep only ONE gifted piece (the other kit pieces are
// returned/bought at 50%), so the Gifted card shows "1 piece (gifted)" rather
// than enumerating their full sample kit.
const GIFTED_SINGLE_PIECE_EMAILS = new Set([
  'megan@meganslifestyle.com',
  'info@deborahsorlie.com',
])

// Outreach roster statuses → on-brand pill tones (lowercase keys match
// scripts/contacted_data.json). Kept here so the Outreach view and any future
// status chips stay consistent.
const OUTREACH_STATUS_TONE = {
  active: 'bg-gold/20 text-gold',
  gifted: 'bg-purple-100 text-purple-700',
  'yes-awaiting': 'bg-teal-100 text-teal-700',
  'needs-follow-up': 'bg-amber-100 text-amber-700',
  'no-show': 'bg-orange-100 text-orange-700',
  interested: 'bg-gold-soft/40 text-espresso',
  contacted: 'bg-espresso/10 text-espresso/60',
  declined: 'bg-espresso/5 text-espresso/40',
}

function StatusPill({ status }) {
  const tone = OUTREACH_STATUS_TONE[status] || 'bg-espresso/10 text-espresso/70'
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${tone}`}
    >
      {statusLabel(status)}
    </span>
  )
}

export default function AdminDashboard() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState([])
  const [kits, setKits] = useState([])
  const [pieces, setPieces] = useState([])
  const [content, setContent] = useState([])
  const [selections, setSelections] = useState([])
  const [dailyLogs, setDailyLogs] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const [p, k, pc, c, sel, dl] = await Promise.all([
      supabase.from('partners').select('*').order('created_at', { ascending: false }),
      supabase.from('kits').select('*').order('created_at', { ascending: false }),
      supabase.from('kit_pieces').select('*').order('created_at', { ascending: true }),
      supabase.from('content_log').select('*').order('post_date', { ascending: false }),
      supabase
        .from('partner_selections')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase.from('daily_log').select('*').order('log_date', { ascending: false }),
    ])
    setPartners(p.data || [])
    setKits(k.data || [])
    setPieces(pc.data || [])
    setContent(c.data || [])
    // Gracefully tolerate the table not existing yet (before Sofia runs the
    // migration) — sel.error is set and sel.data is null in that case.
    setSelections(sel.data || [])
    // Same tolerance for daily_log until supabase/content_tracker.sql is run.
    setDailyLogs(dl.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Lightweight auto-sync from GoAffPro on first dashboard open per browser
  // session. Deduped via sessionStorage so it runs at most once, silent and
  // non-blocking; only refreshes the list if something actually changed. The
  // "Sync from GoAffPro" button on the Partners tab is the primary, explicit
  // trigger — this just keeps things fresh without any action.
  useEffect(() => {
    if (sessionStorage.getItem('goaffproAutoSynced')) return
    sessionStorage.setItem('goaffproAutoSynced', '1')
    syncFromGoAffPro()
      .then((r) => {
        if (r?.ok && (r.added > 0 || r.updated > 0)) load()
      })
      .catch(() => {
        // Non-critical — the manual button surfaces any real error.
      })
  }, [load])

  if (loading) return <FullPageLoader label="Loading dashboard…" />

  const newSelections = selections.filter((s) => s.status === 'new').length

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'stats', label: 'Stats' },
    { id: 'social', label: 'Social' },
    { id: 'partners', label: 'Partners' },
    { id: 'selections', label: 'Selections', badge: newSelections },
    { id: 'outreach', label: 'Everyone Contacted' },
    { id: 'kits', label: 'Kit Tracker' },
    { id: 'content', label: 'Content Tracker' },
    { id: 'daily', label: 'Daily Log' },
    { id: 'eod', label: 'EOD Draft' },
  ]

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-black/20 bg-espresso sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <img
              src="/planet-wordmark.png"
              alt="PLANET"
              className="h-6 w-auto logo-invert"
            />
            <span className="text-gold text-[10px] uppercase tracking-[0.3em] hidden sm:inline">
              Internal Dashboard
            </span>
          </div>
          <button
            onClick={() => signOut().then(() => navigate('/'))}
            className="text-xs font-medium tracking-wide text-cream/70 hover:text-cream transition"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 mt-8">
        {/* Tabs */}
        <div className="flex gap-2 border-b border-espresso/10 mb-8">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-3 text-sm font-medium tracking-wide -mb-px border-b-2 transition inline-flex items-center gap-2 ${
                tab === t.id
                  ? 'border-gold text-espresso'
                  : 'border-transparent text-espresso/45 hover:text-espresso/70'
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold text-white text-[10px] font-bold tabular-nums">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab partners={partners} kits={kits} pieces={pieces} content={content} />
        )}
        {tab === 'stats' && <StatsTab />}
        {tab === 'social' && <SocialTab />}
        {tab === 'partners' && <PartnersTab partners={partners} onChange={load} />}
        {tab === 'selections' && <SelectionsTab selections={selections} onChange={load} />}
        {tab === 'outreach' && <OutreachTab />}
        {tab === 'kits' && (
          <KitsTab partners={partners} kits={kits} pieces={pieces} onChange={load} />
        )}
        {tab === 'content' && (
          <ContentTab partners={partners} content={content} onChange={load} />
        )}
        {tab === 'daily' && <DailyLogTab dailyLogs={dailyLogs} onChange={load} />}
        {tab === 'eod' && <EodTab dailyLogs={dailyLogs} />}
      </main>
    </div>
  )
}

/* ───────────────────────────── Overview ──────────────────────────── */

function Metric({ label, value, sub, accent = 'text-espresso' }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] uppercase tracking-widest text-espresso/60 font-medium">
        {label}
      </p>
      <p className={`text-3xl font-semibold tabular-nums tracking-tight mt-2 ${accent}`}>
        {value}
      </p>
      {sub ? <p className="text-xs text-espresso/55 mt-1">{sub}</p> : null}
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-cream rounded-xl px-3 py-2.5 border border-espresso/5">
      <div className="text-espresso font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-espresso/55 mt-0.5 font-medium">
        {label}
      </div>
    </div>
  )
}

function ConnectImpact({ message }) {
  return (
    <div className="text-center py-6 px-4">
      <p className="font-heading text-lg text-espresso/70">Connect Impact</p>
      <p className="text-sm text-espresso/45 mt-2 leading-relaxed">
        {message ||
          'Add IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN in Vercel to see live affiliate sales, orders, and commission.'}
      </p>
    </div>
  )
}

function OverviewTab({ partners, kits, pieces, content }) {
  const [impact, setImpact] = useState({ loading: true })

  useEffect(() => {
    let active = true
    fetchImpactSummary()
      .then((d) => active && setImpact({ loading: false, data: d }))
      .catch((e) => active && setImpact({ loading: false, error: e.message }))
    return () => {
      active = false
    }
  }, [])

  // Supabase-derived metrics.
  const kitByStatus = KIT_STATUSES.reduce((a, s) => ((a[s] = 0), a), {})
  for (const k of kits) if (k.status in kitByStatus) kitByStatus[k.status] += 1
  const totalKits = kits.length
  const delivered = kitByStatus.Delivered

  // Outstanding deliverables ≈ partners with a delivered kit but no logged content.
  const loggedPartnerIds = new Set(content.map((c) => c.partner_id))
  const deliveredPartnerIds = new Set(
    kits.filter((k) => k.status === 'Delivered').map((k) => k.partner_id)
  )
  let outstanding = 0
  deliveredPartnerIds.forEach((pid) => {
    if (!loggedPartnerIds.has(pid)) outstanding += 1
  })

  // Gifted partners — explicitly gifted product, no return expected. Attach
  // each one's kit pieces so the Overview can show WHAT was gifted.
  const kitByPartnerId = Object.fromEntries(kits.map((k) => [k.partner_id, k]))
  const piecesByKitId = pieces.reduce((acc, pc) => {
    ;(acc[pc.kit_id] = acc[pc.kit_id] || []).push(pc)
    return acc
  }, {})
  const giftedPartners = partners
    .filter(isGifted)
    .map((p) => {
      const kit = kitByPartnerId[p.id]
      return { ...p, pieces: kit ? piecesByKitId[kit.id] || [] : [] }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Stylist purchases — kit pieces a partner chose to keep (= buy), grouped by
  // partner. Source: kit_pieces.partner_decision === 'keep' (case-insensitive,
  // since the DB stores 'Keep'). purchase_amount is nullable → renders "—".
  // purchase_status ('paid' | 'pending') drives the money-made headline:
  // only PAID counts as money made; pending is surfaced separately.
  //
  // The test account (Sofia Piniella TEST) is excluded entirely — it's a
  // sandbox partner and must never count toward kept-item totals.
  const TEST_PARTNER_EMAIL = 'sofiaapiniella12@gmail.com'
  const excludedPartnerIds = new Set(
    partners
      .filter((p) => (p.email || '').toLowerCase() === TEST_PARTNER_EMAIL)
      .map((p) => p.id)
  )
  const partnerNameById = Object.fromEntries(partners.map((p) => [p.id, p.name]))
  const partnerIdByKit = Object.fromEntries(kits.map((k) => [k.id, k.partner_id]))
  const keptPieces = (pieces || []).filter(
    (pc) =>
      (pc.partner_decision || '').toLowerCase() === 'keep' &&
      !excludedPartnerIds.has(partnerIdByKit[pc.kit_id])
  )
  const keptByPartner = []
  for (const pc of keptPieces) {
    const name = partnerNameById[partnerIdByKit[pc.kit_id]] || 'Unknown'
    let group = keptByPartner.find((g) => g.name === name)
    if (!group) {
      group = { name, items: [] }
      keptByPartner.push(group)
    }
    group.items.push(pc)
  }
  keptByPartner.sort((a, b) => a.name.localeCompare(b.name))
  const isPaid = (pc) => (pc.purchase_status || '').toLowerCase() === 'paid'
  const isPending = (pc) => (pc.purchase_status || '').toLowerCase() === 'pending'
  const paidTotal = keptPieces
    .filter(isPaid)
    .reduce((s, pc) => s + Number(pc.purchase_amount || 0), 0)
  const pendingTotal = keptPieces
    .filter(isPending)
    .reduce((s, pc) => s + Number(pc.purchase_amount || 0), 0)

  // Manually-attributed generated sales — customer orders a partner drove that
  // didn't auto-attribute in GoAffPro/Impact (wrong/generic discount code used
  // instead of the affiliate link). Recorded in scripts/partners_data.json.
  const manualSales = computeManualSales()

  const imp = impact.data
  const connected = Boolean(imp?.connected)

  return (
    <div className="space-y-8">
      {/* Headline metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Partners"
          value={partners.length}
          sub={`${totalKits} kit${totalKits === 1 ? '' : 's'} built`}
        />
        <Metric
          label="Kits delivered"
          value={delivered}
          accent="text-green-700"
          sub={`${totalKits - delivered} in progress`}
        />
        <Metric
          label="Impact sales · 30d"
          value={connected ? money(imp.sales) : '—'}
          accent="text-gold"
          sub={connected ? `${imp.orders} order${imp.orders === 1 ? '' : 's'}` : 'Not connected'}
        />
        <Metric
          label="Impact commission · 30d"
          value={connected ? money(imp.commission) : '—'}
          accent="text-gold"
          sub={connected ? null : 'Not connected'}
        />
      </div>

      {/* Gifted partners */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-heading text-xl text-espresso mb-1">Gifted Partners</h3>
            <p className="text-xs text-espresso/45">
              Explicitly gifted product — no return expected (distinct from the
              sample-kit partners who send the kit back)
            </p>
          </div>
          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-purple-100 text-purple-700">
            {giftedPartners.length} gifted
          </span>
        </div>
        {giftedPartners.length === 0 ? (
          <EmptyState
            title="No gifted partners"
            hint="Mark a partner as gifted from the Partners tab."
          />
        ) : (
          <div className="divide-y divide-espresso/5">
            {giftedPartners.map((p) => {
              // Megan & Deborah keep only the single gifted piece, not the
              // full kit — show "1 piece (gifted)" rather than every piece.
              const singlePiece = GIFTED_SINGLE_PIECE_EMAILS.has(
                (p.email || '').toLowerCase()
              )
              return (
                <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-sm text-espresso font-medium mb-1.5">{p.name}</p>
                  {singlePiece ? (
                    <div className="flex flex-wrap gap-2">
                      <span className="inline-flex items-center bg-white rounded-full px-3 py-1 text-xs border border-espresso/5 text-espresso">
                        1 piece (gifted)
                      </span>
                    </div>
                  ) : p.pieces.length === 0 ? (
                    <p className="text-xs text-espresso/40">Kit in progress — pieces TBD</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {p.pieces.map((pc) => (
                        <span
                          key={pc.id}
                          className="inline-flex items-center gap-1.5 bg-white rounded-full pl-3 pr-2.5 py-1 text-xs border border-espresso/5"
                        >
                          <span className="text-espresso">{pc.piece_name}</span>
                          {pc.color && <span className="text-espresso/40">· {pc.color}</span>}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Kit pipeline + Impact performance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6">
          <h3 className="font-heading text-xl text-espresso mb-1">Kit pipeline</h3>
          <p className="text-xs text-espresso/45 mb-4">
            {totalKits} kit{totalKits === 1 ? '' : 's'} across {partners.length} partner
            {partners.length === 1 ? '' : 's'}
          </p>
          <div className="space-y-2.5">
            {KIT_STATUSES.map((s) => (
              <div key={s} className="flex items-center justify-between">
                <Badge status={s} />
                <span className="text-sm font-medium text-espresso">{kitByStatus[s]}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-espresso/10 flex items-center justify-between">
            <span
              className="text-sm text-espresso/60"
              title="Partners with a delivered kit but no logged content"
            >
              Outstanding deliverables
            </span>
            <span className="text-sm font-medium text-espresso">{outstanding}</span>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="font-heading text-xl text-espresso mb-1">Affiliate performance</h3>
          <p className="text-xs text-espresso/45 mb-4">Impact · last 30 days</p>
          {impact.loading ? (
            <div className="flex items-center gap-3 text-espresso/50 text-sm py-6">
              <Spinner /> Loading Impact…
            </div>
          ) : impact.error ? (
            <p className="text-sm text-espresso/50 py-6 break-words whitespace-pre-wrap">
              Couldn't load Impact right now. {impact.error}
            </p>
          ) : !connected ? (
            <ConnectImpact message={imp?.message} />
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <MiniStat label="Sales" value={money(imp.sales)} />
              <MiniStat label="Commission" value={money(imp.commission)} />
              <MiniStat label="Orders" value={imp.orders} />
            </div>
          )}
        </div>
      </div>

      {/* Stylist purchases / kept items */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-heading text-xl text-espresso mb-1">
              Stylist Purchases · Kept Items
            </h3>
            <p className="text-xs text-espresso/45">
              Pieces partners chose to keep (buy) from their kits
            </p>
          </div>
          <div className="text-right">
            <p className="text-3xl font-semibold tabular-nums tracking-tight text-green-700 leading-none">
              {money(paidTotal)}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-espresso/40 mt-1">
              Money made · paid
            </p>
            {pendingTotal > 0 && (
              <p className="text-[11px] text-amber-600 font-medium mt-1.5">
                {money(pendingTotal)} pending
              </p>
            )}
          </div>
        </div>
        {keptByPartner.length === 0 ? (
          <EmptyState
            title="No kept items yet"
            hint="When a partner keeps a piece, it shows up here with its purchase amount."
          />
        ) : (
          <div className="divide-y divide-espresso/5">
            {keptByPartner.map((g) => (
              <div key={g.name} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-espresso font-medium mb-1.5">{g.name}</p>
                <div className="space-y-1.5">
                  {g.items.map((pc) => {
                    const pending = isPending(pc)
                    const paid = isPaid(pc)
                    return (
                      <div key={pc.id} className="flex items-center justify-between gap-4">
                        <span className="text-sm text-espresso/70 min-w-0 truncate">
                          {pc.piece_name}
                          {pc.color && <span className="text-espresso/40"> · {pc.color}</span>}
                        </span>
                        <span className="flex items-center gap-2 shrink-0">
                          {(paid || pending) && (
                            <span
                              className={`text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded ${
                                pending
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              {pending ? 'Pending' : 'Paid'}
                            </span>
                          )}
                          <span
                            className={`text-sm font-medium ${
                              pending ? 'text-amber-600' : 'text-espresso'
                            }`}
                          >
                            {pc.purchase_amount == null ? '—' : money(pc.purchase_amount)}
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Manually-attributed generated sales */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-heading text-xl text-espresso mb-1">
              Manually-Attributed Sales
            </h3>
            <p className="text-xs text-espresso/45 max-w-xl">
              Customer orders a partner drove that didn't auto-attribute in
              GoAffPro/Impact (e.g. a generic store discount code was used instead
              of the partner's affiliate link). Credited here by hand.
            </p>
          </div>
          {manualSales.count > 0 && (
            <div className="text-right">
              <p className="text-3xl font-semibold tabular-nums tracking-tight text-gold leading-none">
                {money(manualSales.totalCommission)}
              </p>
              <p className="text-[10px] uppercase tracking-widest text-espresso/40 mt-1">
                Commission credited
              </p>
              <p className="text-[11px] text-espresso/45 font-medium mt-1.5">
                {money(manualSales.totalSales)} net sales
              </p>
            </div>
          )}
        </div>
        {manualSales.count === 0 ? (
          <EmptyState
            title="No manual attributions"
            hint="Sales credited to a partner by hand show up here."
          />
        ) : (
          <div className="divide-y divide-espresso/5">
            {manualSales.sales.map((s) => (
              <div key={s.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-espresso font-medium">
                      {s.partner_name}
                      <span className="text-espresso/40 font-normal">
                        {' '}· Order {s.order_number}
                        {s.order_date ? ` · ${s.order_date}` : ''}
                      </span>
                    </p>
                    <p className="text-xs text-espresso/60 mt-0.5 truncate">
                      {s.item}
                      {s.color && <span className="text-espresso/40"> · {s.color}</span>}
                      {s.customer && (
                        <span className="text-espresso/40"> · for {s.customer}</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-gold">
                      {money(s.commission_amount)}
                    </p>
                    <p className="text-[11px] text-espresso/45">
                      {money(s.net_subtotal)} net · {Math.round((s.commission_rate || 0) * 100)}%
                    </p>
                  </div>
                </div>
                {s.note && (
                  <p className="text-[11px] text-espresso/50 italic mt-1.5">{s.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent activity */}
      <div className="card p-6">
        <h3 className="font-heading text-xl text-espresso mb-1">Recent sales &amp; activity</h3>
        <p className="text-xs text-espresso/45 mb-4">Latest Impact conversions</p>
        {impact.loading ? (
          <div className="flex items-center gap-3 text-espresso/50 text-sm py-4">
            <Spinner /> Loading…
          </div>
        ) : !connected ? (
          <p className="text-sm text-espresso/45">Connect Impact to see recent sales here.</p>
        ) : (imp.recentActions || []).length === 0 ? (
          <EmptyState title="No recent activity" hint="New Impact sales will show up here." />
        ) : (
          <div className="divide-y divide-espresso/5">
            {imp.recentActions.map((a, i) => (
              <div key={i} className="flex items-center justify-between py-3 gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-espresso font-medium truncate">{a.partner}</p>
                  <p className="text-xs text-espresso/45">{a.date || '—'}</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-espresso font-medium">{money(a.amount)}</span>
                  <Badge status={a.status}>{a.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────── Modal ────────────────────────────── */

function Modal({ title, children, onClose }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-espresso/40 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-cream rounded-2xl shadow-soft w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-espresso/10 sticky top-0 bg-cream">
          <h3 className="font-heading text-2xl text-espresso">{title}</h3>
          <button onClick={onClose} className="text-espresso/40 hover:text-espresso text-xl">
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

/* ──────────────────────────── Partners ───────────────────────────── */

// Copy a partner's private selection link (/partner/<select_token>). Tokens
// are created by supabase/partner_selections.sql — until that runs, a partner
// has no token and we prompt to run the migration.
function partnerLink(p) {
  return p.select_token ? `${window.location.origin}/partner/${p.select_token}` : null
}

function CopyLinkButton({ partner, className = '' }) {
  const [copied, setCopied] = useState(false)
  const link = partnerLink(partner)

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the modal still shows the full link to copy by hand */
    }
  }

  if (!link) {
    return (
      <span
        className={`text-xs text-espresso/30 ${className}`}
        title="Run supabase/partner_selections.sql to generate partner links"
      >
        No link yet
      </span>
    )
  }
  return (
    <button
      onClick={copy}
      className={`btn-ghost text-xs ${className}`}
      title={link}
    >
      {copied ? '✓ Copied' : 'Copy link'}
    </button>
  )
}

function PartnersTab({ partners, onChange }) {
  const [editing, setEditing] = useState(null) // partner object or {} for new
  const [platformFilter, setPlatformFilter] = useState('All') // All | GoAffPro | Impact
  const [giftedFilter, setGiftedFilter] = useState('All') // All | Gifted | Standard
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState(null) // { ok, message } | { error }

  async function runSync() {
    setSyncing(true)
    setSyncResult(null)
    try {
      const r = await syncFromGoAffPro()
      if (r?.configured === false) {
        setSyncResult({ error: r.message || 'GoAffPro sync is not configured yet.' })
      } else {
        setSyncResult({
          ok: true,
          message: `Synced from GoAffPro — ${r.added} added, ${r.updated} updated (${r.affiliates} affiliates).`,
        })
        onChange() // refresh the list so new partners appear
      }
    } catch (e) {
      setSyncResult({ error: e.message || 'GoAffPro sync failed.' })
    } finally {
      setSyncing(false)
    }
  }

  const counts = partners.reduce(
    (acc, p) => {
      if (p.platform) acc[p.platform] = (acc[p.platform] || 0) + 1
      return acc
    },
    { GoAffPro: 0, Impact: 0 }
  )
  const giftedCount = partners.filter(isGifted).length

  let filtered =
    platformFilter === 'All'
      ? partners
      : partners.filter((p) => p.platform === platformFilter)
  if (giftedFilter === 'Gifted') filtered = filtered.filter(isGifted)

  const filterTabs = [
    { id: 'All', label: `All (${partners.length})` },
    { id: 'GoAffPro', label: `GoAffPro (${counts.GoAffPro})` },
    { id: 'Impact', label: `Impact (${counts.Impact})` },
  ]
  const giftedTabs = [
    { id: 'All', label: `Everyone (${partners.length})` },
    { id: 'Gifted', label: `Gifted (${giftedCount})` },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-3xl text-espresso">
          Partners <span className="text-espresso/30 text-xl">({filtered.length})</span>
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={runSync}
            disabled={syncing}
            className="btn-ghost text-xs inline-flex items-center gap-2 disabled:opacity-50"
            title="Pull the full GoAffPro affiliate roster into Partners"
          >
            {syncing && <Spinner />}
            {syncing ? 'Syncing…' : 'Sync from GoAffPro'}
          </button>
          <button onClick={() => setEditing({})} className="btn-gold">
            + Add partner
          </button>
        </div>
      </div>

      {syncResult && (
        <div
          className={`mb-5 rounded-lg px-4 py-3 text-sm flex items-start justify-between gap-3 ${
            syncResult.error
              ? 'bg-red-50 text-red-700 border border-red-100'
              : 'bg-green-50 text-green-700 border border-green-100'
          }`}
        >
          <span>{syncResult.error || syncResult.message}</span>
          <button
            onClick={() => setSyncResult(null)}
            className="text-current/60 hover:text-current shrink-0"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-espresso/40 mr-1">
            Type
          </span>
          {giftedTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setGiftedFilter(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-wide border transition ${
                giftedFilter === t.id
                  ? 'border-gold bg-gold/15 text-espresso'
                  : 'border-espresso/15 text-espresso/55 hover:border-espresso/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-espresso/40 mr-1">
            Platform
          </span>
          {filterTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setPlatformFilter(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-wide border transition ${
                platformFilter === t.id
                  ? 'border-gold bg-gold/15 text-espresso'
                  : 'border-espresso/15 text-espresso/55 hover:border-espresso/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {partners.length === 0 ? (
        <EmptyState title="No partners yet" hint="Add your first partner to get started." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No partners match these filters"
          hint="Try a different Type or Platform filter."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-espresso/50 text-xs uppercase tracking-widest border-b border-espresso/10">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Platform</th>
                <th className="px-5 py-3 font-medium">Instagram</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Note</th>
                <th className="px-5 py-3 font-medium">Private link</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-b border-espresso/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-espresso">
                    <span className="inline-flex items-center gap-2">
                      {p.name}
                      {isGifted(p) && (
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide bg-purple-100 text-purple-700">
                          Gifted
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-espresso/60">{p.email}</td>
                  <td className="px-5 py-3">
                    {p.platform ? (
                      <PlatformBadge platform={p.platform} />
                    ) : (
                      <span className="text-espresso/25">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-espresso/60">{p.instagram || '—'}</td>
                  <td className="px-5 py-3">
                    <Badge status={p.status} />
                  </td>
                  <td className="px-5 py-3 max-w-[180px]">
                    {p.partner_message ? (
                      <span
                        className="text-espresso/60 line-clamp-1 italic"
                        title={p.partner_message}
                      >
                        “{p.partner_message}”
                      </span>
                    ) : (
                      <span className="text-espresso/25">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <CopyLinkButton partner={p} />
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button
                      onClick={() => setEditing(p)}
                      className="btn-ghost text-xs"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PartnerModal
          partner={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            onChange()
          }}
        />
      )}
    </div>
  )
}

function PartnerModal({ partner, onClose, onSaved }) {
  const isNew = !partner.id
  const [form, setForm] = useState({
    name: partner.name || '',
    email: partner.email || '',
    instagram: partner.instagram || '',
    status: partner.status || 'Contacted',
    platform: partner.platform || 'GoAffPro',
    commission_link: partner.commission_link || '',
    gifted: isGifted(partner),
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    // Keep `gifted` out of the core payload and persist it separately so a
    // not-yet-migrated `gifted` column (run scripts/add_gifted_column.sql)
    // never blocks saving the rest of a partner's details.
    const { gifted, ...core } = form
    const payload = { ...core, email: core.email.trim().toLowerCase() }
    const { error } = isNew
      ? await supabase.from('partners').insert({ ...payload, gifted })
      : await supabase.from('partners').update(payload).eq('id', partner.id)
    if (!error && !isNew && gifted !== Boolean(partner.gifted)) {
      const g = await supabase.from('partners').update({ gifted }).eq('id', partner.id)
      if (g.error) {
        setBusy(false)
        setError(
          `Details saved, but the Gifted flag didn't stick — run scripts/add_gifted_column.sql in the Supabase SQL Editor first. (${g.error.message})`
        )
        return
      }
    }
    setBusy(false)
    if (error) setError(error.message)
    else onSaved()
  }

  async function remove() {
    if (!confirm(`Delete ${partner.name}? This removes their kit and content too.`)) return
    setBusy(true)
    await supabase.from('partners').delete().eq('id', partner.id)
    setBusy(false)
    onSaved()
  }

  return (
    <Modal title={isNew ? 'Add partner' : 'Edit partner'} onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <input
            className="input"
            required
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
        </Field>
        <Field label="Email">
          <input
            type="email"
            className="input"
            required
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
          />
        </Field>
        <Field label="Instagram">
          <input
            className="input"
            placeholder="@handle"
            value={form.instagram}
            onChange={(e) => set('instagram', e.target.value)}
          />
        </Field>
        <Field label="Status">
          <select
            className="input"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          >
            {PARTNER_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <Field label="Platform">
          <select
            className="input"
            value={form.platform}
            onChange={(e) => set('platform', e.target.value)}
          >
            {PLATFORMS.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Commission link">
          <input
            className="input"
            placeholder="https://…/?ref=handle"
            value={form.commission_link}
            onChange={(e) => set('commission_link', e.target.value)}
          />
        </Field>
        <label className="flex items-start gap-2.5 cursor-pointer select-none rounded-xl border border-espresso/10 bg-white px-3 py-2.5">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-espresso/30 accent-gold"
            checked={form.gifted}
            onChange={(e) => set('gifted', e.target.checked)}
          />
          <span className="text-sm text-espresso">
            Gifted partner
            <span className="block text-xs text-espresso/45">
              Explicitly gifted product — no return expected (not a sample-kit partner)
            </span>
          </span>
        </label>

        {!isNew && (
          <div className="bg-white rounded-xl p-3 border border-espresso/5">
            <div className="flex items-center justify-between gap-3">
              <p className="label mb-0">Private selection link</p>
              <CopyLinkButton partner={partner} />
            </div>
            {partnerLink(partner) ? (
              <p className="mt-1.5 text-xs text-espresso/60 break-all">
                {partnerLink(partner)}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-espresso/40">
                Run supabase/partner_selections.sql to generate this partner's link.
              </p>
            )}
          </div>
        )}

        {partner.partner_message && (
          <div className="bg-white rounded-xl p-3 border border-espresso/5">
            <p className="label">Note from partner</p>
            <p className="text-sm text-espresso/70 italic">“{partner.partner_message}”</p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center justify-between pt-2">
          {!isNew ? (
            <button
              type="button"
              onClick={remove}
              className="btn-ghost text-xs text-red-600 hover:bg-red-50"
            >
              Delete
            </button>
          ) : (
            <span />
          )}
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Spinner /> : isNew ? 'Add partner' : 'Save changes'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ─────────────────────────── Selections ──────────────────────────── */

// Partners' picks from the live catalog. New submissions land here as the
// admin's notification (count badge on the tab); Sofia marks each reviewed.
function SelectionsTab({ selections, onChange }) {
  const [filter, setFilter] = useState('new') // new | reviewed | all

  const counts = {
    new: selections.filter((s) => s.status === 'new').length,
    reviewed: selections.filter((s) => s.status === 'reviewed').length,
    all: selections.length,
  }

  const rows =
    filter === 'all' ? selections : selections.filter((s) => s.status === filter)

  const filterTabs = [
    { id: 'new', label: `Pending (${counts.new})` },
    { id: 'reviewed', label: `Reviewed (${counts.reviewed})` },
    { id: 'all', label: `All (${counts.all})` },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-heading text-3xl text-espresso">Partner Selections</h2>
        <p className="text-sm text-espresso/55 mt-1 max-w-xl">
          Pieces partners chose from the live collection. New submissions appear here
          (and flag the tab) so you see them at a glance.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {filterTabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setFilter(t.id)}
            className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-wide border transition ${
              filter === t.id
                ? 'border-gold bg-gold/15 text-espresso'
                : 'border-espresso/15 text-espresso/55 hover:border-espresso/40'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filter === 'new' ? 'No pending selections' : 'Nothing here'}
          hint={
            filter === 'new'
              ? "When a partner submits their picks, they'll show up here."
              : 'Try a different filter.'
          }
        />
      ) : (
        <div className="space-y-4">
          {rows.map((s) => (
            <SelectionCard key={s.id} selection={s} onChange={onChange} />
          ))}
        </div>
      )}
    </div>
  )
}

function SelectionCard({ selection, onChange }) {
  const [busy, setBusy] = useState(false)
  const items = Array.isArray(selection.items) ? selection.items : []

  const when = selection.created_at
    ? new Date(selection.created_at).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—'

  async function setStatus(status) {
    setBusy(true)
    await supabase.from('partner_selections').update({ status }).eq('id', selection.id)
    setBusy(false)
    onChange()
  }

  const isNew = selection.status === 'new'

  return (
    <div
      className={`card p-5 ${isNew ? 'border-l-4 border-l-gold' : ''}`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-heading text-xl text-espresso">
              {selection.partner_name || selection.partner_email}
            </h3>
            {isNew ? (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gold/20 text-gold">
                New
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-green-100 text-green-700">
                Reviewed
              </span>
            )}
          </div>
          <p className="text-xs text-espresso/45 mt-0.5">
            {selection.partner_email} · {when}
          </p>
        </div>
        {isNew ? (
          <button
            onClick={() => setStatus('reviewed')}
            disabled={busy}
            className="btn-outline text-xs shrink-0"
          >
            {busy ? <Spinner /> : 'Mark reviewed'}
          </button>
        ) : (
          <button
            onClick={() => setStatus('new')}
            disabled={busy}
            className="btn-ghost text-xs shrink-0"
          >
            {busy ? <Spinner /> : 'Reopen'}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {items.map((it, i) => (
          <div
            key={`${it.variant_id || it.product_id}-${i}`}
            className="rounded-xl border border-espresso/5 bg-white overflow-hidden"
          >
            <div className="aspect-[4/5] bg-cream overflow-hidden">
              {it.image ? (
                <img
                  src={it.image}
                  alt={it.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              ) : null}
            </div>
            <div className="p-2">
              <p className="text-xs font-medium text-espresso leading-tight line-clamp-2">
                {it.title}
              </p>
              {it.color && <p className="text-[11px] text-espresso/45">{it.color}</p>}
              {it.price != null && (
                <p className="text-[11px] text-espresso/60 mt-0.5">{money(it.price)}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {selection.shipping_address && (
          <ShipTo address={selection.shipping_address} />
        )}
        {selection.note && (
          <div className="bg-cream rounded-xl px-4 py-3 border border-espresso/5">
            <p className="label">Note from partner</p>
            <p className="text-sm text-espresso/75 italic">“{selection.note}”</p>
          </div>
        )}
      </div>
    </div>
  )
}

// Renders a partner's ship-to address. Tolerant of partial data (older rows,
// or a field the partner left blank).
function ShipTo({ address }) {
  const a = address || {}
  const cityLine = [a.city, a.state].filter(Boolean).join(', ')
  const cityZip = [cityLine, a.zip].filter(Boolean).join(' ')
  return (
    <div className="bg-cream rounded-xl px-4 py-3 border border-espresso/5">
      <p className="label">Ship to</p>
      <address className="not-italic text-sm text-espresso/75 leading-snug">
        {a.name && <div className="font-medium text-espresso">{a.name}</div>}
        {a.line1 && <div>{a.line1}</div>}
        {a.line2 && <div>{a.line2}</div>}
        {cityZip && <div>{cityZip}</div>}
      </address>
    </div>
  )
}

/* ───────────────────────── Everyone Contacted ───────────────────── */

function OutreachTab() {
  const roster = contactedRoster.contacted || []
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const { total, byStatus, byCategory } = summarize(roster)

  const STATUS_KEYS = [
    'active',
    'gifted',
    'yes-awaiting',
    'needs-follow-up',
    'no-show',
    'interested',
    'contacted',
    'declined',
  ]
  const CATEGORY_KEYS = ['stylist', 'blogger-influencer', 'platform-partner', 'UGC']

  let rows = roster
  if (statusFilter !== 'All') rows = rows.filter((r) => r.status === statusFilter)
  if (categoryFilter !== 'All') rows = rows.filter((r) => r.category === categoryFilter)
  rows = sortRows(rows)

  const statusTabs = [
    { id: 'All', label: `All (${total})` },
    ...STATUS_KEYS.filter((s) => byStatus[s]).map((s) => ({
      id: s,
      label: `${statusLabel(s)} (${byStatus[s]})`,
    })),
  ]
  const categoryTabs = [
    { id: 'All', label: `All (${total})` },
    ...CATEGORY_KEYS.filter((c) => byCategory[c]).map((c) => ({
      id: c,
      label: `${catLabel(c)} (${byCategory[c]})`,
    })),
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-3xl text-espresso">Everyone Contacted</h2>
          <p className="text-sm text-espresso/55 mt-1 max-w-xl">
            The full PLANET Style Collective outreach list — everyone reached out to,
            with category and status. No dates by design.
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button onClick={() => downloadContactedPDF(roster)} className="btn-gold">
            ⬇ Pull report (PDF)
          </button>
          <button onClick={() => downloadContactedCSV(roster)} className="btn-outline text-xs">
            Export CSV
          </button>
        </div>
      </div>

      {/* Summary counts */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        <MiniStat label="Total" value={total} />
        {STATUS_KEYS.map((s) => (
          <MiniStat key={s} label={statusLabel(s)} value={byStatus[s] || 0} />
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-espresso/40 mr-1">
            Status
          </span>
          {statusTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setStatusFilter(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-wide border transition ${
                statusFilter === t.id
                  ? 'border-gold bg-gold/15 text-espresso'
                  : 'border-espresso/15 text-espresso/55 hover:border-espresso/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase tracking-widest text-espresso/40 mr-1">
            Category
          </span>
          {categoryTabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setCategoryFilter(t.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-wide border transition ${
                categoryFilter === t.id
                  ? 'border-gold bg-gold/15 text-espresso'
                  : 'border-espresso/15 text-espresso/55 hover:border-espresso/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="text-xs text-espresso/45">
        Showing {rows.length} of {total}
      </div>

      {rows.length === 0 ? (
        <EmptyState title="No one matches these filters" hint="Try a different status or category." />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-espresso/50 text-xs uppercase tracking-widest border-b border-espresso/10">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Business</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.name}-${i}`} className="border-b border-espresso/5 last:border-0">
                  <td className="px-5 py-3 font-medium text-espresso">{r.name}</td>
                  <td className="px-5 py-3 text-espresso/60">{r.business || '—'}</td>
                  <td className="px-5 py-3 text-espresso/60">{catLabel(r.category)}</td>
                  <td className="px-5 py-3">
                    <StatusPill status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────── Kit Tracker ─────────────────────────── */

// Whole days from today (local, date-only) until a YYYY-MM-DD date.
// Negative = the date is in the past.
function daysUntil(dateStr) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [y, m, d] = dateStr.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

// 30-day return-window countdown pill. Milestones are days REMAINING:
// >15 normal · ≤15 follow-up due (amber) · ≤5 final follow-up (red) · past = overdue.
function ReturnCountdown({ date }) {
  const left = daysUntil(date)
  let tone, label
  if (left < 0) {
    tone = 'bg-red-200 text-red-800'
    label = `Overdue by ${Math.abs(left)} ${Math.abs(left) === 1 ? 'day' : 'days'}`
  } else {
    const noun = left === 1 ? 'day' : 'days'
    if (left <= 5) {
      tone = 'bg-red-100 text-red-700'
      label = `${left} ${noun} left · final follow-up`
    } else if (left <= 15) {
      tone = 'bg-amber-100 text-amber-700'
      label = `${left} ${noun} left · follow-up due`
    } else {
      tone = 'bg-espresso/10 text-espresso/60'
      label = `${left} ${noun} left`
    }
  }
  return (
    <span
      title={`Return by ${date}`}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${tone}`}
    >
      {label}
    </span>
  )
}

// Live shipment-status pill (mirrors ReturnCountdown's styling). Driven by
// kits.delivery_status, which AfterShip updates via webhook + 6h cron.
//   in_transit / out_for_delivery → amber · delivered → green (with date)
//   exception → red · pending → muted.
function ShipmentPill({ status, deliveredAt }) {
  const map = {
    pending: { tone: 'bg-espresso/10 text-espresso/60', label: 'Tracking · pending' },
    in_transit: { tone: 'bg-amber-100 text-amber-700', label: 'In transit' },
    out_for_delivery: { tone: 'bg-amber-100 text-amber-700', label: 'Out for delivery' },
    delivered: { tone: 'bg-green-100 text-green-700', label: 'Delivered' },
    exception: { tone: 'bg-red-100 text-red-700', label: 'Delivery issue' },
  }
  const { tone, label } = map[status] || map.pending
  const date =
    status === 'delivered' && deliveredAt
      ? new Date(deliveredAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      : null
  return (
    <span
      title={`Shipment status: ${status || 'pending'}`}
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${tone}`}
    >
      {date ? `${label} · ${date}` : label}
    </span>
  )
}

// Chips listing a kit's pieces + each piece's Keep/Return decision. Shared by
// the current and previous box panels (previous renders slightly muted).
function PieceChips({ pieces, muted = false }) {
  if (!pieces || pieces.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {pieces.map((pc) => (
        <span
          key={pc.id}
          className={`inline-flex items-center gap-2 rounded-full pl-3 pr-2 py-1 text-xs border border-espresso/5 ${
            muted ? 'bg-cream/60' : 'bg-white'
          }`}
        >
          <span className={muted ? 'text-espresso/70' : 'text-espresso'}>{pc.piece_name}</span>
          {pc.color && <span className="text-espresso/40">· {pc.color}</span>}
          {pc.partner_decision && <Badge status={pc.partner_decision} />}
        </span>
      ))}
    </div>
  )
}

// The CURRENT box: the active kit a partner has in hand (or being prepped),
// shown prominently with status, return countdown, live shipment state, and
// its pieces.
function CurrentKitPanel({ kit, pieces }) {
  return (
    <div className="rounded-2xl bg-cream/60 border border-espresso/5 p-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge status={kit.status} />
        {kit.return_by_date && <ReturnCountdown date={kit.return_by_date} />}
        {kit.tracking_number && (
          <ShipmentPill status={kit.delivery_status} deliveredAt={kit.delivered_at} />
        )}
        {kit.followup_drafted_at && !kit.followup_note && (
          <span
            title={`Follow-up drafted ${new Date(kit.followup_drafted_at).toLocaleString()}`}
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide bg-green-100 text-green-700"
          >
            Follow-up drafted ✓
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-espresso/55">
        <span>Ship: {kit.ship_date || '—'}</span>
        <span>Tracking: {kit.tracking_number || 'pending'}</span>
        <span>Carrier: {kit.carrier || '—'}</span>
        <span>Return by: {kit.return_by_date || '—'}</span>
      </div>
      {kit.followup_note && (
        <p className="mt-2 inline-flex items-center rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          {kit.followup_note}
        </p>
      )}
      <PieceChips pieces={pieces} />
      {kit.notes && <p className="mt-3 text-xs text-espresso/50 italic">{kit.notes}</p>}
    </div>
  )
}

// A PREVIOUS box: a returned kit. A clean one-line history entry — no pieces,
// no countdown. Pieces belong only to the current box.
function PreviousKitPanel({ kit, onManage }) {
  return (
    <div className="rounded-xl bg-espresso/[0.03] border border-espresso/5 px-4 py-3">
      <div className="flex items-center gap-x-3 gap-y-1 flex-wrap text-xs text-espresso/55">
        <Badge status={kit.status} />
        {kit.ship_date && <span>Shipped {kit.ship_date}</span>}
        {kit.tracking_number && <span className="text-espresso/40">{kit.tracking_number}</span>}
        <button
          onClick={onManage}
          className="ml-auto text-espresso/40 hover:text-gold"
        >
          Manage
        </button>
      </div>
      {kit.notes && <p className="mt-2 text-[11px] text-espresso/45 italic">{kit.notes}</p>}
    </div>
  )
}

function KitsTab({ partners, kits, pieces, onChange }) {
  const [editing, setEditing] = useState(null) // { partner, kit } — kit null = create new box

  // Group ALL kits per partner (a partner can have several over time), newest
  // first. `kits` already arrives ordered by created_at desc.
  const kitsByPartner = kits.reduce((acc, k) => {
    ;(acc[k.partner_id] = acc[k.partner_id] || []).push(k)
    return acc
  }, {})
  const piecesByKit = pieces.reduce((acc, pc) => {
    ;(acc[pc.kit_id] = acc[pc.kit_id] || []).push(pc)
    return acc
  }, {})

  return (
    <div>
      <h2 className="font-heading text-3xl text-espresso mb-5">Kit Tracker</h2>

      {partners.length === 0 ? (
        <EmptyState title="No partners yet" hint="Add partners first, then build their kits." />
      ) : (
        <div className="space-y-4">
          {partners.map((p) => {
            const partnerKits = kitsByPartner[p.id] || []
            const currentKits = partnerKits.filter(isActiveKit)
            const previousKits = partnerKits.filter((k) => !isActiveKit(k))
            const currentKit = currentKits[0] || null // most-recent active box
            const firstName = p.name.split(' ')[0]

            return (
              <div key={p.id} className="card p-5">
                {/* Header — name + at-a-glance box state */}
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="font-heading text-xl text-espresso">{p.name}</h3>
                    <PlatformBadge platform={p.platform} />
                    {currentKit ? (
                      <Badge status={currentKit.status} />
                    ) : (
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide bg-espresso/5 text-espresso/45">
                        No box currently out
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setEditing({ partner: p, kit: currentKit })}
                    className="btn-outline text-xs"
                  >
                    {currentKit
                      ? 'Manage current box'
                      : partnerKits.length
                      ? 'Send new box'
                      : 'Create kit'}
                  </button>
                </div>

                {/* CURRENT box */}
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-widest text-espresso/40 mb-2">
                    Current box
                  </p>
                  {currentKits.length > 0 ? (
                    <div className="space-y-3">
                      {currentKits.map((k) => (
                        <CurrentKitPanel key={k.id} kit={k} pieces={piecesByKit[k.id] || []} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-espresso/45">
                      No box currently out — nothing with {firstName} right now.
                    </p>
                  )}
                </div>

                {/* PREVIOUS boxes */}
                {previousKits.length > 0 && (
                  <div className="mt-5 border-t border-espresso/10 pt-4">
                    <p className="text-[11px] uppercase tracking-widest text-espresso/40 mb-2">
                      Previous boxes · {previousKits.length} returned
                    </p>
                    <div className="space-y-2">
                      {previousKits.map((k) => (
                        <PreviousKitPanel
                          key={k.id}
                          kit={k}
                          onManage={() => setEditing({ partner: p, kit: k })}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <KitModal
          partner={editing.partner}
          kit={editing.kit}
          pieces={editing.kit ? pieces.filter((x) => x.kit_id === editing.kit.id) : []}
          onClose={() => setEditing(null)}
          onChange={onChange}
        />
      )}
    </div>
  )
}

function KitModal({ partner, kit, pieces, onClose, onChange }) {
  const [form, setForm] = useState({
    status: kit?.status || 'Preparing',
    ship_date: kit?.ship_date || '',
    tracking_number: kit?.tracking_number || '',
    return_by_date: kit?.return_by_date || '',
    notes: kit?.notes || '',
  })
  const [busy, setBusy] = useState(false)
  const [localPieces, setLocalPieces] = useState(pieces)
  const [newPiece, setNewPiece] = useState({ piece_name: '', color: '', photo_url: '' })
  const [trackMsg, setTrackMsg] = useState('')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // Ensures a kit exists, returns its id.
  async function ensureKit() {
    if (kit?.id) {
      await supabase.from('kits').update(form).eq('id', kit.id)
      return kit.id
    }
    const { data } = await supabase
      .from('kits')
      .insert({ ...form, partner_id: partner.id })
      .select()
      .single()
    return data.id
  }

  // Register the tracking number with AfterShip (carrier auto-detected) so the
  // portal tracks it live and drafts the delivery follow-up. Non-blocking:
  // failures surface a note but never stop the kit from saving.
  async function startTracking(kitId) {
    const tn = (form.tracking_number || '').trim()
    if (!tn) return false
    // Only (re)register when the number is new or changed since it was opened.
    const changed = tn !== (kit?.tracking_number || '').trim()
    const neverRegistered = !kit?.aftership_tracking_id
    if (!changed && !neverRegistered) return false

    setTrackMsg('Starting live tracking…')
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess?.session?.access_token
      const resp = await fetch('/api/tracking/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ kit_id: kitId, tracking_number: tn }),
      })
      const data = await resp.json().catch(() => ({}))
      if (resp.ok && data.ok) {
        setTrackMsg(
          data.dryRun
            ? 'Tracking (dry run) — logged, no AfterShip call.'
            : `Live tracking started${data.carrier ? ` · ${data.carrier}` : ''}.`
        )
      } else if (data.configured === false) {
        setTrackMsg('Saved. AfterShip not configured yet — tracking will start once it is.')
      } else {
        setTrackMsg(`Saved, but tracking couldn’t start: ${data.error || data.message || 'unknown error'}`)
      }
    } catch (err) {
      setTrackMsg(`Saved, but tracking couldn’t start: ${err.message}`)
    }
    return true
  }

  async function saveKit() {
    setBusy(true)
    const kitId = await ensureKit()
    const attempted = await startTracking(kitId)
    setBusy(false)
    onChange()
    // If we kicked off tracking, give the admin a beat to read the result.
    if (attempted) setTimeout(onClose, 1400)
    else onClose()
  }

  async function addPiece() {
    if (!newPiece.piece_name.trim()) return
    setBusy(true)
    const kitId = await ensureKit()
    const { data } = await supabase
      .from('kit_pieces')
      .insert({ ...newPiece, kit_id: kitId })
      .select()
      .single()
    setLocalPieces((prev) => [...prev, data])
    setNewPiece({ piece_name: '', color: '', photo_url: '' })
    setBusy(false)
    onChange()
  }

  async function deletePiece(id) {
    setBusy(true)
    await supabase.from('kit_pieces').delete().eq('id', id)
    setLocalPieces((prev) => prev.filter((p) => p.id !== id))
    setBusy(false)
    onChange()
  }

  return (
    <Modal title={`${partner.name}'s kit`} onClose={onClose}>
      <div className="space-y-4">
        <Field label="Kit status">
          <select
            className="input"
            value={form.status}
            onChange={(e) => set('status', e.target.value)}
          >
            {KIT_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ship date">
            <input
              type="date"
              className="input"
              value={form.ship_date || ''}
              onChange={(e) => set('ship_date', e.target.value)}
            />
          </Field>
          <Field label="Return by">
            <input
              type="date"
              className="input"
              value={form.return_by_date || ''}
              onChange={(e) => set('return_by_date', e.target.value)}
            />
          </Field>
        </div>
        <Field label="Tracking number">
          <input
            className="input"
            placeholder="Any carrier — auto-detected"
            value={form.tracking_number || ''}
            onChange={(e) => set('tracking_number', e.target.value)}
          />
          <p className="mt-1 text-[11px] text-espresso/45">
            Saving a tracking number starts live tracking. When it’s delivered, a
            draft follow-up email is created in Outlook for you to review — never sent
            automatically.
          </p>
          {trackMsg && <p className="mt-1 text-xs text-gold">{trackMsg}</p>}
        </Field>
        <Field label="Internal notes">
          <textarea
            rows={2}
            className="input resize-none"
            value={form.notes || ''}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        {/* Pieces */}
        <div className="border-t border-espresso/10 pt-4">
          <p className="label">Kit pieces</p>
          <div className="space-y-2">
            {localPieces.length === 0 && (
              <p className="text-xs text-espresso/40">No pieces yet.</p>
            )}
            {localPieces.map((pc) => (
              <div
                key={pc.id}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-espresso/5"
              >
                {pc.photo_url ? (
                  <img
                    src={pc.photo_url}
                    alt=""
                    className="w-9 h-9 rounded-lg object-cover"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-cream" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-espresso truncate">{pc.piece_name}</p>
                  <p className="text-xs text-espresso/40">{pc.color || '—'}</p>
                </div>
                {pc.partner_decision && <Badge status={pc.partner_decision} />}
                <button
                  onClick={() => deletePiece(pc.id)}
                  className="text-espresso/30 hover:text-red-600 text-sm px-1"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          {/* Add piece */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            <input
              className="input"
              placeholder="Piece name"
              value={newPiece.piece_name}
              onChange={(e) => setNewPiece((n) => ({ ...n, piece_name: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Color"
              value={newPiece.color}
              onChange={(e) => setNewPiece((n) => ({ ...n, color: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Photo URL"
              value={newPiece.photo_url}
              onChange={(e) => setNewPiece((n) => ({ ...n, photo_url: e.target.value }))}
            />
          </div>
          <button
            onClick={addPiece}
            disabled={busy || !newPiece.piece_name.trim()}
            className="btn-outline text-xs mt-2"
          >
            + Add piece
          </button>
        </div>

        <div className="flex justify-end pt-2">
          <button onClick={saveKit} disabled={busy} className="btn-primary">
            {busy ? <Spinner /> : 'Save kit'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

/* ───────────────────────── Content Tracker ───────────────────────── */

function ContentTab({ partners, content, onChange }) {
  const [adding, setAdding] = useState(false)
  const partnerName = Object.fromEntries(partners.map((p) => [p.id, p.name]))

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-3xl text-espresso">Content Tracker</h2>
        <button
          onClick={() => setAdding(true)}
          disabled={partners.length === 0}
          className="btn-gold"
        >
          + Log content
        </button>
      </div>

      {content.length === 0 ? (
        <EmptyState
          title="Nothing logged yet"
          hint="Log what each partner has posted to keep track."
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-espresso/50 text-xs uppercase tracking-widest border-b border-espresso/10">
                <th className="px-5 py-3 font-medium">Partner</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Notes</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {content.map((c) => (
                <ContentRow
                  key={c.id}
                  row={c}
                  name={partnerName[c.partner_id] || 'Unknown'}
                  onChange={onChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {adding && (
        <ContentModal
          partners={partners}
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false)
            onChange()
          }}
        />
      )}
    </div>
  )
}

function ContentRow({ row, name, onChange }) {
  async function remove() {
    if (!confirm('Delete this content entry?')) return
    await supabase.from('content_log').delete().eq('id', row.id)
    onChange()
  }
  return (
    <tr className="border-b border-espresso/5 last:border-0">
      <td className="px-5 py-3 font-medium text-espresso">{name}</td>
      <td className="px-5 py-3">
        <Badge status={row.content_type} />
      </td>
      <td className="px-5 py-3 text-espresso/60">{row.post_date || '—'}</td>
      <td className="px-5 py-3 text-espresso/60">{row.notes || '—'}</td>
      <td className="px-5 py-3 text-right">
        <button onClick={remove} className="btn-ghost text-xs text-red-600 hover:bg-red-50">
          Delete
        </button>
      </td>
    </tr>
  )
}

function ContentModal({ partners, onClose, onSaved }) {
  const [form, setForm] = useState({
    partner_id: partners[0]?.id || '',
    content_type: 'Reel',
    post_date: '',
    notes: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const payload = { ...form, post_date: form.post_date || null }
    const { error } = await supabase.from('content_log').insert(payload)
    setBusy(false)
    if (error) setError(error.message)
    else onSaved()
  }

  return (
    <Modal title="Log content" onClose={onClose}>
      <form onSubmit={save} className="space-y-4">
        <Field label="Partner">
          <select
            className="input"
            value={form.partner_id}
            onChange={(e) => set('partner_id', e.target.value)}
          >
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Content type">
          <select
            className="input"
            value={form.content_type}
            onChange={(e) => set('content_type', e.target.value)}
          >
            {CONTENT_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Post date">
          <input
            type="date"
            className="input"
            value={form.post_date}
            onChange={(e) => set('post_date', e.target.value)}
          />
        </Field>
        <Field label="Notes">
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Views, engagement, link, anything worth noting…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button type="submit" disabled={busy} className="btn-primary">
            {busy ? <Spinner /> : 'Log it'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

/* ────────────────────────────── Stats ────────────────────────────── */

// Live internal metrics, recomputed from the bundled data snapshots on every
// mount (see src/lib/stats.js). No backend — pure functions of the shipped JSON.
function StatsTab() {
  const { outreach, boxes, partners, social } = useMemo(() => computeStats(), [])

  const pct = (n) => `${(n * 100).toFixed(1)}%`
  const nfmt = (n) => n.toLocaleString('en-US')

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl text-espresso">Stats</h2>
        <p className="text-sm text-espresso/55 mt-1 max-w-2xl">
          Live metrics computed from the current outreach roster and box/partner data.
          Recomputed each time you open this tab.
        </p>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Contacts reached"
          value={outreach.total}
          sub={`${outreach.replied} responded`}
        />
        <Metric
          label="Response rate"
          value={pct(outreach.responseRate)}
          accent="text-gold"
          sub="replies ÷ contacted"
        />
        <Metric
          label="Stylists onboarded"
          value={partners.onboarded}
          accent="text-green-700"
          sub={`${partners.total} in roster`}
        />
        <Metric
          label="Boxes shipped"
          value={boxes.shipped}
          sub={`of ${boxes.total} built`}
        />
        <Metric
          label="Partner posts"
          value={social.totalPosts}
          accent="text-gold"
          sub="featuring PLANET"
        />
        <Metric
          label="Post engagement"
          value={nfmt(social.totalEngagement)}
          sub="likes + comments + shares + sends"
        />
      </div>

      {/* Outreach */}
      <div className="card p-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <h3 className="font-heading text-xl text-espresso mb-1">Outreach</h3>
            <p className="text-xs text-espresso/45">
              {outreach.replied} of {outreach.total} contacts have responded — a{' '}
              {pct(outreach.responseRate)} response rate. A contact counts as “replied”
              once their status moves off <em>Contacted</em>.
            </p>
          </div>
        </div>

        {/* Status funnel */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <MiniStat label="Contacted" value={outreach.total} />
          <MiniStat label="Replied" value={outreach.replied} />
          <MiniStat label="Active partners" value={outreach.byStatus.active || 0} />
          <MiniStat label="Declined" value={outreach.byStatus.declined || 0} />
        </div>

        {/* Response rate by category (batch/template not available in the data) */}
        <p className="text-[11px] uppercase tracking-widest text-espresso/40 mb-2">
          Response rate by category
        </p>
        <div className="divide-y divide-espresso/5">
          {outreach.categoryRates.map((c) => (
            <div key={c.key} className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-espresso/70">{catLabel(c.key)}</span>
              <span className="flex items-center gap-3 shrink-0 text-sm">
                <span className="text-espresso/45 tabular-nums">
                  {c.replied}/{c.total}
                </span>
                <span className="font-medium text-espresso tabular-nums w-14 text-right">
                  {pct(c.rate)}
                </span>
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-espresso/40 mt-3">
          Breakdown by outreach batch or message template isn’t available — the roster
          data doesn’t record those fields.
        </p>
      </div>

      {/* Boxes */}
      <div className="card p-6">
        <h3 className="font-heading text-xl text-espresso mb-1">Boxes</h3>
        <p className="text-xs text-espresso/45 mb-4">
          Sample-kit pipeline across {boxes.total} box{boxes.total === 1 ? '' : 'es'}.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <MiniStat label="Shipped" value={boxes.shipped} />
          <MiniStat label="Delivered" value={boxes.delivered} />
          <MiniStat label="Currently out" value={boxes.currentlyOut} />
          <MiniStat label="Returned" value={boxes.returned} />
          <MiniStat
            label="Avg days to return"
            value={boxes.avgDaysToReturn == null ? '—' : boxes.avgDaysToReturn}
          />
        </div>
        {boxes.avgDaysToReturn == null && (
          <p className="text-[11px] text-espresso/40 mt-3">
            Avg days-to-return is blank — actual return dates aren’t captured in the
            current data (only ship date and the return-by deadline).
          </p>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────── Social ───────────────────────────── */

// Partner social posts featuring PLANET, grouped by partner with per-post and
// per-partner engagement roll-ups. Pure function of scripts/social_posts.json
// (see computeSocial in src/lib/stats.js). Views is a first-class column but is
// null on every post today — kept visible so it's ready once Sofia fills it in.
function SocialTab() {
  const social = useMemo(() => computeSocial(), [])
  const nfmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'))

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-heading text-3xl text-espresso">Social</h2>
        <p className="text-sm text-espresso/55 mt-1 max-w-2xl">
          Partner content featuring PLANET — Instagram posts, blog features, and email
          blasts — with engagement where it applies. Numbers are the visible counts at
          capture time. A blank cell means that metric wasn’t shown or doesn’t apply
          (common on blogs/emails) — different from zero.
        </p>
      </div>

      {/* Headline roll-ups */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Metric
          label="Partner content"
          value={social.totalPosts}
          sub={
            Object.entries(social.byType)
              .map(([t, n]) => `${n} ${t}`)
              .join(' · ') ||
            `${social.partners.length} partner${social.partners.length === 1 ? '' : 's'}`
          }
        />
        <Metric
          label="Total engagement"
          value={nfmt(social.totalEngagement)}
          accent="text-gold"
          sub="likes + comments + shares + sends"
        />
        <Metric
          label="Avg engagement / post"
          value={nfmt(social.avgEngagement)}
          sub="across all posts"
        />
        <Metric
          label="Total views"
          value={social.viewsCount ? nfmt(social.totalViews) : '—'}
          accent="text-green-700"
          sub={
            social.viewsCount
              ? `${social.viewsCount} of ${social.totalPosts} posts have views`
              : 'not captured yet'
          }
        />
      </div>

      {/* Engagement breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MiniStat label="Likes" value={nfmt(social.totalLikes)} />
        <MiniStat label="Comments" value={nfmt(social.totalComments)} />
        <MiniStat label="Shares" value={nfmt(social.totalShares)} />
        <MiniStat label="Sends" value={nfmt(social.totalSends)} />
      </div>

      {social.missingViews > 0 && (
        <p className="text-[11px] text-espresso/40 -mt-4">
          Views aren’t captured on {social.missingViews} of {social.totalPosts} post
          {social.totalPosts === 1 ? '' : 's'} — IG view counts weren’t visible in the
          source. The column is ready to fill in on scripts/social_posts.json.
        </p>
      )}

      {/* Posts grouped by partner */}
      {social.partners.map((g) => (
        <div key={g.handle} className="card p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
            <div>
              <h3 className="font-heading text-xl text-espresso mb-0.5">
                {g.name || g.handle}
              </h3>
              <p className="text-xs text-espresso/45">
                {g.handle} · {g.posts.length} post{g.posts.length === 1 ? '' : 's'} ·{' '}
                {nfmt(g.engagement)} total engagement
              </p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] uppercase tracking-widest text-espresso/40 text-left">
                  <th className="font-medium px-2 pb-2">Post</th>
                  <th className="font-medium px-2 pb-2 text-right tabular-nums">Likes</th>
                  <th className="font-medium px-2 pb-2 text-right tabular-nums">Comments</th>
                  <th className="font-medium px-2 pb-2 text-right tabular-nums">Shares</th>
                  <th className="font-medium px-2 pb-2 text-right tabular-nums">Sends</th>
                  <th className="font-medium px-2 pb-2 text-right tabular-nums">Views</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-espresso/5">
                {g.posts.map((p, i) => (
                  <tr key={i} className="align-top">
                    <td className="px-2 py-2.5 max-w-md">
                      <div className="flex items-start gap-2">
                        <span className="mt-0.5 shrink-0 inline-block rounded-full bg-espresso/5 px-2 py-0.5 text-[10px] uppercase tracking-widest text-espresso/55 font-medium">
                          {p.type || 'Other'}
                        </span>
                        <div className="min-w-0">
                          {p.permalink ? (
                            <a
                              href={p.permalink}
                              target="_blank"
                              rel="noreferrer"
                              className="text-espresso/80 leading-snug hover:text-gold underline decoration-espresso/15 underline-offset-2"
                            >
                              {p.caption}
                            </a>
                          ) : (
                            <p className="text-espresso/80 leading-snug">{p.caption}</p>
                          )}
                          <p className="text-[11px] text-espresso/40 mt-0.5">
                            {p.platform}
                            {' · '}
                            {p.posted_date || 'date unknown'}
                            {p.date_note ? ` (${p.date_note})` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-espresso/70">
                      {nfmt(p.likes)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-espresso/70">
                      {nfmt(p.comments)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-espresso/70">
                      {nfmt(p.shares)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-espresso/70">
                      {nfmt(p.sends)}
                    </td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-espresso/40">
                      {nfmt(p.views)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-espresso/10 text-espresso font-semibold">
                  <td className="px-2 pt-2.5 text-[11px] uppercase tracking-widest text-espresso/55">
                    Partner total
                  </td>
                  <td className="px-2 pt-2.5 text-right tabular-nums">{nfmt(g.likes)}</td>
                  <td className="px-2 pt-2.5 text-right tabular-nums">{nfmt(g.comments)}</td>
                  <td className="px-2 pt-2.5 text-right tabular-nums">{nfmt(g.shares)}</td>
                  <td className="px-2 pt-2.5 text-right tabular-nums">{nfmt(g.sends)}</td>
                  <td className="px-2 pt-2.5 text-right tabular-nums text-espresso/55">
                    {g.viewsCount ? nfmt(g.views) : '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}

/* ───────────────────────────── Daily Log ─────────────────────────── */

// Local YYYY-MM-DD for "today" (avoids UTC drift from toISOString()).
function todayStr() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Manual daily metrics not in any system — one editable row per day, persisted
// to Supabase (public.daily_log, see supabase/content_tracker.sql). Upserts on
// log_date so re-saving a day edits it in place.
function DailyLogTab({ dailyLogs, onChange }) {
  const [date, setDate] = useState(todayStr())
  const existing = dailyLogs.find((d) => d.log_date === date) || null

  const blank = {
    reels_posted: '',
    reposts: '',
    dms_sent: '',
    dms_unread: '',
    notes: '',
    weekly_goal: '',
    on_track: '',
    blockers: '',
  }
  const toForm = (row) =>
    row
      ? {
          reels_posted: row.reels_posted ?? '',
          reposts: row.reposts ?? '',
          dms_sent: row.dms_sent ?? '',
          dms_unread: row.dms_unread ?? '',
          notes: row.notes ?? '',
          weekly_goal: row.weekly_goal ?? '',
          on_track: row.on_track === true ? 'yes' : row.on_track === false ? 'no' : '',
          blockers: row.blockers ?? '',
        }
      : blank

  const [form, setForm] = useState(toForm(existing))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // { ok } | { error }

  // Re-sync the form whenever the selected day (or its saved row) changes.
  useEffect(() => {
    setForm(toForm(existing))
    setMsg(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, existing?.id])

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  // Empty string → null; otherwise a non-negative integer.
  const numOrNull = (v) => (v === '' || v === null ? null : Number(v))

  async function save() {
    setBusy(true)
    setMsg(null)
    const payload = {
      log_date: date,
      reels_posted: numOrNull(form.reels_posted),
      reposts: numOrNull(form.reposts),
      dms_sent: numOrNull(form.dms_sent),
      dms_unread: numOrNull(form.dms_unread),
      notes: form.notes.trim() || null,
      weekly_goal: form.weekly_goal.trim() || null,
      on_track: form.on_track === 'yes' ? true : form.on_track === 'no' ? false : null,
      blockers: form.blockers.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase
      .from('daily_log')
      .upsert(payload, { onConflict: 'log_date' })
    setBusy(false)
    if (error) {
      setMsg({
        error: `Couldn't save — ${error.message}. If the table is missing, run supabase/content_tracker.sql in the Supabase SQL Editor.`,
      })
    } else {
      setMsg({ ok: true })
      onChange()
    }
  }

  const numberFields = [
    { label: 'Reels / posts published', k: 'reels_posted' },
    { label: 'Reposted', k: 'reposts' },
    { label: 'IG/FB DMs sent', k: 'dms_sent' },
    { label: 'DMs unread', k: 'dms_unread' },
  ]

  const isToday = date === todayStr()

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-3xl text-espresso">Daily Log</h2>
          <p className="text-sm text-espresso/55 mt-1 max-w-xl">
            Manual daily metrics that aren’t in any system. One entry per day —
            re-saving a day updates it. Feeds the EOD Draft.
          </p>
        </div>
        <Field label="Day">
          <input
            type="date"
            className="input"
            value={date}
            max={todayStr()}
            onChange={(e) => setDate(e.target.value)}
          />
        </Field>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-widest text-espresso/40">
            {isToday ? 'Today' : 'Editing'}
          </span>
          {existing && (
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-green-100 text-green-700">
              Saved entry
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {numberFields.map(({ label, k }) => (
            <Field key={k} label={label}>
              <input
                type="number"
                min="0"
                className="input"
                placeholder="—"
                value={form[k]}
                onChange={(e) => set(k, e.target.value)}
              />
            </Field>
          ))}
        </div>

        <Field label="Ops notes">
          <textarea
            rows={3}
            className="input resize-none"
            placeholder="Anything worth noting about today…"
            value={form.notes}
            onChange={(e) => set('notes', e.target.value)}
          />
        </Field>

        <Field label="Weekly goal">
          <input
            className="input"
            placeholder="What this week is aiming at"
            value={form.weekly_goal}
            onChange={(e) => set('weekly_goal', e.target.value)}
          />
        </Field>

        <div className="grid sm:grid-cols-[auto_1fr] gap-3 items-start">
          <Field label="On track?">
            <select
              className="input"
              value={form.on_track}
              onChange={(e) => set('on_track', e.target.value)}
            >
              <option value="">—</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
          <Field label="Blockers">
            <input
              className="input"
              placeholder="What's in the way, if anything"
              value={form.blockers}
              onChange={(e) => set('blockers', e.target.value)}
            />
          </Field>
        </div>

        {msg?.error && <p className="text-sm text-red-600">{msg.error}</p>}
        {msg?.ok && <p className="text-sm text-green-700">Saved.</p>}

        <div className="flex justify-end">
          <button onClick={save} disabled={busy} className="btn-primary">
            {busy ? <Spinner /> : existing ? 'Update entry' : 'Save entry'}
          </button>
        </div>
      </div>

      {/* Recent entries */}
      {dailyLogs.length > 0 && (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-espresso/50 text-xs uppercase tracking-widest border-b border-espresso/10">
                <th className="px-5 py-3 font-medium">Day</th>
                <th className="px-5 py-3 font-medium">Reels</th>
                <th className="px-5 py-3 font-medium">Reposts</th>
                <th className="px-5 py-3 font-medium">DMs sent</th>
                <th className="px-5 py-3 font-medium">Unread</th>
                <th className="px-5 py-3 font-medium">On track</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {dailyLogs.map((d) => {
                const dash = (v) => (v === null || v === undefined ? '—' : v)
                return (
                  <tr key={d.id} className="border-b border-espresso/5 last:border-0">
                    <td className="px-5 py-3 font-medium text-espresso">{d.log_date}</td>
                    <td className="px-5 py-3 text-espresso/60 tabular-nums">
                      {dash(d.reels_posted)}
                    </td>
                    <td className="px-5 py-3 text-espresso/60 tabular-nums">
                      {dash(d.reposts)}
                    </td>
                    <td className="px-5 py-3 text-espresso/60 tabular-nums">
                      {dash(d.dms_sent)}
                    </td>
                    <td className="px-5 py-3 text-espresso/60 tabular-nums">
                      {dash(d.dms_unread)}
                    </td>
                    <td className="px-5 py-3">
                      {d.on_track === true ? (
                        <span className="text-green-700">Yes</span>
                      ) : d.on_track === false ? (
                        <span className="text-red-600">No</span>
                      ) : (
                        <span className="text-espresso/30">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setDate(d.log_date)}
                        className="btn-ghost text-xs"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────── EOD Draft ────────────────────────── */

// Copy-paste end-of-day update: live Stats numbers + today's Daily Log entry,
// formatted the way Darien wants (context on each bullet, quantified, blanks
// marked). Generated fresh — no invented numbers.
function EodTab({ dailyLogs }) {
  const [copied, setCopied] = useState(false)
  const today = todayStr()
  const log = dailyLogs.find((d) => d.log_date === today) || null

  const dateLabel = useMemo(
    () =>
      new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }),
    []
  )

  const draft = useMemo(
    () => buildEodDraft({ log, dateLabel }),
    [log, dateLabel]
  )

  async function copy() {
    try {
      await navigator.clipboard.writeText(draft)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard blocked — the textarea below is selectable to copy by hand */
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="font-heading text-3xl text-espresso">EOD Draft</h2>
          <p className="text-sm text-espresso/55 mt-1 max-w-xl">
            End-of-day update built from the live Stats numbers and today’s Daily Log
            entry. Any metric with no data is marked blank — nothing is invented.
          </p>
        </div>
        <button onClick={copy} className="btn-gold shrink-0">
          {copied ? '✓ Copied' : 'Copy update'}
        </button>
      </div>

      {!log && (
        <div className="rounded-lg px-4 py-3 text-sm bg-amber-50 text-amber-700 border border-amber-100">
          No Daily Log entry for today yet — the content, DM, weekly-goal and on-track
          lines will read as blank until you fill in the Daily Log tab.
        </div>
      )}

      <div className="card p-6">
        <textarea
          readOnly
          value={draft}
          rows={draft.split('\n').length + 1}
          className="w-full bg-cream rounded-xl border border-espresso/10 p-4 text-sm text-espresso font-mono leading-relaxed resize-none focus:outline-none"
          onFocus={(e) => e.target.select()}
        />
      </div>
    </div>
  )
}
