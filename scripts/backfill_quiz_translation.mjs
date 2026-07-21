// Backfill the PLANET "translation" onto existing style-quiz selections.
//
// The admin dashboard computes the translation LIVE at render time, so no quiz
// is ever visually blank. This script additionally STAMPS a copy of the
// translation onto each historical style_quiz row (items[0].translation) so the
// stored data itself carries the PLANET read — useful for exports / any future
// consumer, and so historical records aren't blank at the data layer.
//
// Uses the SAME map as the app (src/lib/quizTranslation.js) — one source of truth.
//
// Run from repo root:
//   node scripts/backfill_quiz_translation.mjs            # apply
//   DRY_RUN=true node scripts/backfill_quiz_translation.mjs # preview, write nothing
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { translateQuiz } from '../src/lib/quizTranslation.js'

const parse = (p) =>
  Object.fromEntries(
    readFileSync(p, 'utf8')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('#'))
      .map((l) => {
        const i = l.indexOf('=')
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')]
      })
  )
const env = { ...parse('.env/.env'), ...parse('.env.local') }
const DRY_RUN = String(env.DRY_RUN || process.env.DRY_RUN || '').toLowerCase() === 'true'

const db = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data, error } = await db
  .from('partner_selections')
  .select('id,partner_name,partner_email,items')
if (error) {
  console.error('Load failed:', error.message)
  process.exit(1)
}

const quizzes = (data || []).filter(
  (s) => Array.isArray(s.items) && s.items[0]?.kind === 'style_quiz'
)
console.log(`Found ${quizzes.length} style-quiz selection(s)${DRY_RUN ? ' (DRY RUN)' : ''}.\n`)

let updated = 0
for (const s of quizzes) {
  const quiz = s.items[0]
  const translation = translateQuiz(quiz)
  // Stamp translation onto the payload (replace any prior stamp so refinements
  // to the map re-flow into the stored data too).
  const newItems = [{ ...quiz, translation }, ...s.items.slice(1)]

  console.log(`• ${s.partner_name || s.partner_email} [${s.id}]`)
  console.log(`    ${translation.summary || '(no answers to translate)'}`)
  if (translation.ambiguous.length) {
    for (const a of translation.ambiguous) console.log(`    ⚠ ${a}`)
  }

  if (!DRY_RUN) {
    const { error: upErr } = await db
      .from('partner_selections')
      .update({ items: newItems })
      .eq('id', s.id)
    if (upErr) {
      console.error(`    ✗ update failed: ${upErr.message}`)
      continue
    }
    updated++
  }
}

console.log(
  `\n${DRY_RUN ? 'Would update' : 'Updated'} ${DRY_RUN ? quizzes.length : updated} row(s).`
)
process.exit(0)
