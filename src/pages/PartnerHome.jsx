import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { fetchPartnerByToken, submitQuiz, fetchCommissionsByToken } from '../lib/partner'
import { Logo, Card, Badge, Spinner, FullPageLoader } from '../components/ui'

// The style quiz — instead of partners picking specific SKUs (which sell out
// and force swaps), they share their preferences and the PLANET team curates a
// cohesive box from what's in stock. Each section is a multi-select of on-brand
// options; answers are stored as a tagged JSON payload in partner_selections.
const QUIZ_SECTIONS = [
  {
    key: 'vibes',
    label: 'Your style vibe',
    hint: 'Pick the aesthetics that feel most you — choose as many as you like.',
    options: [
      'Classic & Polished',
      'Effortless & Relaxed',
      'Architectural & Edgy',
      'Soft & Romantic',
      'Minimal & Monochrome',
      'Statement & Bold',
    ],
  },
  {
    key: 'colors',
    label: 'Colors & palette',
    hint: 'The tones you reach for most.',
    options: [
      'Neutrals & Creams',
      'Black & White',
      'Earth Tones',
      'Jewel Tones',
      'Brights & Color',
      'Soft Pastels',
    ],
  },
  {
    key: 'fabrics',
    label: 'Fabrics & textures',
    hint: 'What you love to wear.',
    options: [
      'Structured & Crisp',
      'Flowy & Drapey',
      'Cozy Knits',
      'Vegan Leather',
      'Linen & Natural',
      'Silky & Smooth',
    ],
  },
  {
    key: 'silhouettes',
    label: 'Silhouettes you love',
    hint: 'The shapes you gravitate toward.',
    options: [
      'Pants-forward',
      'Dresses',
      'Tops & Blouses',
      'Layering Pieces',
      'Skirts',
      'Jumpsuits',
    ],
  },
  {
    key: 'occasions',
    label: "Occasions you'd style for",
    hint: 'Where these pieces will live.',
    options: ['Everyday', 'Work & Office', 'Events & Evening', 'Travel', 'Weekend'],
  },
]

// Fresh, empty answer state for the multi-select sections + structured sizes.
const EMPTY_ANSWERS = { vibes: [], colors: [], fabrics: [], silhouettes: [], occasions: [] }
const EMPTY_SIZES = { tops: '', bottoms: '', dress: '', shoe: '' }

// Kit statuses that mean "a box is already out with this partner" — when true
// we lead with kit status/tracking and make the quiz secondary.
const OUTGOING_KIT_STATUSES = ['Preparing', 'Shipped', 'Delivered', 'Return Pending']

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  )
}

// Ship-to fields the partner must fill before submitting. `line2` is optional.
const EMPTY_SHIPPING = { name: '', line1: '', line2: '', city: '', state: '', zip: '' }

