// ─────────────────────────────────────────────────────────────────────────
// Style-quiz → PLANET translation
// ─────────────────────────────────────────────────────────────────────────
// Partners answer the style quiz in plain-language terms ("structured & crisp",
// "soft & romantic"). The curation team, though, builds a box in PLANET's OWN
// vocabulary — the fabrics, materials, and signature silhouettes the brand
// actually makes. This module is that translator: it converts a partner's raw
// quiz answers into the PLANET terms the team pulls from.
//
// Every fabric/piece name below is REAL — it exists in the live Stylist
// Collective catalog (Shopify tags + shipped kit_pieces). Do NOT add fabrics
// PLANET doesn't make. Source vocabulary observed:
//   Fabrics/materials: Pima Cotton, Cotton, French Terry, Matte Jersey, Nylon,
//     Scuba, Sateen, Cotton Lycra, Linen, Organza, Vegan Leather,
//     Metallic Crochet / Seed Stitch, knit sweaters (cable/cowl/seed stitch).
//   Signature pieces: Nylon Big Pocket Pants, Nylon Signature Architectural
//     Skirt, Cotton Flood/Gaucho Pants, Vegan Leather Bell Bottoms, Sateen
//     Slip Dress / E-Z Pants, Cotton Lycra Ruched Tank Dress, Organza Jackie O
//     Top, Pima Cotton Luxury Boxy/Bateau Tee, cropped jackets, Chic Cape…
//
// This map is a JUDGMENT CALL. It's intentionally kept in one place so it's easy
// to review and refine. The admin quiz view computes the translation LIVE from
// this map (so a refinement instantly re-flows every quiz, old and new); a
// backfill also stamps a copy onto historical rows for data completeness.

// The canonical PLANET fabric/material terms (display strings).
export const FABRIC = {
  scuba: 'Scuba',
  nylon: 'Sculptural Nylon',
  pima: 'Pima Cotton',
  cotton: 'Cotton',
  frenchTerry: 'French Terry',
  matteJersey: 'Matte Jersey',
  lycra: 'Cotton Lycra',
  sateen: 'Sateen',
  linen: 'Linen',
  organza: 'Organza',
  veganLeather: 'Vegan Leather',
  metallic: 'Metallic Crochet / Seed Stitch',
  knit: 'Pima Cotton Knits',
}

// ── Fabrics & textures answer → PLANET fabrics ──
// Includes the legacy "Structured & Tailored" label (renamed to "Structured &
// Crisp" in commit 902aa79) so older stored answers still translate.
const FABRIC_MAP = {
  'Structured & Crisp': [FABRIC.scuba, FABRIC.nylon, FABRIC.sateen], // Sofia's example: structured + breathable → Scuba
  'Structured & Tailored': [FABRIC.scuba, FABRIC.nylon, FABRIC.sateen],
  'Flowy & Drapey': [FABRIC.matteJersey, FABRIC.organza, FABRIC.lycra],
  'Cozy Knits': [FABRIC.knit, FABRIC.frenchTerry],
  'Vegan Leather': [FABRIC.veganLeather],
  'Linen & Natural': [FABRIC.linen, FABRIC.cotton],
  'Silky & Smooth': [FABRIC.sateen, FABRIC.matteJersey, FABRIC.lycra],
}

// ── Style vibe → PLANET fabric lean ──
const VIBE_MAP = {
  'Classic & Polished': [FABRIC.pima, FABRIC.sateen, FABRIC.cotton],
  'Effortless & Relaxed': [FABRIC.frenchTerry, FABRIC.cotton, FABRIC.pima],
  'Architectural & Edgy': [FABRIC.nylon, FABRIC.scuba, FABRIC.veganLeather],
  'Soft & Romantic': [FABRIC.organza, FABRIC.pima, FABRIC.matteJersey],
  'Minimal & Monochrome': [FABRIC.matteJersey, FABRIC.scuba, FABRIC.pima],
  'Statement & Bold': [FABRIC.metallic, FABRIC.veganLeather, FABRIC.nylon],
}

// ── Occasion → PLANET fabric lean (context, lighter weight than vibe/fabric) ──
const OCCASION_FABRIC_MAP = {
  Everyday: [FABRIC.pima, FABRIC.cotton, FABRIC.frenchTerry],
  'Work & Office': [FABRIC.sateen, FABRIC.nylon],
  'Events & Evening': [FABRIC.metallic, FABRIC.sateen, FABRIC.organza],
  Travel: [FABRIC.nylon, FABRIC.matteJersey, FABRIC.scuba], // packable, wrinkle-shy
  Weekend: [FABRIC.frenchTerry, FABRIC.cotton],
}

// A short curation note per occasion (shown as context in the summary).
const OCCASION_NOTE = {
  Everyday: 'easy daytime staples',
  'Work & Office': 'polished workwear',
  'Events & Evening': 'elevated evening pieces',
  Travel: 'packable, wrinkle-shy travel pieces',
  Weekend: 'relaxed weekend layers',
}

