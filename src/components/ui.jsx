// Small shared UI building blocks, all on-brand.

export function Logo({ subtitle = 'Style Collective', className = '', invert = false }) {
  return (
    <div className={`text-center ${className}`}>
      <img
        src="/planet-wordmark.png"
        alt="PLANET by Lauren G"
        className={`mx-auto h-9 w-auto ${invert ? 'logo-invert' : ''}`}
      />
      <div className="text-[11px] uppercase tracking-[0.4em] text-gold mt-2.5">
        by Lauren G
      </div>
      {subtitle && (
        <div className="mt-3 font-heading text-lg italic text-espresso/70">{subtitle}</div>
      )}
    </div>
  )
}

export function Spinner({ className = '' }) {
  return (
    <div
      className={`inline-block h-5 w-5 animate-spin rounded-full border-2 border-gold/30 border-t-gold ${className}`}
      role="status"
      aria-label="Loading"
    />
  )
}

export function FullPageLoader({ label = 'Loading…' }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-cream">
      <Spinner className="h-8 w-8" />
      <p className="text-sm text-espresso/50 tracking-wide">{label}</p>
    </div>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`card p-6 ${className}`}>{children}</div>
}

// Status pill with brand-tinted colors per status value.
const STATUS_STYLES = {
  // partner statuses
  Contacted: 'bg-espresso/10 text-espresso/70',
  Interested: 'bg-gold-soft/40 text-espresso',
  'Active Partner': 'bg-gold/20 text-gold',
  Passed: 'bg-espresso/5 text-espresso/40',
  // kit statuses
  Preparing: 'bg-espresso/10 text-espresso/70',
  Shipped: 'bg-blue-100 text-blue-700',
  Delivered: 'bg-green-100 text-green-700',
  'Return Pending': 'bg-amber-100 text-amber-700',
  Returned: 'bg-espresso/10 text-espresso/60',
  Kept: 'bg-violet-100 text-violet-700',
  // piece decisions
  Keep: 'bg-green-100 text-green-700',
  Return: 'bg-amber-100 text-amber-700',
  // content types
  Reel: 'bg-purple-100 text-purple-700',
  'Feed Post': 'bg-rose-100 text-rose-700',
  Story: 'bg-sky-100 text-sky-700',
  'Blog Post': 'bg-teal-100 text-teal-700',
}

export function Badge({ status, children, className = '' }) {
  const label = children ?? status
  const style = STATUS_STYLES[status] || 'bg-espresso/10 text-espresso/70'
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium tracking-wide ${style} ${className}`}
    >
      {label}
    </span>
  )
}

// Affiliate-platform tag — visually distinct from status badges.
// Impact = blue, GoAffPro = green.
const PLATFORM_STYLES = {
  Impact: 'bg-blue-100 text-blue-700',
  GoAffPro: 'bg-green-100 text-green-700',
}

export function PlatformBadge({ platform, className = '' }) {
  if (!platform) return null
  const style = PLATFORM_STYLES[platform] || 'bg-espresso/10 text-espresso/70'
  return (
    <span
      title={`${platform} platform`}
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide ${style} ${className}`}
    >
      {platform}
    </span>
  )
}

export function EmptyState({ title, hint }) {
  return (
    <div className="text-center py-12 px-6">
      <p className="font-heading text-xl text-espresso/60">{title}</p>
      {hint && <p className="text-sm text-espresso/40 mt-2">{hint}</p>}
    </div>
  )
}

export function Field({ label, children }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  )
}