// True once every required ship-to field has content.
function shippingComplete(s) {
  return ['name', 'line1', 'city', 'state', 'zip'].every((k) => (s[k] || '').trim())
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

// Whole days from today (midnight-to-midnight) until a YYYY-MM-DD date.
// Positive = still ahead, 0 = today, negative = past due. Returns null on
// a missing/malformed date.
function daysUntil(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = String(dateStr).split('-').map(Number)
  if (!y || !m || !d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(y, m - 1, d)
  target.setHours(0, 0, 0, 0)
  return Math.round((target - today) / 86400000)
}

// Partner-facing return countdown. On-brand pill that greets a comfortable
// window calmly (gold), warms to amber as the deadline nears, and turns red
// for due-today / overdue. Renders nothing without a valid return date.
function ReturnCountdown({ date }) {
  const left = daysUntil(date)
  if (left === null) return null

  let tone, label
  if (left < 0) {
    const n = Math.abs(left)
    tone = 'bg-red-50 text-red-700 border-red-200'
    label = `Return overdue by ${n} ${n === 1 ? 'day' : 'days'}`
  } else if (left === 0) {
    tone = 'bg-red-50 text-red-700 border-red-200'
    label = 'Due today'
  } else {
    const noun = left === 1 ? 'day' : 'days'
    if (left <= 5) {
      tone = 'bg-red-50 text-red-700 border-red-200'
    } else if (left <= 10) {
      tone = 'bg-amber-50 text-amber-700 border-amber-200'
    } else {
      tone = 'bg-gold/10 text-gold border-gold/20'
    }
    label = `${left} ${noun} left to return`
  }

  return (
    <span
      title={`Return by ${formatLongDate(date)}`}
      className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium tracking-wide ${tone}`}
    >
      <span aria-hidden="true">⏱</span>
      {label}
    </span>
  )
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
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/planet-wordmark.png"
              alt="PLANET by Lauren G"
              className="h-6 sm:h-7 w-auto"
            />
            <span className="text-gold text-[10px] uppercase tracking-[0.3em] hidden sm:inline">
              by Lauren G
            </span>
          </div>
          <span className="text-xs text-espresso/40 truncate">{partner.name}</span>
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
            <NextStyleQuiz token={token} />
          </>
        ) : (
          <>
            <StyleQuizSection token={token} hadKit={Boolean(kit)} />
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
      {kit.return_by_date && (
        <div className="mt-3">
          <ReturnCountdown date={kit.return_by_date} />
        </div>
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

/* ─────────────────────── 4) Style quiz ───────────────────────────── */

// Prominent quiz (no box out yet).
function StyleQuizSection({ token, hadKit }) {
  return (
    <div>
      <div className="mb-5">
        <p className="eyebrow">Your style profile</p>
        <h2 className="font-heading text-3xl md:text-4xl text-espresso mt-1">
          {hadKit ? 'Refresh your style preferences' : 'Tell us your style'}
        </h2>
        <p className="text-espresso/60 mt-2 font-light max-w-2xl">
          Rather than picking individual pieces (which sell out fast), share the styles you
          love and our team will hand-curate a cohesive box for you from what's freshly in
          stock — pairing full looks so your content tells a beautiful story.
        </p>
      </div>
      <QuizForm token={token} />
    </div>
  )
}

// Secondary quiz (a box is already out) — tucked behind a reveal.
function NextStyleQuiz({ token }) {
  const [open, setOpen] = useState(false)
  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="eyebrow">Planning ahead</p>
          <h2 className="font-heading text-2xl text-espresso mt-1">
            Update your style preferences
          </h2>
          <p className="text-sm text-espresso/55 mt-1 max-w-lg">
            Your current box is on its way. When you're ready, tell us how your style is
            evolving and we'll tailor your next box to match.
          </p>
        </div>
        <button onClick={() => setOpen((v) => !v)} className="btn-outline text-xs shrink-0">
          {open ? 'Hide' : 'Take the style quiz'}
        </button>
      </div>
      {open && (
        <div className="mt-6">
          <QuizForm token={token} />
        </div>
      )}
    </Card>
  )
}

// Multi-select pill group used by every style-quiz section.
function ChipGroup({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const on = selected.includes(opt)
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(opt)}
            className={`rounded-full border px-4 py-2 text-sm font-medium tracking-wide transition ${
              on
                ? 'border-gold bg-gold/15 text-espresso'
                : 'border-espresso/15 text-espresso/60 hover:border-espresso/40'
            }`}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}

// The style quiz form: multi-select vibe/color/fabric/silhouette/occasion,
// structured sizes, an "avoid" note, an optional free note, and the ship-to
// address (unchanged from the old flow). On submit it stores a tagged
// `style_quiz` payload in partner_selections via submitQuiz().
function QuizForm({ token }) {
  const [answers, setAnswers] = useState(EMPTY_ANSWERS)
  const [sizes, setSizes] = useState(EMPTY_SIZES)
  const [avoid, setAvoid] = useState('')
  const [note, setNote] = useState('')
  const [ship, setShip] = useState(EMPTY_SHIPPING)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const toggle = (key) => (opt) =>
    setAnswers((prev) => {
      const list = prev[key]
      return {
        ...prev,
        [key]: list.includes(opt) ? list.filter((v) => v !== opt) : [...list, opt],
      }
    })

  const setSizeField = (key) => (e) =>
    setSizes((prev) => ({ ...prev, [key]: e.target.value }))
  const setShipField = (key) => (e) => setShip((prev) => ({ ...prev, [key]: e.target.value }))

  const totalPicked = QUIZ_SECTIONS.reduce((n, s) => n + answers[s.key].length, 0)

  function reset() {
    setSubmitted(false)
    setAnswers(EMPTY_ANSWERS)
    setSizes(EMPTY_SIZES)
    setAvoid('')
    setNote('')
    setShip(EMPTY_SHIPPING)
    setError('')
  }

  async function submit() {
    setError('')
    // Need at least a little to curate from, and somewhere to send the box.
    if (answers.vibes.length === 0) {
      setError('Please pick at least one style vibe so we know where to start.')
      return
    }
    if (!shippingComplete(ship)) {
      setError('Please fill in your shipping address so we know where to send your box.')
      return
    }
    setSubmitting(true)

    // Trim the structured sizes down to only the fields the partner filled.
    const cleanSizes = Object.fromEntries(
      Object.entries(sizes)
        .map(([k, v]) => [k, (v || '').trim()])
        .filter(([, v]) => v)
    )
    // The tagged preferences payload the admin dashboard reads back.
    const preferences = {
      kind: 'style_quiz',
      version: 1,
      vibes: answers.vibes,
      colors: answers.colors,
      fabrics: answers.fabrics,
      silhouettes: answers.silhouettes,
      occasions: answers.occasions,
      sizes: cleanSizes,
      avoid: avoid.trim(),
    }
    const shipping = {
      name: ship.name.trim(),
      line1: ship.line1.trim(),
      line2: ship.line2.trim(),
      city: ship.city.trim(),
      state: ship.state.trim(),
      zip: ship.zip.trim(),
    }
    try {
      await submitQuiz(token, preferences, note.trim(), shipping)
      setSubmitted(true)
    } catch (e) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <Card className="text-center">
        <div className="text-4xl mb-3">✦</div>
        <h3 className="font-heading text-2xl text-espresso">Your style profile is in</h3>
        <p className="mt-2 text-sm text-espresso/60 leading-relaxed">
          Thank you — the PLANET team has been notified and will hand-curate a box that
          matches the styles you love, from what's freshly in stock.
        </p>

        {/* Two gentle asks once the box lands — warm, on-brand, low-pressure. */}
        <div className="mt-6 text-left max-w-md mx-auto space-y-3">
          <p className="eyebrow text-center">When your box arrives</p>
          <div className="flex items-start gap-3 bg-cream rounded-xl px-4 py-3 border border-espresso/5">
            <span className="text-gold text-lg leading-none mt-0.5">✦</span>
            <p className="text-sm text-espresso/70 leading-relaxed">
              Share the love — post your box on social and tag{' '}
              <span className="font-medium text-espresso">@planetbylaureng</span> so we can
              celebrate your style with you.
            </p>
          </div>
          <div className="flex items-start gap-3 bg-cream rounded-xl px-4 py-3 border border-espresso/5">
            <span className="text-gold text-lg leading-none mt-0.5">★</span>
            <p className="text-sm text-espresso/70 leading-relaxed">
              Fell in love with a piece? Please leave a{' '}
              <span className="font-medium text-espresso">5-star review</span> on the website
              for the pieces you receive — it means the world and helps others find them too.
            </p>
          </div>
        </div>

        <button onClick={reset} className="btn-ghost text-xs mt-6 mx-auto">
          Edit my preferences
        </button>
      </Card>
    )
  }

  return (
    <Card className="space-y-7">
      {QUIZ_SECTIONS.map((section) => (
        <div key={section.key}>
          <p className="label mb-0.5">{section.label}</p>
          <p className="text-xs text-espresso/45 mb-3">{section.hint}</p>
          <ChipGroup
            options={section.options}
            selected={answers[section.key]}
            onToggle={toggle(section.key)}
          />
        </div>
      ))}

      {/* Sizes — structured, replaces the old "put your size in the note" flow. */}
      <div>
        <p className="label mb-0.5">Your sizes</p>
        <p className="text-xs text-espresso/45 mb-3">
          So everything fits beautifully. Fill in whatever applies.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            value={sizes.tops}
            onChange={setSizeField('tops')}
            placeholder="Tops (e.g. M)"
            className="input"
          />
          <input
            value={sizes.bottoms}
            onChange={setSizeField('bottoms')}
            placeholder="Bottoms (e.g. 6)"
            className="input"
          />
          <input
            value={sizes.dress}
            onChange={setSizeField('dress')}
            placeholder="Dress (e.g. 4)"
            className="input"
          />
          <input
            value={sizes.shoe}
            onChange={setSizeField('shoe')}
            placeholder="Shoe (e.g. 8)"
            className="input"
          />
        </div>
      </div>

      {/* Anything to avoid */}
      <label className="block">
        <span className="label">Anything to avoid?</span>
        <textarea
          value={avoid}
          onChange={(e) => setAvoid(e.target.value)}
          rows={2}
          placeholder="e.g. no bright yellow, nothing sleeveless, no mini lengths"
          className="input resize-none"
        />
      </label>

      {/* Free note */}
      <label className="block">
        <span className="label">Anything else you'd love us to know? (optional)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={2}
          placeholder="Tell us about your style, an upcoming event, a piece you've been dreaming of…"
          className="input resize-none"
        />
      </label>

      {/* Shipping address — unchanged capture from the old flow. */}
      <div>
        <p className="label mb-0.5">Shipping address</p>
        <p className="text-xs text-espresso/45 mb-3">Where should we send your box?</p>
        <div className="space-y-2">
          <input
            value={ship.name}
            onChange={setShipField('name')}
            placeholder="Full name"
            autoComplete="name"
            className="input"
          />
          <input
            value={ship.line1}
            onChange={setShipField('line1')}
            placeholder="Street address"
            autoComplete="address-line1"
            className="input"
          />
          <input
            value={ship.line2}
            onChange={setShipField('line2')}
            placeholder="Apt, suite, etc. (optional)"
            autoComplete="address-line2"
            className="input"
          />
          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
            <input
              value={ship.city}
              onChange={setShipField('city')}
              placeholder="City"
              autoComplete="address-level2"
              className="input sm:col-span-3"
            />
            <input
              value={ship.state}
              onChange={setShipField('state')}
              placeholder="State"
              autoComplete="address-level1"
              className="input sm:col-span-1"
            />
            <input
              value={ship.zip}
              onChange={setShipField('zip')}
              placeholder="ZIP"
              inputMode="numeric"
              autoComplete="postal-code"
              className="input sm:col-span-2"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3 pt-1">
        <span className="text-xs text-espresso/45">
          {totalPicked} preference{totalPicked === 1 ? '' : 's'} selected
        </span>
        <button
          onClick={submit}
          disabled={submitting}
          className="btn-primary shrink-0 disabled:opacity-40"
        >
          {submitting ? <Spinner /> : 'Submit my style profile'}
        </button>
      </div>
    </Card>
  )
}