// ── Silhouette → PLANET signature pieces to pull ──
// NOTE: "Jumpsuits" has no true jumpsuit in the current catalog — mapped to the
// closest one-piece and flagged as ambiguous below.
const SILHOUETTE_MAP = {
  'Pants-forward': [
    'Nylon Big Pocket Pants',
    'Cotton Flood / Gaucho Pants',
    'Vegan Leather Bell Bottoms',
    'Sateen E-Z Pants',
  ],
  Dresses: [
    'Cotton Lycra Ruched Tank Dress',
    'Sateen Slip Dress',
    'Matte Jersey Tube Dress',
  ],
  'Tops & Blouses': [
    'Organza / Pima Cotton Jackie O Top',
    'Pima Cotton Luxury Boxy / Bateau Tee',
    'Cotton Half Moon / Menz Shirt',
  ],
  'Layering Pieces': [
    'Cropped Swing / Nylon Bomber Jacket',
    'Linen / Nylon Triple Collar Jacket',
    'Nylon Chic Cape',
    'Vegan Leather Mini Cargo Vest',
  ],
  Skirts: ['Nylon Signature Architectural Skirt', 'Lycra / Matte Jersey Tube Skirt'],
  Jumpsuits: ['Coordinated set / one-piece (no true jumpsuit in stock — closest: Ruched Tank Dress)'],
}

// ── Colors & palette → PLANET color names (from the live catalog color list) ──
const COLOR_MAP = {
  'Neutrals & Creams': ['Butter', 'Vanilla', 'Putty', 'Stone', 'Sand', 'Cameo', 'Chalk'],
  'Black & White': ['Black', 'White', 'Midnight', 'Obsidian'],
  'Earth Tones': ['Loden', 'Walnut', 'Fawn', 'Stone', 'Putty', 'Guacamole'],
  'Jewel Tones': ['Amethyst', 'Plum', 'Peacock', 'Royal', 'Chili'],
  'Brights & Color': ['Lava', 'Chartreuse', 'Cherry', 'Capri', 'Creamsicle', 'Peony'],
  'Soft Pastels': ['Blush', 'Sky', 'Mint', 'Cornflower', 'Cameo'],
}

// Merge helper: push all of `arr` into `counts`, tallying how many answers
// point at each term. Frequency = curation confidence, so we can rank by it.
function tally(counts, arr) {
  for (const v of arr || []) counts.set(v, (counts.get(v) || 0) + 1)
}

// Rank a tally map into a display array (most-pointed-to first, stable on ties
// by first-seen insertion order), capped to `limit`.
function ranked(counts, limit) {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k]) => k)
    .slice(0, limit)
}

// Dedupe an array preserving order.
const uniq = (arr) => [...new Set(arr)]

/**
 * Translate a style-quiz payload into PLANET terms.
 * @param {object} quiz - the stored style_quiz object (vibes/colors/fabrics/
 *   silhouettes/occasions arrays, plus sizes/avoid).
 * @returns {{fabrics:string[], pieces:string[], palette:string[],
 *   occasions:string[], summary:string, ambiguous:string[]}}
 */
export function translateQuiz(quiz) {
  const q = quiz || {}
  const vibes = Array.isArray(q.vibes) ? q.vibes : []
  const colors = Array.isArray(q.colors) ? q.colors : []
  const fabricsAns = Array.isArray(q.fabrics) ? q.fabrics : []
  const silhouettes = Array.isArray(q.silhouettes) ? q.silhouettes : []
  const occasions = Array.isArray(q.occasions) ? q.occasions : []

  // Fabrics: weight explicit fabric answers most, then vibe, then occasion.
  const fabricCounts = new Map()
  for (const a of fabricsAns) tally(fabricCounts, FABRIC_MAP[a])
  for (const a of fabricsAns) tally(fabricCounts, FABRIC_MAP[a]) // fabric answers count double (they're the direct signal)
  for (const a of vibes) tally(fabricCounts, VIBE_MAP[a])
  for (const a of occasions) tally(fabricCounts, OCCASION_FABRIC_MAP[a])
  const fabrics = ranked(fabricCounts, 5)

  // Signature pieces from silhouettes (order follows the partner's picks).
  const pieces = uniq(silhouettes.flatMap((s) => SILHOUETTE_MAP[s] || [])).slice(0, 7)

  // Palette from color families (order follows the partner's picks).
  const palette = uniq(colors.flatMap((c) => COLOR_MAP[c] || [])).slice(0, 9)

  // Occasion context notes.
  const occasionNotes = uniq(occasions.map((o) => OCCASION_NOTE[o]).filter(Boolean))

  // Ambiguity flags for the team.
  const ambiguous = []
  if (silhouettes.includes('Jumpsuits')) {
    ambiguous.push('No true jumpsuit in the catalog — offered a coord set / Ruched Tank Dress instead.')
  }

  // One-line condensed read: fabrics → pieces → palette (+ occasion context).
  const parts = []
  if (fabrics.length) parts.push(`Lead with ${fabrics.join(', ')}`)
  if (pieces.length) parts.push(`in ${pieces.slice(0, 4).join(', ')}`)
  if (palette.length) parts.push(`palette: ${palette.slice(0, 5).join(', ')}`)
  if (occasionNotes.length) parts.push(`for ${occasionNotes.join(' & ')}`)
  let summary = parts.join(' · ')
  if (q.avoid && String(q.avoid).trim()) summary += ` — avoid: ${String(q.avoid).trim()}`

  return { fabrics, pieces, palette, occasions: occasionNotes, summary, ambiguous }
}
