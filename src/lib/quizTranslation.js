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

// ── Outfit-role classification ──
// A coarse bucket for what part of a look a catalog item plays: 'tops',
// 'bottoms', 'dress', or 'outerwear' (SILHOUETTE_MAP's "Layering Pieces" —
// jackets, vests, capes, coats, cardigans, bombers, kimonos). Tries
// Shopify's own product_type first, then falls back to the same regex
// against the title. These patterns were chosen by pulling a real page of
// https://shopplanetbylaureng.com/collections/stylist-collective/products.json
// and reading the actual product_type/title values in the live catalog
// (observed product_types: Dress, Pants, T-Shirt, Tank, Sweater, Top,
// Shirt, Skirt, Capes, Jacket, Vest) — NOT SILHOUETTE_MAP's curator
// piece-name strings (see inferSilhouetteCategory below), which are
// shorthand for the Translation display and almost never substring-match
// actual Shopify titles. Returns null when it can't confidently tell.
const DRESS_RE = /dress/
const BOTTOMS_RE = /pant|skirt|short|trouser|bottom|gaucho/
const OUTERWEAR_RE = /jacket|blazer|vest|cape|coat|cardigan|bomber|kimono/
const TOPS_RE = /top|blouse|tee|shirt|tank/

function inferOutfitRole(item) {
  const productType = String(item?.product_type || '').toLowerCase().trim()
  if (productType) {
    if (DRESS_RE.test(productType)) return 'dress'
    if (BOTTOMS_RE.test(productType)) return 'bottoms'
    if (OUTERWEAR_RE.test(productType)) return 'outerwear'
    if (TOPS_RE.test(productType)) return 'tops'
  }

  const title = String(item?.title || '').toLowerCase()
  if (DRESS_RE.test(title)) return 'dress'
  if (BOTTOMS_RE.test(title)) return 'bottoms'
  if (OUTERWEAR_RE.test(title)) return 'outerwear'
  if (TOPS_RE.test(title)) return 'tops'

  return null
}

// ── Size filtering ──
// PLANET's own numeric sizing only spans 0, 1, 2, 2-3, 3 (per their published
// size chart — roughly 26"-32" waist / 37"-44.5" hip). The style quiz's size
// fields (tops/bottoms/dress/shoe) just ask the partner to type a plain
// number/size with no stated convention (a partner might answer "6"), which
// has nothing to do with PLANET's numeric scale. This is NOT a
// normalization problem (trim/case-fold can't fix it) — it's two different
// sizing systems, and comparing them falsely excludes real inventory for
// nearly every partner, not just an edge case.
//
// Confirmed against a real pull of
// https://shopplanetbylaureng.com/collections/stylist-collective/products.json:
// every non-empty availableSizes value in the live catalog is either
// PLANET's numeric scale ("0"-"4") or a literal "One Size" — never an alpha
// S/M/L size a partner's plain-language answer might plausibly match. That
// numeric scale isn't unique to bottoms/dress either: the live Tank and
// Shirt product types (both of which inferOutfitRole classifies as 'tops')
// carry it too, so 'tops' has the exact same mismatch, not a safely
// different alpha scale. So NO category is currently confidently
// filterable against the quiz's size answer.
//
// A real fix needs the quiz's size question to either collect a waist/hip
// measurement or explicitly state its convention, so it can be mapped to
// PLANET's chart. Don't reintroduce filtering here with a guessed
// conversion table — a wrong mapping would confidently recommend the WRONG
// size, which is worse than not filtering at all.
const FILTERABLE_SIZE_CATEGORIES = new Set() // none — see above; don't add tops/bottoms/dress back without fixing the underlying convention mismatch first

// Whether an availableSizes value reads as a one-size garment — "One Size",
// "OS", "O/S", "One Size Fits All/Most" (common for jackets/sweaters/capes,
// and some tops). A single one-size variant can never meaningfully fail an
// exact match against a specific quiz answer, so it's always treated as
// "don't filter" — for whichever category might become filterable again in
// the future (see FILTERABLE_SIZE_CATEGORIES above), not just today's set.
function isOneSizeValue(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '')
  return ['onesize', 'onesizefitsall', 'onesizefitsmost', 'os'].includes(normalized)
}

