// Outreach report export — turns the contacted roster into a clean PDF (and
// CSV) the boss can download anytime. No dates by design: only name, business,
// category, status, and summary counts.
//
// The PDF table is rendered with jsPDF core primitives (no jspdf-autotable) —
// fewer deps, a lighter bundle, and full control over the on-brand styling.

import { jsPDF } from 'jspdf'

export const CATEGORY_LABELS = {
  stylist: 'Stylist',
  'blogger-influencer': 'Blogger / Influencer',
  'platform-partner': 'Platform / Brand Partner',
  UGC: 'UGC',
}

export const STATUS_LABELS = {
  active: 'Active',
  gifted: 'Gifted',
  interested: 'Interested',
  contacted: 'Contacted',
  declined: 'Declined',
}

// Display order — most engaged first.
const STATUS_ORDER = ['active', 'gifted', 'interested', 'contacted', 'declined']
const CATEGORY_ORDER = ['stylist', 'blogger-influencer', 'platform-partner', 'UGC']

export function catLabel(c) {
  return CATEGORY_LABELS[c] || c || '—'
}
export function statusLabel(s) {
  return STATUS_LABELS[s] || s || '—'
}

// Tallies used both in the dashboard summary and the report header.
export function summarize(rows) {
  const byStatus = {}
  const byCategory = {}
  for (const r of rows) {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1
    byCategory[r.category] = (byCategory[r.category] || 0) + 1
  }
  return { total: rows.length, byStatus, byCategory }
}

// Sort: category group, then status priority, then name.
export function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const c = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
    if (c !== 0) return c
    const s = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
    if (s !== 0) return s
    return (a.name || '').localeCompare(b.name || '')
  })
}

function stamp() {
  // Filename date only (the report body intentionally omits dates).
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Brand palette (RGB).
const INK = [40, 30, 24]
const GOLD = [176, 141, 87]
const CREAM = [248, 244, 236]
const ALT = [250, 247, 241]
const MUTE = [120, 110, 100]

// ── PDF document builder (pure: returns a jsPDF doc, no download) ───────
export function buildContactedDoc(rows) {
  const sorted = sortRows(rows)
  const { total, byStatus, byCategory } = summarize(rows)

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const marginX = 40
  const bottom = pageH - 40
  const rowH = 17

  const cols = [
    { title: 'Name', x: 40, w: 150 },
    { title: 'Business', x: 190, w: 175 },
    { title: 'Category', x: 365, w: 115 },
    { title: 'Status', x: 480, w: 92 },
  ]

  // Trim text with an ellipsis so each cell stays on one line.
  const fit = (text, w) => {
    let t = String(text ?? '')
    if (doc.getTextWidth(t) <= w - 8) return t
    while (t.length > 1 && doc.getTextWidth(t + '…') > w - 8) t = t.slice(0, -1)
    return t + '…'
  }

  function drawColumnHeader(startY) {
    doc.setFillColor(...INK)
    doc.rect(marginX, startY, pageW - marginX * 2, rowH, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...CREAM)
    cols.forEach((c) => doc.text(c.title, c.x + 4, startY + 12))
    return startY + rowH
  }

  // ── Page 1 chrome: brand header + summary box ──
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...INK)
  doc.text('PLANET', marginX, 50)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...GOLD)
  doc.text('BY LAUREN G', marginX, 64)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(14)
  doc.setTextColor(...INK)
  doc.text('Style Collective — Outreach Report', marginX, 90)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...MUTE)
  doc.text('Everyone contacted for the PLANET Style Collective', marginX, 106)

  const statusBits = STATUS_ORDER.filter((s) => byStatus[s]).map(
    (s) => `${STATUS_LABELS[s]}: ${byStatus[s]}`
  )
  const catBits = CATEGORY_ORDER.filter((c) => byCategory[c]).map(
    (c) => `${CATEGORY_LABELS[c]}: ${byCategory[c]}`
  )
  doc.setFillColor(...CREAM)
  doc.roundedRect(marginX, 120, pageW - marginX * 2, 56, 6, 6, 'F')
  doc.setFontSize(11)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  doc.text(`${total} people contacted`, marginX + 14, 140)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(90, 80, 70)
  doc.text(statusBits.join('   •   '), marginX + 14, 154)
  doc.text(catBits.join('   •   '), marginX + 14, 167)

  // ── Table ──
  let y = drawColumnHeader(190)
  sorted.forEach((r, i) => {
    if (y + rowH > bottom) {
      doc.addPage()
      y = drawColumnHeader(50)
    }
    if (i % 2 === 1) {
      doc.setFillColor(...ALT)
      doc.rect(marginX, y, pageW - marginX * 2, rowH, 'F')
    }
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(50, 42, 35)
    doc.text(fit(r.name, cols[0].w), cols[0].x + 4, y + 12)
    doc.text(fit(r.business || '', cols[1].w), cols[1].x + 4, y + 12)
    doc.text(fit(catLabel(r.category), cols[2].w), cols[2].x + 4, y + 12)
    doc.text(fit(statusLabel(r.status), cols[3].w), cols[3].x + 4, y + 12)
    y += rowH
  })

  // ── Footer on every page ──
  const pages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFontSize(8)
    doc.setTextColor(160, 150, 140)
    doc.text(
      `PLANET Style Collective — Outreach Report   ·   Page ${p} of ${pages}`,
      marginX,
      pageH - 20
    )
  }

  return doc
}

export function downloadContactedPDF(rows) {
  buildContactedDoc(rows).save(`PLANET-Outreach-Report-${stamp()}.pdf`)
}

// ── CSV ───────────────────────────────────────────────────────────────
export function downloadContactedCSV(rows) {
  const sorted = sortRows(rows)
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const lines = [
    ['Name', 'Business', 'Category', 'Status'].join(','),
    ...sorted.map((r) =>
      [r.name, r.business, catLabel(r.category), statusLabel(r.status)].map(esc).join(',')
    ),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `PLANET-Outreach-Report-${stamp()}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
