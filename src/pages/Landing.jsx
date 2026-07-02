import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Logo, FullPageLoader } from '../components/ui'

export default function Landing() {
  const { session, isAdmin, loading } = useAuth()

  if (loading) return <FullPageLoader />
  // Admins land on their dashboard; partners arrive via their private link.
  if (session && isAdmin) return <Navigate to="/admin" replace />

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <Logo subtitle="Style Collective" />

        <p className="mt-8 text-espresso/60 leading-relaxed font-light">
          An elevated space for our partners and our collective.
        </p>

        <div className="mt-8 rounded-2xl border border-espresso/10 bg-white/60 px-6 py-5">
          <p className="text-sm text-espresso/70 leading-relaxed">
            <span className="font-medium text-espresso">Partners:</span> use the private
            link we sent you to open your portal — no password needed. Need a new one? Just
            reach out to the PLANET team.
          </p>
        </div>

        <div className="mt-8">
          <Link to="/admin/login" className="btn-outline w-full">
            Internal Dashboard
          </Link>
        </div>

        <p className="mt-12 text-[10px] uppercase tracking-[0.3em] text-espresso/30">
          PLANET by Lauren G · Elevated · Minimal
        </p>
      </div>
    </div>
  )
}
