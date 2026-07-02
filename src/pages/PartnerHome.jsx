import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPartnerByToken, submitSelection, fetchCommissionsByToken } from '../lib/partner'
import { fetchCatalog } from '../lib/catalog'
import { Logo, Card, Badge, Spinner, FullPageLoader, EmptyState } from '../components/ui'

// Max pieces a partner may select in one submission. Change this single
// constant to raise/lower the cap everywhere.
const MAX_SELECTIONS = 5

// Kit statuses that mean "a box is already out with this partner" — when true
// we lead with kit status/tracking and make the picker secondary.
const OUTGOING_KIT_STATUSES = ['Preparing', 'Shipped', 'Delivered', 'Return Pending']

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  )
}

function formatLongDate(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PartnerHome() {
  const { token } = useParams()
  const [state, setState] = useState({ loading: true })
  // Commissions + affiliate link come from the same token-based endpoint;
  // fetch once here and share with both the link and earnings sections.
  const [commissions, setCommissions] = useState({ loading: true })

  useEffect(() => {
    let active = true
    fetchPartnerByToken(token)
      .then((data) => active && setState({ loading: false, data }))
      .catch((e) => active && setState({ loading: false, error: e.message }))
    return () => {
      active = false
    }
  }, [token])

  useEffect(() => {
    let active = true
    setCommissions({ loading: true })
    fetchCommissionsByToken(token)
      .then((d) => active && setCommissions({ loading: false, data: d }))
      .catch((e) => active && setCommissions({ loading: false, error: e.message }))
    return () => {
      active = false
    }
  }, [token])

  if (state.loading) return <FullPageLoader label="Opening your portal…" />

  // Invalid / unknown token, or a lookup error → same friendly dead-end.
  if (state.error || !state.data?.partner) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <Logo subtitle="Hmm" />
          <p className="mt-6 text-sm text-espresso/70 leading-relaxed">
            This link doesn't look right. Please use the private link the PLANET team sent
            you, or reach out and we'll send you a fresh one.
          </p>
        </Card>
      </div>
    )
  }

  const { partner, kit, pieces } = state.data
  const firstName = partner.name?.split(' ')[0] || 'there'
  const boxIsOut = kit && OUTGOING_KIT_STATUSES.includes(kit.status)

  return (
    <div className="min-h-screen pb-40">
      {/* Top bar */}
      <header className="border-b border-espresso/5 bg-cream/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-heading text-xl tracking-[0.2em]">
            PLANET <span className="text-gold text-xs tracking-[0.3em]">by Lauren G</span>
          </div>
          <span className="text-xs text-espresso/40">{partner.name}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 mt-10 space-y-6">
        {/* Welcome */}
        <div>
          <p className="eyebrow">Welcome back</p>
          <h1 className="font-heading text-4xl md:text-5xl text-espresso mt-1">
            Hello, {firstName}
          </h1>
          <p className="text-espresso/60 mt-2 font-light">
            So glad to have you in the PLANET Style Collective.
          </p>
        </div>

        {/* 1 + 2: Affiliate link + commissions */}
        <div className="grid md:grid-cols-2 gap-6">
          <CommissionLink storedLink={partner.commission_link} commissions={commissions} />
          <Earnings commissions={commissions} />
        </div>

        {/* 3 + 4: adapt to the partner's state */}
        {boxIsOut ? (
          <>
            <KitSection kit={kit} pieces={pieces} />
            <NextBoxPicker token={token} />
          </>
        ) : (
          <>
            <BoxPicker token={token} hadKit={Boolean(kit)} />
            {kit && <KitSection kit={kit} pieces={pieces} collapsedTitle />}
          </>
        )}
      </main>
    </div>
  )
}

/* ─────────────────────── 1) Affiliate link ───────────────────────── */

