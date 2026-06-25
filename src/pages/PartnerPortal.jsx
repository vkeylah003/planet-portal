import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { fetchMyCommissions } from '../lib/goaffpro'
import { Logo, Card, Badge, Spinner, FullPageLoader, EmptyState } from '../components/ui'

function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    Number(n || 0)
  )
}

export default function PartnerPortal() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState(null)
  const [kit, setKit] = useState(null)
  const [pieces, setPieces] = useState([])
  const [notFound, setNotFound] = useState(false)

  const load = useCallback(async () => {
    if (!user?.email) return
    setLoading(true)

    const { data: p } = await supabase
      .from('partners')
      .select('*')
      .ilike('email', user.email)
      .maybeSingle()

    if (!p) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setPartner(p)

    // Most recent kit for this partner.
    const { data: k } = await supabase
      .from('kits')
      .select('*')
      .eq('partner_id', p.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setKit(k || null)

    if (k) {
      const { data: pcs } = await supabase
        .from('kit_pieces')
        .select('*')
        .eq('kit_id', k.id)
        .order('created_at', { ascending: true })
      setPieces(pcs || [])
    } else {
      setPieces([])
    }

    setLoading(false)
  }, [user])

  useEffect(() => {
    load()
  }, [load])

  if (loading) return <FullPageLoader label="Opening your portal…" />

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <Card className="max-w-md text-center">
          <Logo subtitle="Hmm" />
          <p className="mt-6 text-sm text-espresso/70 leading-relaxed">
            We couldn't find a partner profile for{' '}
            <span className="font-medium">{user.email}</span>. Please reach out to the
            PLANET team so we can get you set up.
          </p>
          <button
            onClick={() => signOut().then(() => navigate('/'))}
            className="btn-outline mt-6 mx-auto"
          >
            Sign out
          </button>
        </Card>
      </div>
    )
  }

  const firstName = partner.name?.split(' ')[0] || 'there'

  return (
    <div className="min-h-screen pb-20">
      {/* Top bar */}
      <header className="border-b border-espresso/5 bg-cream/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="font-heading text-xl tracking-[0.2em]">
            PLANET <span className="text-gold text-xs tracking-[0.3em]">by Lauren G</span>
          </div>
          <button
            onClick={() => signOut().then(() => navigate('/'))}
            className="btn-ghost text-xs"
          >
            Sign out
          </button>
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

        {/* Commission link + earnings */}
        <div className="grid md:grid-cols-2 gap-6">
          <CommissionLink link={partner.commission_link} />
          <Earnings />
        </div>

        {/* Kit status + pieces */}
        <KitSection kit={kit} pieces={pieces} onChange={load} />

        {/* Partner note */}
        <NoteSection partner={partner} onSaved={load} />
      </main>
    </div>
  )
}

function CommissionLink({ link }) {
  const [copied, setCopied] = useState(false)

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
      <p className="eyebrow">Your commission link</p>
      {link ? (
        <>
          <div className="mt-3 bg-cream rounded-xl px-4 py-3 text-sm text-espresso break-all border border-espresso/5">
            {link}
          </div>
          <button onClick={copy} className="btn-gold mt-4 w-full">
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </>
      ) : (
        <p className="mt-3 text-sm text-espresso/50">
          Your link will appear here once it's been set up.
        </p>
      )}
    </Card>
  )
}

function Earnings() {
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let active = true
    fetchMyCommissions()
      .then((d) => active && setState({ loading: false, data: d }))
      .catch((e) => active && setState({ loading: false, error: e.message }))
    return () => {
      active = false
    }
  }, [])

  return (
    <Card>
      <p className="eyebrow">Commission earnings</p>
      {state.loading ? (
        <div className="mt-6 flex items-center gap-3 text-espresso/50 text-sm">
          <Spinner /> Loading earnings…
        </div>
      ) : state.error ? (
        <p className="mt-4 text-sm text-espresso/50">
          Couldn't load earnings right now. {state.error}
        </p>
      ) : !state.data?.configured ? (
        <p className="mt-4 text-sm text-espresso/50">{state.data?.message}</p>
      ) : !state.data?.found ? (
        <p className="mt-4 text-sm text-espresso/50">{state.data?.message}</p>
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

function KitSection({ kit, pieces, onChange }) {
  return (
    <Card>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="eyebrow">Your kit</p>
        {kit?.status && <Badge status={kit.status} />}
      </div>

      {!kit ? (
        <EmptyState
          title="No kit yet"
          hint="Your kit details will show up here once it's on the way."
        />
      ) : (
        <>
          {kit.tracking_number && (
            <p className="text-sm text-espresso/60 mt-3">
              Tracking:{' '}
              <span className="text-espresso font-medium">{kit.tracking_number}</span>
            </p>
          )}
          {kit.return_by_date && (
            <p className="text-sm text-espresso/60 mt-1">
              Please decide on returns by{' '}
              <span className="text-espresso font-medium">{kit.return_by_date}</span>
            </p>
          )}

          <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {pieces.length === 0 ? (
              <p className="text-sm text-espresso/50">No pieces listed yet.</p>
            ) : (
              pieces.map((piece) => (
                <PieceCard key={piece.id} piece={piece} onChange={onChange} />
              ))
            )}
          </div>
        </>
      )}
    </Card>
  )
}

function PieceCard({ piece, onChange }) {
  const [saving, setSaving] = useState(false)

  async function decide(decision) {
    setSaving(true)
    await supabase
      .from('kit_pieces')
      .update({ partner_decision: decision })
      .eq('id', piece.id)
    setSaving(false)
    onChange()
  }

  return (
    <div className="rounded-2xl border border-espresso/5 bg-white overflow-hidden">
      <div className="aspect-[4/5] bg-cream flex items-center justify-center overflow-hidden">
        {piece.photo_url ? (
          <img
            src={piece.photo_url}
            alt={piece.piece_name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <span className="font-heading text-espresso/20 text-lg italic">No photo</span>
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

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button
            disabled={saving}
            onClick={() => decide('Keep')}
            className={
              piece.partner_decision === 'Keep'
                ? 'btn bg-green-600 text-white text-xs'
                : 'btn-outline text-xs'
            }
          >
            Keep
          </button>
          <button
            disabled={saving}
            onClick={() => decide('Return')}
            className={
              piece.partner_decision === 'Return'
                ? 'btn bg-amber-600 text-white text-xs'
                : 'btn-outline text-xs'
            }
          >
            Return
          </button>
        </div>
      </div>
    </div>
  )
}

function NoteSection({ partner, onSaved }) {
  const [text, setText] = useState(partner.partner_message || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function save() {
    setSaving(true)
    setSaved(false)
    await supabase
      .from('partners')
      .update({ partner_message: text })
      .eq('id', partner.id)
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    onSaved?.()
  }

  return (
    <Card>
      <p className="eyebrow">Leave the PLANET team a note</p>
      <p className="text-sm text-espresso/55 mt-2">
        Questions, feedback, or anything you'd like to share.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder="Type your message…"
        className="input mt-3 resize-none"
      />
      <div className="flex items-center justify-end gap-3 mt-3">
        {saved && <span className="text-xs text-green-600">Saved ✓</span>}
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? <Spinner /> : 'Save note'}
        </button>
      </div>
    </Card>
  )
}
