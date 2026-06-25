import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { Badge, PlatformBadge, Spinner, FullPageLoader, EmptyState, Field } from '../components/ui'

const PARTNER_STATUSES = ['Contacted', 'Interested', 'Active Partner', 'Passed']
const KIT_STATUSES = ['Preparing', 'Shipped', 'Delivered', 'Return Pending', 'Returned']
const CONTENT_TYPES = ['Reel', 'Feed Post', 'Story', 'Blog Post']
const PLATFORMS = ['GoAffPro', 'Impact']

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
  const [tab, setTab] = useState('partners')

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
    { id: 'partners', label: 'Partners' },
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

        {tab === 'partners' && <PartnersTab partners={partners} onChange={load} />}
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

  const counts = partners.reduce(
    (acc, p) => {
      if (p.platform) acc[p.platform] = (acc[p.platform] || 0) + 1
      return acc
    },
    { GoAffPro: 0, Impact: 0 }
  )
  const filtered =
    platformFilter === 'All'
      ? partners
      : partners.filter((p) => p.platform === platformFilter)

  const filterTabs = [
    { id: 'All', label: `All (${partners.length})` },
    { id: 'GoAffPro', label: `GoAffPro (${counts.GoAffPro})` },
    { id: 'Impact', label: `Impact (${counts.Impact})` },
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

      {/* Platform filter */}
      <div className="flex flex-wrap gap-2 mb-5">
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

      {partners.length === 0 ? (
        <EmptyState title="No partners yet" hint="Add your first partner to get started." />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={`No ${platformFilter} partners`}
          hint="Try a different platform filter, or set a partner's platform when editing them."
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
                  <td className="px-5 py-3 font-medium text-espresso">{p.name}</td>
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
    const payload = { ...form, email: form.email.trim().toLowerCase() }
    const { error } = isNew
      ? await supabase.from('partners').insert(payload)
      : await supabase.from('partners').update(payload).eq('id', partner.id)
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