function CommissionLink({ storedLink, commissions }) {
  const [copied, setCopied] = useState(false)

  // Prefer the live GoAffPro affiliate link (built from the partner's ref_id
  // or coupon); fall back to a manually-stored commission_link; else nothing.
  const affiliate = commissions?.data?.affiliate
  const link = affiliate?.link || storedLink || null
  const coupon = affiliate?.coupon || null
  // Only "loading" if we have no stored link AND the lookup is still running —
  // otherwise show what we already have immediately.
  const loading = commissions?.loading && !storedLink

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard may be blocked; user can still select manually */
    }
  }

  return (
    <Card>
      <p className="eyebrow">Your affiliate link</p>
      {loading ? (
        <div className="mt-6 flex items-center gap-3 text-espresso/50 text-sm">
          <Spinner /> Loading your link…
        </div>
      ) : link ? (
        <>
          <div className="mt-3 bg-cream rounded-xl px-4 py-3 text-sm text-espresso break-all border border-espresso/5">
            {link}
          </div>
          {coupon && (
            <p className="mt-2 text-xs text-espresso/55">
              Coupon code:{' '}
              <span className="font-medium text-espresso tracking-wide">{coupon}</span>
            </p>
          )}
          <button onClick={copy} className="btn-gold mt-4 w-full">
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </>
      ) : (
        <p className="mt-3 text-sm text-espresso/50 leading-relaxed">
          Your link is being set up — it'll appear here as soon as it's ready. ✦
        </p>
      )}
    </Card>
  )
}

/* ─────────────────────── 2) Commissions ──────────────────────────── */

