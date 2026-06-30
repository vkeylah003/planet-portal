import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Badge, PlatformBadge, Spinner, FullPageLoader, EmptyState, Field } from '../components/ui'
import { fetchImpactSummary } from '../lib/impact'
import contactedRoster from '../../scripts/contacted_data.json'
import {
  downloadContactedPDF,
  downloadContactedCSV,
  summarize,
  sortRows,
  catLabel,
  statusLabel,
} from '../lib/report'

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  )
}

const PARTNER_STATUSES = ['Contacted', 'Interested', 'Active Partner', 'Passed']
const KIT_STATUSES = ['Preparing', 'Shipped', 'Delivered', 'Return Pending', 'Returned']
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

// Outreach roster statuses → on-brand pill tones (lowercase keys match
// scripts/contacted_data.json). Kept here so the Outreach view and any future
// status chips stay consistent.
const OUTREACH_STATUS_TONE = {
  active: 'bg-gold/20 text-gold',
  gifted: 'bg-purple-100 text-purple-700',
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

// Lavie's recommended prospects (not partners in the kit pipeline).
// Edit this list to add/remove names. business + email are optional.
const LAVIE_RECOMMENDATIONS = [
  { name: 'Hollie Dwyer' },
  { name: 'Maiysha Cade' },
  { name: 'Dani', business: 'Live Like You Green It', email: 'dani@livelikeyougreenit.com' },
]

export default function AdminDashboard() {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')

  const [loading, setLoading] = useState(true)
  const [partners, setPartners] = useState([])
  const [kits, setKits] = useState([])
  const [pieces, setPieces] = useState([])
  const [content, setContent] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    const [p, k, pc, c] = await Promise.all([
      supabase.from('partners').select('*').order('created_at', { ascending: false }),
      supabase.from('kits').select('*').order('created_at', { ascending: false }),
      supabase.from('kit_pieces').select('*').order('created_at', { ascending: true }),
      supabase.from('content_log').select('*').order('post_date', { ascending: false }),
    ])
    setPartners(p.data || [])
    setKits(k.data || [])
    setPieces(pc.data || [])
    setContent(c.data || [])
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <FullPageLoader label="Loading dashboard…" />

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'partners', label: 'Partners' },
    { id: 'outreach', label: 'Everyone Contacted' },
    { id: 'kits', label: 'Kit Tracker' },
    { id: 'content', label: 'Content Tracker' },
    { id: 'recommendations', label: 'Recommendations' },
  ]

  return (
    <div className="min-h-screen pb-20">
      <header className="border-b border-espresso/5 bg-cream/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-heading text-xl tracking-[0.2em]">
            PLANET{' '}
            <span className="text-gold text-xs tracking-[0.3em]">Internal Dashboard</span>
          </div>
          <button
            onClick={() => signOut().then(() => navigate('/'))}
            className="btn-ghost text-xs"
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
              className={`px-4 py-3 text-sm font-medium tracking-wide -mb-px border-b-2 transition ${
                tab === t.id
                  ? 'border-gold text-espresso'
                  : 'border-transparent text-espresso/45 hover:text-espresso/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <OverviewTab partners={partners} kits={kits} pieces={pieces} content={content} />
        )}
        {tab === 'partners' && <PartnersTab partners={partners} onChange={load} />}
        {tab === 'outreach' && <OutreachTab />}
        {tab === 'kits' && (
          <KitsTab partners={partners} kits={kits} pieces={pieces} onChange={load} />
        )}
        {tab === 'content' && (
          <ContentTab partners={partners} content={content} onChange={load} />
        )}
        {tab === 'recommendations' && <RecommendationsTab />}
      </main>
    </div>
  )
}

/* ───────────────────────────── Overview ──────────────────────────── */

function Metric({ label, value, sub, accent = 'text-espresso' }) {
  return (
    <div className="card p-5">
      <p className="text-[11px] uppercase tracking-widest text-espresso/45">{label}</p>
      <p className={`font-heading text-3xl mt-2 ${accent}`}>{value}</p>
      {sub ? <p className="text-xs text-espresso/45 mt-1">{sub}</p> : null}
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div className="bg-cream rounded-xl px-3 py-2.5 border border-espresso/5">
      <div className="text-espresso font-medium">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-espresso/40 mt-0.5">
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
          'Add IMPACT_ACCOUNT_SID and IMPACT_AUTH_TOKEN in Vercel to see live affiliate sales, commission, and clicks.'}
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
          sub={connected ? `${Number(imp.clicks || 0).toLocaleString()} clicks` : 'Not connected'}
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
            {giftedPartners.map((p) => (
              <div key={p.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm text-espresso font-medium mb-1.5">{p.name}</p>
                {p.pieces.length === 0 ? (
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
            ))}
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
            <div className="grid grid-cols-2 gap-3">
              <MiniStat label="Sales" value={money(imp.sales)} />
              <MiniStat label="Commission" value={money(imp.commission)} />
              <MiniStat label="Orders" value={imp.orders} />
              <MiniStat label="Clicks" value={Number(imp.clicks || 0).toLocaleString()} />
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
            <p className="font-heading text-3xl text-green-700 leading-none">
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

function PartnersTab({ partners, onChange }) {
  const [editing, setEditing] = useState(null) // partner object or {} for new
  const [platformFilter, setPlatformFilter] = useState('All') // All | GoAffPro | Impact
  const [giftedFilter, setGiftedFilter] = useState('All') // All | Gifted | Standard

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
  else if (giftedFilter === 'Standard') filtered = filtered.filter((p) => !isGifted(p))

  const filterTabs = [
    { id: 'All', label: `All (${partners.length})` },
    { id: 'GoAffPro', label: `GoAffPro (${counts.GoAffPro})` },
    { id: 'Impact', label: `Impact (${counts.Impact})` },
  ]
  const giftedTabs = [
    { id: 'All', label: `Everyone (${partners.length})` },
    { id: 'Gifted', label: `Gifted (${giftedCount})` },
    { id: 'Standard', label: `Sample-kit (${partners.length - giftedCount})` },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-heading text-3xl text-espresso">
          Partners <span className="text-espresso/30 text-xl">({filtered.length})</span>
        </h2>
        <button onClick={() => setEditing({})} className="btn-gold">
          + Add partner
        </button>
      </div>

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

/* ───────────────────────── Everyone Contacted ───────────────────── */

function OutreachTab() {
  const roster = contactedRoster.contacted || []
  const [statusFilter, setStatusFilter] = useState('All')
  const [categoryFilter, setCategoryFilter] = useState('All')

  const { total, byStatus, byCategory } = summarize(roster)

  const STATUS_KEYS = ['active', 'gifted', 'interested', 'contacted', 'declined']
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

function KitsTab({ partners, kits, pieces, onChange }) {
  const [editing, setEditing] = useState(null) // { partner, kit }

  const kitByPartner = Object.fromEntries(kits.map((k) => [k.partner_id, k]))
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
            const kit = kitByPartner[p.id]
            const kitPieces = kit ? piecesByKit[kit.id] || [] : []
            return (
              <div key={p.id} className="card p-5">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="font-heading text-xl text-espresso">{p.name}</h3>
                      <PlatformBadge platform={p.platform} />
                      {kit ? (
                        <Badge status={kit.status} />
                      ) : (
                        <span className="text-xs text-espresso/40">No kit</span>
                      )}
                      {kit?.return_by_date && <ReturnCountdown date={kit.return_by_date} />}
                    </div>
                    {kit && (
                      <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-xs text-espresso/55">
                        <span>Ship: {kit.ship_date || '—'}</span>
                        <span>Tracking: {kit.tracking_number || '—'}</span>
                        <span>Return by: {kit.return_by_date || '—'}</span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setEditing({ partner: p, kit })}
                    className="btn-outline text-xs"
                  >
                    {kit ? 'Manage kit' : 'Create kit'}
                  </button>
                </div>

                {kit && kitPieces.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {kitPieces.map((pc) => (
                      <span
                        key={pc.id}
                        className="inline-flex items-center gap-2 bg-white rounded-full pl-3 pr-2 py-1 text-xs border border-espresso/5"
                      >
                        <span className="text-espresso">{pc.piece_name}</span>
                        {pc.color && <span className="text-espresso/40">· {pc.color}</span>}
                        {pc.partner_decision && <Badge status={pc.partner_decision} />}
                      </span>
                    ))}
                  </div>
                )}
                {kit && kit.notes && (
                  <p className="mt-3 text-xs text-espresso/50 italic">{kit.notes}</p>
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

  async function saveKit() {
    setBusy(true)
    await ensureKit()
    setBusy(false)
    onChange()
    onClose()
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
            value={form.tracking_number || ''}
            onChange={(e) => set('tracking_number', e.target.value)}
          />
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

/* ─────────────────────── Lavie's Recommendations ─────────────────── */

function RecommendationsTab() {
  return (
    <div>
      <h2 className="font-heading text-3xl text-espresso mb-1">Lavie's Recommendations</h2>
      <p className="text-sm text-espresso/55 mb-5">
        Recommended prospects — not yet in the kit pipeline.
      </p>

      {LAVIE_RECOMMENDATIONS.length === 0 ? (
        <EmptyState title="No recommendations yet" hint="Names will appear here as they're added." />
      ) : (
        <div className="card divide-y divide-espresso/5">
          {LAVIE_RECOMMENDATIONS.map((r, i) => (
            <div
              key={i}
              className="px-5 py-4 flex items-start justify-between gap-4 flex-wrap"
            >
              <div>
                <p className="font-medium text-espresso">{r.name}</p>
                {r.business && (
                  <p className="text-sm text-espresso/55 mt-0.5">{r.business}</p>
                )}
              </div>
              {r.email && (
                <a
                  href={`mailto:${r.email}`}
                  className="text-sm text-gold hover:underline break-all"
                >
                  {r.email}
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