// Whether a catalog item should be dropped because it's confidently NOT in
// the partner's answered size. FILTERABLE_SIZE_CATEGORIES is currently
// empty (see above), so this always returns false today — kept as a real
// function, rather than inlined, so the one-size exemption and the
// reasoning stay attached to the actual filtering logic and not just a
// comment. Only filters when we can confidently tell BOTH the item's
// category AND that it has a real, sized (non-one-size) dimension — a blank
// quiz answer for that category, no "Size" option on the product, or a
// one-size variant all mean "don't filter."
function failsSizeFilter(item, sizesAnswered) {
  const role = inferOutfitRole(item)
  if (!FILTERABLE_SIZE_CATEGORIES.has(role)) return false
  const wanted = sizesAnswered[role]
  if (!wanted || !String(wanted).trim()) return false
  const sizes = Array.isArray(item?.availableSizes) ? item.availableSizes : []
  if (sizes.length === 0) return false
  if (sizes.some(isOneSizeValue)) return false
  const wantedNorm = String(wanted).trim().toLowerCase()
  return !sizes.some((s) => String(s).trim().toLowerCase() === wantedNorm)
}

// Matches a catalog item's title against SILHOUETTE_MAP's curator piece-name
// strings (e.g. "Nylon Chic Cape"). Kept for the existing +3 signature-piece
// score boost below (pieces.some(...) match) — a fine signal for "does this
// closely match one of our named pieces." NOT used to group items into an
// outfit anymore: those piece names are shorthand for the Translation
// display, not real Shopify titles, and almost never substring-match actual
// inventory — inferOutfitRole (above) is the real classifier used for that.
function inferSilhouetteCategory(item) {
  const title = String(item?.title || '').toLowerCase()
  for (const [silhouette, piecesForSilhouette] of Object.entries(SILHOUETTE_MAP)) {
    if (piecesForSilhouette.some((p) => title.includes(p.toLowerCase()))) return silhouette
  }
  const productType = String(item?.product_type || '').trim().toLowerCase()
  if (productType) return `product-type:${productType}`
  return `singleton:${item?.product_id ?? item?.variant_id ?? title}`
}

// ── Explicit-mention matching (quiz.avoid free text) ──
// Despite the field's name, partners use quiz.avoid for both "avoid this"
// and "I love this" (e.g. "Love the big pocket pants, the Lina shirt, the
// easy top and linen crop pants!!"). A piece a partner names directly is a
// stronger signal than any inferred fabric/silhouette/palette match, so it's
// checked separately and given priority in recommendProducts below — but a
// false positive here would confidently recommend the wrong thing, which is
// worse than missing a real one, so matching stays deliberately narrow.

// Lowercase, expand simple contractions ("don't" -> "do not"), strip
// punctuation, collapse whitespace. Shared normalization for both the
// partner's quiz.avoid text and catalog item titles, so phrase matching
// between them is apples-to-apples.
function normalizeText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/n't\b/g, ' not')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Connective/filler words too generic to count toward a "confident" phrase
// on their own — a phrase needs at least 2 words that aren't in this list
// (and aren't tiny), so a single common word like "top" or "pants" alone
// never counts as a match. Not meant to be exhaustive.
const MENTION_STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'with', 'for', 'of', 'in', 'my', 'her', 'she',
  'he', 'i', 'am', 'is', 'are', 'also', 'new', 'so', 'just', 'really', 'very',
  'love', 'loved', 'loving', 'like', 'liked', 'likes', 'obsessed', 'fan',
  'collection', 'too',
])

