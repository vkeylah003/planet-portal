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

// ── Fabric keywords for matching against catalog product titles ──
// FABRIC's values are the display strings shown to the curation team (e.g.
// "Sculptural Nylon"), which won't literally substring-match a plain Shopify
// title like "Nylon Big Pocket Pants". This is a parallel keyword list, keyed
// the same as FABRIC, of the raw words/phrases to look for instead.
const FABRIC_KEYWORDS = {
  scuba: ['scuba'],
  nylon: ['nylon'],
  pima: ['pima'],
  cotton: ['cotton'],
  frenchTerry: ['french terry'],
  matteJersey: ['matte jersey'],
  lycra: ['cotton lycra'],
  sateen: ['sateen'],
  linen: ['linen'],
  organza: ['organza'],
  veganLeather: ['vegan leather'],
  metallic: ['metallic'],
  knit: ['cotton'],
}

// Map a FABRIC display string back to its keyword list.
const FABRIC_DISPLAY_TO_KEYWORDS = Object.fromEntries(
  Object.entries(FABRIC).map(([key, display]) => [display, FABRIC_KEYWORDS[key] || []])
)

// Derive a catalog item's "base name" (the garment, independent of color) by
// stripping a trailing " - <Color>" suffix from its title — same convention
// api/collection.js's deriveColor() relies on (split on the LAST " - ").
// Different colors of the same piece are separate catalog entries that share
// this base name, so it's the key used to dedupe and to check shipment history.
function baseName(title) {
  const t = String(title || '')
  const dash = t.lastIndexOf(' - ')
  return (dash > -1 ? t.slice(0, dash) : t).trim().toLowerCase()
}

// ── Category inference for size filtering ──
// The style quiz stores sizes as quiz.sizes = { tops, bottoms, dress, shoe }
// (see SIZE_LABELS in AdminDashboard.jsx's QuizAnswers). The catalog has no
// direct field for this, so we infer which of those a catalog item belongs to.
// Layering Pieces (jackets/vests/capes) and Jumpsuits have no corresponding
// quiz.sizes field, so they're intentionally left out of this map — those
// items (and anything else we can't confidently categorize) are never
// size-filtered, rather than guessing wrong and zeroing out inventory.
const SILHOUETTE_SIZE_CATEGORY = {
  'Pants-forward': 'bottoms',
  Skirts: 'bottoms',
  Dresses: 'dress',
  'Tops & Blouses': 'tops',
}

// Infer a catalog item's quiz.sizes category ('tops' | 'bottoms' | 'dress'),
// trying Shopify's own product_type first, then falling back to matching the
// item's title against the piece names grouped in SILHOUETTE_MAP. Returns
// null when it can't confidently tell — callers must treat that as "don't
// filter this item on size."
function inferSizeCategory(item) {
  const productType = String(item?.product_type || '').toLowerCase().trim()
  if (productType) {
    if (/dress/.test(productType)) return 'dress'
    if (/pant|skirt|short|trouser|bottom|gaucho/.test(productType)) return 'bottoms'
    if (/top|blouse|tee|shirt|tank/.test(productType)) return 'tops'
  }

  const title = String(item?.title || '').toLowerCase()
  for (const [silhouette, category] of Object.entries(SILHOUETTE_SIZE_CATEGORY)) {
    const piecesForSilhouette = SILHOUETTE_MAP[silhouette] || []
    if (piecesForSilhouette.some((p) => title.includes(p.toLowerCase()))) return category
  }
  return null
}

// Whether a catalog item should be dropped because it's confidently NOT in
// the partner's answered size. Only filters when we can confidently tell
// BOTH the item's category AND that it has a size dimension at all (a
// non-empty availableSizes) — an unknown category, a blank quiz answer for
// that category, or no "Size" option on the product all mean "don't filter."
function failsSizeFilter(item, sizesAnswered) {
  const category = inferSizeCategory(item)
  if (!category) return false
  const wanted = sizesAnswered[category]
  if (!wanted || !String(wanted).trim()) return false
  const sizes = Array.isArray(item?.availableSizes) ? item.availableSizes : []
  if (sizes.length === 0) return false
  const wantedNorm = String(wanted).trim().toLowerCase()
  return !sizes.some((s) => String(s).trim().toLowerCase() === wantedNorm)
}

// Which SILHOUETTE_MAP category (if any) a catalog item belongs to, by the
// same title-match approach the piece-scoring below uses. Items that don't
// match any category get their own singleton "category" — grouped by
// product_type when there is one (so, say, multiple unmatched "Accessories"
// still compete for one slot), or by product id when there isn't (fully
// unique, so a totally uncategorizable item is always eligible and never
// crowds out — or gets crowded out by — anything else).
function inferSilhouetteCategory(item) {
  const title = String(item?.title || '').toLowerCase()
  for (const [silhouette, piecesForSilhouette] of Object.entries(SILHOUETTE_MAP)) {
    if (piecesForSilhouette.some((p) => title.includes(p.toLowerCase()))) return silhouette
  }
  const productType = String(item?.product_type || '').trim().toLowerCase()
  if (productType) return `product-type:${productType}`
  return `singleton:${item?.product_id ?? item?.variant_id ?? title}`
}

