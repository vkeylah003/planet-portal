// ════════════════════════════════════════════════════════════════════
// Vercel Serverless Function: GET /api/collection
//
// Proxies PLANET's live "Stylist Collective" Shopify collection feed and
// returns a normalized list of IN-STOCK items for the Partner Catalog.
// Running this server-side (rather than fetching Shopify from the browser)
// keeps the client thin, lets us paginate + normalize in one place, and
// caches at the edge. (Shopify does send `Access-Control-Allow-Origin: *`
// here, so a direct client fetch also works — we proxy for consistency with
// /api/products, server-side normalization, and caching.)
//
// Source feed (paginated):
//   https://shopplanetbylaureng.com/collections/stylist-collective/products.json
//   ?limit=250&page=N  → walk pages until a page returns 0 products.
//
// "In stock" is evaluated at the VARIANT level (variant.available === true):
// a product appears only if it has at least one available variant. Each
// returned item is product-level (one card per product) — the representative
// variant is the first available one, and its price/id/image are used. Sizes
// and colour preferences are captured by the partner's free-text note on
// submit, so we don't explode every size into its own card.
//
// Optional env override: SHOPIFY_COLLECTION_URL (defaults to the PLANET
// Stylist Collective collection).
//
// Response: { items: [{ product_id, title, handle, url, variant_id,
//                       color, product_type, price, image, available,
//                       variant_count, availableSizes }],
//             count }
// availableSizes is every in-stock size for the product (deduped, in Shopify's
// order), derived from a "Size" variant option across ALL available variants
// (not just the representative one). Empty array means the product has no
// "Size" option at all (e.g. one-size accessories) — treat that as "no size
// dimension to filter on", not "nothing in stock".
// ════════════════════════════════════════════════════════════════════

const DEFAULT_FEED =
  'https://shopplanetbylaureng.com/collections/stylist-collective/products.json'
const MAX_PAGES = 20 // safety cap: 20 × 250 = 5,000 products

// Parse a colour label out of a Shopify product/variant. Colour is usually
// either a "Color" option value on the variant, or embedded in the product
// title after the last " - " (e.g. "Sailor Jacket - Blush").
function deriveColor(product, variant) {
  const colorOptIndex = (product.options || []).findIndex(
    (o) => String(o.name).toLowerCase() === 'color'
  )
  if (colorOptIndex >= 0) {
    const val = variant[`option${colorOptIndex + 1}`]
    if (val && val !== 'Default Title') return val
  }
  const title = product.title || ''
  const dash = title.lastIndexOf(' - ')
  if (dash > -1) return title.slice(dash + 3).trim()
  return null
}

// Every in-stock size for a product, deduped, in Shopify's own order.
// Same pattern as deriveColor(), but scans ALL available variants (not just
// one representative) since size varies per-variant, not per-product.
function deriveAvailableSizes(product, availableVariants) {
  const sizeOptIndex = (product.options || []).findIndex(
    (o) => String(o.name).toLowerCase() === 'size'
  )
  if (sizeOptIndex < 0) return []

  const sizes = []
  const seen = new Set()
  for (const v of availableVariants) {
    const val = v[`option${sizeOptIndex + 1}`]
    if (val && val !== 'Default Title' && !seen.has(val)) {
      seen.add(val)
      sizes.push(val)
    }
  }
  return sizes
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const base = (process.env.SHOPIFY_COLLECTION_URL || DEFAULT_FEED).trim()

  try {
    const items = []

    for (let page = 1; page <= MAX_PAGES; page++) {
      const url = `${base}?limit=250&page=${page}`
      const resp = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!resp.ok) {
        const body = (await resp.text().catch(() => '')).slice(0, 300)
        console.error(`Shopify collection feed failed: ${resp.status} ${resp.statusText} — ${body}`)
        return res
          .status(502)
          .json({ error: `Shopify collection feed failed (HTTP ${resp.status})`, detail: body })
      }
      const data = await resp.json()
      const products = Array.isArray(data?.products) ? data.products : []
      if (products.length === 0) break // walked past the last page

      for (const p of products) {
        const variants = Array.isArray(p.variants) ? p.variants : []
        const available = variants.filter((v) => v.available === true)
        if (available.length === 0) continue // no in-stock variant → skip

        // Representative variant + lowest available price for the card.
        const rep = available[0]
        const price = available.reduce(
          (min, v) => Math.min(min, Number(v.price) || Infinity),
          Infinity
        )
        const image =
          rep.featured_image?.src || (p.images && p.images[0]?.src) || null

        items.push({
          product_id: p.id,
          title: p.title,
          handle: p.handle,
          url: `https://shopplanetbylaureng.com/products/${p.handle}`,
          variant_id: rep.id,
          color: deriveColor(p, rep),
          product_type: p.product_type || null, // for catalog search/category
          price: Number.isFinite(price) ? price : Number(rep.price) || 0,
          image,
          available: true,
          variant_count: available.length,
          availableSizes: deriveAvailableSizes(p, available),
        })
      }
    }

    // Cache at the edge for a few minutes — the feed doesn't change by the
    // second and this keeps the catalog snappy without hammering Shopify.
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600')
    return res.status(200).json({ items, count: items.length })
  } catch (err) {
    console.error('Collection proxy error:', err)
    return res
      .status(502)
      .json({ error: 'Collection proxy error', detail: String(err).slice(0, 300) })
  }
}