// Contiguous word-sequences from `words`, longest first, restricted to
// phrases with at least 2 "meaningful" words (not a stopword, longer than 2
// characters) — the conservative bar this whole feature leans on.
function candidatePhrases(words) {
  const phrases = []
  for (const n of [4, 3, 2]) {
    for (let i = 0; i + n <= words.length; i++) {
      const slice = words.slice(i, i + n)
      const meaningful = slice.filter((w) => !MENTION_STOPWORDS.has(w) && w.length > 2)
      if (meaningful.length >= 2) phrases.push(slice.join(' '))
    }
  }
  return phrases
}

// Simple negation check, not real NLP: does a negation cue (no/not/never/
// avoid/dislike/hate/skip/without — "don't"/"doesn't" already became "do
// not"/"does not" via normalizeText's contraction expansion) appear in the
// few words right before a matched phrase? Catches "not a fan of vegan
// leather"; anything subtler is out of scope on purpose.
const NEGATION_WORDS = new Set(['no', 'not', 'never', 'avoid', 'dislike', 'hate', 'skip', 'without', 'anti'])
const NEGATION_WINDOW = 4

function isNegatedAt(normalizedText, phrase) {
  const idx = normalizedText.indexOf(phrase)
  if (idx < 0) return false
  const before = normalizedText.slice(0, idx).trim().split(' ').filter(Boolean)
  return before.slice(-NEGATION_WINDOW).some((w) => NEGATION_WORDS.has(w))
}

// Whether a catalog item is explicitly named in the partner's quiz.avoid
// text. Matches bidirectionally and conservatively: either a specific
// multi-word phrase from the item's (color-stripped) title appears in the
// avoid text, or a specific multi-word phrase from the avoid text appears
// in the title — never a single generic word alone. `negated` is true when
// a negation cue sits just before the matched phrase, meaning the item
// should be EXCLUDED rather than boosted.
function getMentionStatus(item, avoidText, avoidPhrases) {
  if (!avoidText) return { mentioned: false, negated: false }
  const titleWords = normalizeText(baseName(item?.title)).split(' ').filter(Boolean)
  const titleText = titleWords.join(' ')

  for (const phrase of candidatePhrases(titleWords)) {
    if (avoidText.includes(phrase)) {
      return { mentioned: true, negated: isNegatedAt(avoidText, phrase) }
    }
  }
  for (const phrase of avoidPhrases) {
    if (titleText.includes(phrase)) {
      return { mentioned: true, negated: isNegatedAt(avoidText, phrase) }
    }
  }
  return { mentioned: false, negated: false }
}

/**
 * Score and rank live catalog items against a partner's translated quiz
 * preferences, for the curation team to pull from at a glance. A piece the
 * partner explicitly names in quiz.avoid wins a slot first — direct intent
 * outranks any inferred match — then remaining slots aim for a genuine
 * outfit: one 'outerwear' + one 'tops' + one 'bottoms' item when all three
 * roles have an eligible candidate, or a 'dress' + 'outerwear' pairing
 * instead when the partner clearly leans toward dresses — never 3 items
 * sharing an outfit role just because they scored well.
 * @param {object} quiz - the stored style_quiz object.
 * @param {Array} catalogItems - items from fetchCatalog() (../lib/catalog).
 *   Each item's `availableSizes` (if any) is checked against quiz.sizes.
 * @param {{limit?: number, excludePieceNames?: string[]}} [opts]
 *   - limit: max items to return (default 3).
 *   - excludePieceNames: piece names (any case) the partner has already
 *     received in a prior kit — matched against each item's base name and
 *     excluded entirely, before scoring.
 * @returns {Array} up to `limit` catalog items, never two sharing a base name
 *   (garment) or an outfit role unless there weren't enough distinct roles
 *   left to fill `limit`, never an excluded piece, never an item confidently
 *   known to be out of stock in the partner's size, and never an item the
 *   partner explicitly said she doesn't want.
 */