/**
 * Score and rank live catalog items against a partner's translated quiz
 * preferences, for the curation team to pull from at a glance. Results are
 * category-diverse: a curated box shouldn't repeat a garment type (e.g. 3
 * jackets) just because those items scored well — one item per SILHOUETTE_MAP
 * category is preferred, in the partner's own silhouette-pick order, before
 * a second item from any category is allowed in.
 * @param {object} quiz - the stored style_quiz object.
 * @param {Array} catalogItems - items from fetchCatalog() (../lib/catalog).
 *   Each item's `availableSizes` (if any) is checked against quiz.sizes.
 * @param {{limit?: number, excludePieceNames?: string[]}} [opts]
 *   - limit: max items to return (default 3).
 *   - excludePieceNames: piece names (any case) the partner has already
 *     received in a prior kit — matched against each item's base name and
 *     excluded entirely, before scoring.
 * @returns {Array} up to `limit` catalog items, never two sharing a base name
 *   (garment) or a SILHOUETTE_MAP category unless there weren't enough
 *   distinct categories to fill `limit`, never an excluded piece, and never
 *   an item confidently known to be out of stock in the partner's size.
 */
export function recommendProducts(quiz, catalogItems, { limit = 3, excludePieceNames = [] } = {}) {
  const excluded = new Set(
    (Array.isArray(excludePieceNames) ? excludePieceNames : [])
      .map((n) => String(n || '').trim().toLowerCase())
      .filter(Boolean)
  )
  const sizesAnswered =
    quiz && quiz.sizes && typeof quiz.sizes === 'object' ? quiz.sizes : {}

  const items = (Array.isArray(catalogItems) ? catalogItems : [])
    .filter((item) => !excluded.has(baseName(item?.title)))
    .filter((item) => !failsSizeFilter(item, sizesAnswered))
  if (items.length === 0) return []

  const { fabrics, pieces, palette } = translateQuiz(quiz)
  const fabricKeywords = uniq(fabrics.flatMap((f) => FABRIC_DISPLAY_TO_KEYWORDS[f] || []))
  const paletteLower = palette.map((c) => c.toLowerCase())

  const scored = items.map((item, index) => {
    const title = String(item?.title || '').toLowerCase()
    const color = String(item?.color || '').toLowerCase()
    let score = 0

    if (pieces.some((p) => title.includes(p.toLowerCase()))) score += 3
    if (fabricKeywords.some((kw) => title.includes(kw))) score += 2
    if (color && paletteLower.some((c) => color.includes(c))) score += 1

    return { item, score, index, base: baseName(item?.title), category: inferSilhouetteCategory(item) }
  })

  const sorted = [...scored].sort((a, b) => b.score - a.score || a.index - b.index)

  // Category priority order: the partner's own silhouette picks first. The
  // `pieces` list (from translateQuiz) is already ordered by pick order —
  // walk it and map each piece name back to its category to recover that
  // order without re-reading the raw quiz.silhouettes array. Then append any
  // other categories present among the candidates (best-score-first) so
  // off-silhouette items can still contribute to diversity.
  const pieceToCategory = new Map()
  for (const [silhouette, piecesForSilhouette] of Object.entries(SILHOUETTE_MAP)) {
    for (const p of piecesForSilhouette) pieceToCategory.set(p, silhouette)
  }
  const categoryOrder = []
  const seenCategory = new Set()
  for (const p of pieces) {
    const cat = pieceToCategory.get(p)
    if (cat && !seenCategory.has(cat)) {
      seenCategory.add(cat)
      categoryOrder.push(cat)
    }
  }
  for (const s of sorted) {
    if (!seenCategory.has(s.category)) {
      seenCategory.add(s.category)
      categoryOrder.push(s.category)
    }
  }

  const chosen = []
  const chosenBases = new Set()
  const usedCategories = new Set()

  // Pass 1: best-scoring (score > 0) item from each not-yet-represented
  // category, categories visited in priority order.
  for (const cat of categoryOrder) {
    if (chosen.length >= limit) break
    const best = sorted.find((s) => s.category === cat && s.score > 0 && !chosenBases.has(s.base))
    if (!best) continue
    chosen.push(best.item)
    chosenBases.add(best.base)
    usedCategories.add(cat)
  }

  // Pass 2: still short? Only now allow a second (score > 0) item from a
  // category already used — never before every distinct category had a turn.
  if (chosen.length < limit) {
    for (const s of sorted) {
      if (chosen.length >= limit) break
      if (s.score <= 0 || chosenBases.has(s.base)) continue
      chosen.push(s.item)
      chosenBases.add(s.base)
      usedCategories.add(s.category)
    }
  }

  if (chosen.length >= limit) return chosen

  // Backfill with next-highest-scoring in-stock items (score can be 0) so we
  // still return up to `limit` when the catalog has enough DISTINCT pieces —
  // same category-diversity-first rule applies to the backfill pool.
  const chosenSet = new Set(chosen)
  const backfillPool = sorted.filter((s) => !chosenSet.has(s.item) && s.item?.available !== false)

  for (const cat of categoryOrder) {
    if (chosen.length >= limit) break
    if (usedCategories.has(cat)) continue
    const best = backfillPool.find((s) => s.category === cat && !chosenBases.has(s.base))
    if (!best) continue
    chosen.push(best.item)
    chosenBases.add(best.base)
    usedCategories.add(cat)
  }

  if (chosen.length < limit) {
    for (const s of backfillPool) {
      if (chosen.length >= limit) break
      if (chosenBases.has(s.base)) continue
      chosen.push(s.item)
      chosenBases.add(s.base)
    }
  }

  return chosen.slice(0, limit)
}

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