function Earnings({ commissions }) {
  const state = commissions

  return (
    <Card>
      <p className="eyebrow">Commission earnings</p>
      {state.loading ? (
        <div className="mt-6 flex items-center gap-3 text-espresso/50 text-sm">
          <Spinner /> Loading earnings…
        </div>
      ) : state.error ? (
        <p className="mt-4 text-sm text-espresso/50">
          We couldn't load earnings right now. Please check back soon.
        </p>
      ) : !state.data?.configured || !state.data?.found ? (
        <div className="mt-4">
          <div className="font-heading text-4xl text-espresso/30">$0.00</div>
          <p className="text-xs text-espresso/50 mt-2 leading-relaxed">
            {state.data?.message ||
              'Your earnings will show up here once your first sales come through.'}
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div className="font-heading text-4xl text-gold">
            {money(state.data.earnings.balance)}
          </div>
          <p className="text-xs text-espresso/50 mt-1">Current balance</p>
          <div className="grid grid-cols-2 gap-3 mt-5 text-sm">
            <Stat label="Unpaid" value={money(state.data.earnings.unpaid)} />
            <Stat label="Paid out" value={money(state.data.earnings.paid)} />
            <Stat label="Total sales" value={money(state.data.earnings.sales)} />
            <Stat label="Orders" value={state.data.earnings.orders} />
          </div>
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-cream rounded-xl px-3 py-2.5 border border-espresso/5">
      <div className="text-espresso font-medium">{value}</div>
      <div className="text-[10px] uppercase tracking-widest text-espresso/40 mt-0.5">
        {label}
      </div>
    </div>
  )
}

/* ─────────────────────── 3) Kit status ───────────────────────────── */

function KitSection({ kit, pieces, collapsedTitle = false }) {
  const returnBy = formatLongDate(kit.return_by_date)
  const tracking = kit.tracking_number

  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="eyebrow">{collapsedTitle ? 'Your last box' : 'Your box'}</p>
        {kit.status && <Badge status={kit.status} />}
      </div>

      {tracking && (
        <p className="text-sm text-espresso/60 mt-3">
          Tracking: <span className="text-espresso font-medium">{tracking}</span>{' '}
          <a
            href={`https://www.google.com/search?q=${encodeURIComponent('track package ' + tracking)}`}
            target="_blank"
            rel="noreferrer"
            className="text-gold hover:underline text-xs ml-1"
          >
            Track ↗
          </a>
        </p>
      )}
      {returnBy && (
        <p className="text-sm text-espresso/60 mt-1">
          Please return by: <span className="text-espresso font-medium">{returnBy}</span>
        </p>
      )}

      <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(!pieces || pieces.length === 0) ? (
          <p className="text-sm text-espresso/50">
            The pieces in your box will show here soon.
          </p>
        ) : (
          pieces.map((piece) => (
            <div
              key={piece.id}
              className="rounded-2xl border border-espresso/5 bg-white overflow-hidden"
            >
              <div className="aspect-[4/5] bg-cream flex items-center justify-center overflow-hidden">
                {piece.photo_url ? (
                  <img
                    src={piece.photo_url}
                    alt={piece.piece_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <span className="font-heading text-espresso/20 text-lg italic">
                    No photo
                  </span>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-heading text-lg text-espresso leading-tight">
                      {piece.piece_name}
                    </h3>
                    {piece.color && (
                      <p className="text-xs text-espresso/50 mt-0.5">{piece.color}</p>
                    )}
                  </div>
                  {piece.partner_decision && <Badge status={piece.partner_decision} />}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  )
}

/* ─────────────────────── 4) Box picker ───────────────────────────── */

// Prominent picker (no box out yet).
function BoxPicker({ token, hadKit }) {
  return (
    <div>
      <div className="mb-4">
        <p className="eyebrow">The collection</p>
        <h2 className="font-heading text-3xl md:text-4xl text-espresso mt-1">
          {hadKit ? 'Pick your next box' : 'Pick your box'}
        </h2>
        <p className="text-espresso/60 mt-2 font-light max-w-2xl">
          Browse what's in stock right now and choose up to {MAX_SELECTIONS} pieces you'd
          love. Add a note with your sizes or preferences, then submit — we'll take it from
          there.
        </p>
      </div>
      <PickerBody token={token} />
    </div>
  )
}

// Secondary picker (a box is already out) — tucked behind a reveal.
function NextBoxPicker({ token }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Planning ahead</p>
          <h2 className="font-heading text-2xl text-espresso mt-1">
            Wishlist your next box
          </h2>
          <p className="text-sm text-espresso/55 mt-1 max-w-lg">
            Your current box is on its way. When you're ready, pick the pieces you'd love to
            see next.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-outline text-xs shrink-0">
          {open ? 'Hide' : 'Browse the collection'}
        </button>
      </div>
      {open && (
        <div className="mt-6">
          <PickerBody token={token} />
        </div>
      )}
    </Card>
  )
}

// Shared picker: catalog grid + selection bar + submit.
function PickerBody({ token }) {
  const [catalog, setCatalog] = useState({ loading: true })
  const [selected, setSelected] = useState({})
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false) // note + confirm modal

  useEffect(() => {
    let active = true
    fetchCatalog()
      .then((d) => active && setCatalog({ loading: false, items: d.items || [] }))
      .catch((e) => active && setCatalog({ loading: false, error: e.message }))
    return () => {
      active = false
    }
  }, [])

  const selectedCount = Object.keys(selected).length
  const atMax = selectedCount >= MAX_SELECTIONS

  const toggle = useCallback((item) => {
    setSelected((prev) => {
      const next = { ...prev }
      if (next[item.product_id]) {
        delete next[item.product_id]
      } else {
        if (Object.keys(next).length >= MAX_SELECTIONS) return prev
        next[item.product_id] = item
      }
      return next
    })
  }, [])

  async function submit() {
    if (selectedCount === 0) return
    setSubmitting(true)
    setError('')
    const items = Object.values(selected).map((it) => ({
      product_id: it.product_id,
      title: it.title,
      variant_id: it.variant_id,
      color: it.color,
      price: it.price,
      image: it.image,
    }))
    try {
      await submitSelection(token, items, note.trim())
      setConfirmOpen(false)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  // Only show the sticky bar once the catalog is actually pickable.
  const showBar =
    !submitted && !catalog.loading && !catalog.error && (catalog.items?.length || 0) > 0

  if (submitted) {
    return (
      <Card className="text-center">
        <div className="text-4xl mb-3">✦</div>
        <h3 className="font-heading text-2xl text-espresso">Your picks are in</h3>
        <p className="mt-2 text-sm text-espresso/60 leading-relaxed">
          Thank you — the PLANET team has been notified and will follow up with you shortly
          about your {selectedCount} piece{selectedCount === 1 ? '' : 's'}.
        </p>
        <button
          onClick={() => {
            setSubmitted(false)
            setSelected({})
            setNote('')
          }}
          className="btn-ghost text-xs mt-5 mx-auto"
        >
          Choose more
        </button>
      </Card>
    )
  }

  return (
    <>
      {catalog.loading ? (
        <div className="flex items-center gap-3 text-espresso/50 text-sm py-16 justify-center">
          <Spinner /> Loading the live collection…
        </div>
      ) : catalog.error ? (
        <Card className="text-center">
          <p className="text-sm text-espresso/60">
            We couldn't load the collection right now. Please try again in a moment.
          </p>
        </Card>
      ) : catalog.items.length === 0 ? (
        <EmptyState
          title="Nothing in stock right now"
          hint="Check back soon — new pieces are added regularly."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {catalog.items.map((item) => (
            <ProductCard
              key={item.product_id}
              item={item}
              isSelected={Boolean(selected[item.product_id])}
              disabled={atMax && !selected[item.product_id]}
              onToggle={() => toggle(item)}
            />
          ))}
        </div>
      )}

      {/* Always-visible sticky submit bar (compact — stays reachable while
          scrolling ~900 products). Disabled until at least one pick. */}
      {showBar && (
        <div className="fixed bottom-0 inset-x-0 z-20 border-t border-espresso/10 bg-cream/95 backdrop-blur">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap ${
                  selectedCount > 0 ? 'bg-gold/20 text-gold' : 'bg-espresso/10 text-espresso/50'
                }`}
              >
                {selectedCount} / {MAX_SELECTIONS} selected
              </span>
              {selectedCount > 0 && (
                <button
                  onClick={() => setSelected({})}
                  className="text-xs text-espresso/45 hover:text-espresso/70 hidden sm:inline"
                >
                  Clear
                </button>
              )}
              <span className="text-xs text-espresso/45 truncate hidden sm:inline">
                {selectedCount === 0
                  ? 'Tap pieces to add them to your box'
                  : atMax
                  ? `Max of ${MAX_SELECTIONS} reached`
                  : ''}
              </span>
            </div>
            <button
              onClick={() => {
                setError('')
                setConfirmOpen(true)
              }}
              disabled={selectedCount === 0}
              className="btn-primary shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Submit selection
            </button>
          </div>
        </div>
      )}

      {/* Confirm + note modal, reached via the sticky Submit button. */}
      {confirmOpen && (
        <SubmitModal
          items={Object.values(selected)}
          note={note}
          setNote={setNote}
          onRemove={toggle}
          onCancel={() => !submitting && setConfirmOpen(false)}
          onSubmit={submit}
          submitting={submitting}
          error={error}
        />
      )}
    </>
  )
}

// Lightweight confirm dialog: review picks, add an optional note, submit.
function SubmitModal({ items, note, setNote, onRemove, onCancel, onSubmit, submitting, error }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-espresso/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onCancel}
    >
      <div
        className="bg-cream w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl shadow-soft max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-espresso/10 sticky top-0 bg-cream">
          <h3 className="font-heading text-2xl text-espresso">
            Submit your {items.length} pick{items.length === 1 ? '' : 's'}
          </h3>
          <button
            onClick={onCancel}
            className="text-espresso/40 hover:text-espresso text-xl"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            {items.map((it) => (
              <div
                key={it.product_id}
                className="flex items-center gap-3 bg-white rounded-xl px-3 py-2 border border-espresso/5"
              >
                <div className="w-10 h-12 rounded-lg bg-cream overflow-hidden shrink-0">
                  {it.image && (
                    <img src={it.image} alt="" className="w-full h-full object-cover" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-espresso truncate">{it.title}</p>
                  {it.color && <p className="text-xs text-espresso/45">{it.color}</p>}
                </div>
                <button
                  onClick={() => onRemove(it)}
                  disabled={submitting}
                  className="text-espresso/30 hover:text-red-600 text-sm px-1"
                  aria-label={`Remove ${it.title}`}
                >
                  ✕
                </button>
              </div>
            ))}
            {items.length === 0 && (
              <p className="text-sm text-espresso/50">
                You've removed everything — close this and pick a few pieces.
              </p>
            )}
          </div>

          <label className="block">
            <span className="label">Note (sizes, preferences — optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="e.g. Size M, prefer the espresso tones"
              className="input resize-none"
            />
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-end gap-3 pt-1">
            <button
              onClick={onCancel}
              disabled={submitting}
              className="btn-ghost text-xs"
            >
              Keep browsing
            </button>
            <button
              onClick={onSubmit}
              disabled={submitting || items.length === 0}
              className="btn-primary disabled:opacity-40"
            >
              {submitting ? <Spinner /> : 'Submit selection'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ProductCard({ item, isSelected, disabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      className={`text-left rounded-2xl border bg-white overflow-hidden transition ${
        isSelected
          ? 'border-gold ring-2 ring-gold/40'
          : disabled
          ? 'border-espresso/5 opacity-40 cursor-not-allowed'
          : 'border-espresso/5 hover:border-espresso/20'
      }`}
    >
      <div className="aspect-[4/5] bg-cream relative overflow-hidden">
        {item.image ? (
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center font-heading text-espresso/20 italic">
            No photo
          </span>
        )}
        {isSelected && (
          <span className="absolute top-2 right-2 h-6 w-6 rounded-full bg-gold text-white flex items-center justify-center text-xs shadow-soft">
            ✓
          </span>
        )}
      </div>
      <div className="p-3">
        <h3 className="text-sm font-medium text-espresso leading-tight line-clamp-2">
          {item.title}
        </h3>
        {item.color && <p className="text-xs text-espresso/45 mt-0.5">{item.color}</p>}
        <p className="text-sm text-espresso/70 mt-1">{money(item.price)}</p>
      </div>
    </button>
  )
}