export function recommendProducts(quiz, catalogItems, { limit = 3, excludePieceNames = [] } = {}) {
  const excluded = new Set(
    (Array.isArray(excludePieceNames) ? excludePieceNames : [])
      .map((n) => String(n || '').trim().toLowerCase())
      .filter(Boolean)
  )
  const sizesAnswered =
    quiz && quiz.sizes && typeof quiz.sizes === 'object' ? quiz.sizes : {}

  const avoidText = normalizeText(quiz?.avoid)
  const avoidPhrases = avoidText ? candidatePhrases(avoidText.split(' ').filter(Boolean)) : []
  const mentionByItem = new Map()
  if (avoidText) {
    for (const item of Array.isArray(catalogItems) ? catalogItems : []) {
      mentionByItem.set(item, getMentionStatus(item, avoidText, avoidPhrases))
    }
  }
  const mentionOf = (item) => mentionByItem.get(item) || { mentioned: false, negated: false }

  const items = (Array.isArray(catalogItems) ? catalogItems : [])
    .filter((item) => !excluded.has(baseName(item?.title)))
    .filter((item) => !failsSizeFilter(item, sizesAnswered))
    .filter((item) => !mentionOf(item).negated)
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

    return {
      item,
      score,
      index,
      base: baseName(item?.title),
      role: inferOutfitRole(item),
      mentioned: mentionOf(item).mentioned,
    }
  })

  const pool = scored
    .filter((s) => s.item?.available !== false)
    .sort((a, b) => b.score - a.score || a.index - b.index)

  const chosen = []
  const chosenBases = new Set()
  const usedRoles = new Set()

  // Step 0: a piece the partner named explicitly wins a slot first — direct
  // intent is a stronger signal than any inferred fabric/silhouette/palette
  // match, and shouldn't lose out to the outfit-template diversity rule
  // below (e.g. if she named 2 pants and a top, that IS the recommendation
  // — not pants+top+a random dress forced in to "diversify"). Ranked by the
  // same fabric/palette/piece score as a tiebreak among multiple mentions,
  // but never gated by role.
  for (const s of pool) {
    if (chosen.length >= limit) break
    if (!s.mentioned || chosenBases.has(s.base)) continue
    chosen.push(s.item)
    chosenBases.add(s.base)
    usedRoles.add(s.role)
  }

  if (chosen.length >= limit) return chosen

  // Outfit template: outerwear + tops + bottoms (a real jacket/top/bottom
  // look) is the default. If the partner clearly leans toward dresses —
  // they picked 'Dresses' as a silhouette, or their single best-scoring
  // eligible item is a dress — swap to a dress + outerwear pairing instead
  // of forcing a top+bottom split. Whichever roles aren't in the template
  // still get a turn afterward (before any repeat); a role just never
  // crowds out one that's ahead of it in this order.
  const leansDress =
    (Array.isArray(quiz?.silhouettes) && quiz.silhouettes.includes('Dresses')) ||
    pool[0]?.role === 'dress'
  const roleOrder = leansDress
    ? ['dress', 'outerwear', 'tops', 'bottoms']
    : ['outerwear', 'tops', 'bottoms', 'dress']

  // Round 1: one best-scoring item per role, template order — a role with
  // ANY eligible item gets its turn before any role repeats. Skips a role
  // an explicit mention (Step 0) already covered, to preserve outfit
  // coherence around it rather than doubling up on the same role.
  for (const role of roleOrder) {
    if (chosen.length >= limit) break
    if (usedRoles.has(role)) continue
    const best = pool.find((s) => s.role === role && !chosenBases.has(s.base))
    if (!best) continue
    chosen.push(best.item)
    chosenBases.add(best.base)
    usedRoles.add(role)
  }

  if (chosen.length >= limit) return chosen

  // Round 2: still short — repeat a recognized role (best score first)
  // before ever reaching for an item we couldn't confidently classify.
  for (const s of pool) {
    if (chosen.length >= limit) break
    if (s.role === null || chosenBases.has(s.base)) continue
    chosen.push(s.item)
    chosenBases.add(s.base)
  }

  if (chosen.length >= limit) return chosen

  // Round 3: last resort — only unclassifiable items are left, which is the
  // one case they're allowed to fill a slot.
  for (const s of pool) {
    if (chosen.length >= limit) break
    if (chosenBases.has(s.base)) continue
    chosen.push(s.item)
    chosenBases.add(s.base)
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
