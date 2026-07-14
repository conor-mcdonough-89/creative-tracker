#!/usr/bin/env node
/**
 * Supabase connectivity + schema validation.
 *
 * Verifies that the live Supabase project is reachable, that the anon key is
 * valid, and that every table/view the app depends on is present. Useful after
 * unpausing a project to confirm everything came back correctly.
 *
 * Usage:
 *   node scripts/validate-supabase.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local (falling back to the process environment).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(__dirname, '..')

// ---- load .env.local (simple parser, does not override real env vars) --------
function loadEnvLocal() {
  try {
    const raw = readFileSync(join(projectRoot, '.env.local'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq === -1) continue
      const key = trimmed.slice(0, eq).trim()
      let value = trimmed.slice(eq + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }
      if (!(key in process.env)) process.env[key] = value
    }
  } catch {
    // no .env.local — fall back to whatever is already in the environment
  }
}
loadEnvLocal()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const green = (s) => `\x1b[32m${s}\x1b[0m`
const red = (s) => `\x1b[31m${s}\x1b[0m`
const yellow = (s) => `\x1b[33m${s}\x1b[0m`
const dim = (s) => `\x1b[2m${s}\x1b[0m`
const PASS = green('PASS')
const FAIL = red('FAIL')
const WARN = yellow('WARN')

console.log('\nSupabase validation\n' + '='.repeat(50))

// ---- 1. env vars present -----------------------------------------------------
if (!url || !anonKey) {
  console.log(`[${FAIL}] Environment variables`)
  if (!url) console.log('       NEXT_PUBLIC_SUPABASE_URL is not set')
  if (!anonKey) console.log('       NEXT_PUBLIC_SUPABASE_ANON_KEY is not set')
  console.log(
    '\n       Add them to .env.local (see .env.local.example). After unpausing,\n' +
      '       copy the current values from Supabase → Project Settings → API.\n'
  )
  process.exit(1)
}

const host = (() => {
  try {
    return new URL(url).host
  } catch {
    return url
  }
})()
console.log(`[${PASS}] Environment variables present`)
console.log(dim(`       URL:  ${host}`))
console.log(
  dim(
    `       Key:  ${anonKey.slice(0, 6)}…${anonKey.slice(-4)} ` +
      `(${anonKey.startsWith('eyJ') ? 'legacy JWT anon key' : anonKey.startsWith('sb_publishable_') ? 'new publishable key' : 'unrecognized format'})`
  )
)

const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})

// ---- error interpreter -------------------------------------------------------
function interpret(error) {
  const msg = (error?.message || String(error)).toLowerCase()
  const code = error?.code || ''
  if (
    msg.includes('fetch failed') ||
    msg.includes('enotfound') ||
    msg.includes('econnrefused') ||
    msg.includes('timeout') ||
    msg.includes('network')
  ) {
    return 'UNREACHABLE: project not responding. If you just unpaused, restore can take a few minutes — wait and retry. Otherwise confirm the URL and that the project is active in the dashboard.'
  }
  if (msg.includes('invalid api key') || msg.includes('jwt') || code === '401') {
    return 'BAD KEY: the anon key was rejected. Re-copy it from Supabase → Project Settings → API into .env.local AND your Vercel env vars, then redeploy.'
  }
  if (code === '42p01' || code === 'pgrst205' || msg.includes('could not find the table') || msg.includes('does not exist')) {
    return 'MISSING OBJECT: this table/view is not in the database. If you recreated (rather than restored) the project, re-run supabase/schema.sql.'
  }
  return `${code ? `[${code}] ` : ''}${error?.message || error}`
}

// ---- 2. connectivity + key via auth endpoint ---------------------------------
let hardFail = false
try {
  const { error } = await supabase.auth.getUser()
  // "Auth session missing" is expected (no logged-in user) and means the
  // endpoint answered and the key was accepted — that's a success.
  if (error && !/session missing|auth session/i.test(error.message)) {
    console.log(`[${FAIL}] Reachability / API key`)
    console.log('       ' + interpret(error))
    hardFail = true
  } else {
    console.log(`[${PASS}] Project reachable and API key accepted`)
  }
} catch (e) {
  console.log(`[${FAIL}] Reachability / API key`)
  console.log('       ' + interpret(e))
  hardFail = true
}

// ---- 3. schema: probe every table & view the app relies on -------------------
// A head+count select returns no error when the object exists and the key is
// valid. RLS blocking anonymous rows is expected and does NOT error.
const tables = [
  'sports',
  'creators',
  'creator_patterns',
  'column_presets',
  'ad_performance',
  'user_profiles',
  'creator_videos',
  'platform_adjustments',
  'partners',
  'partner_patterns',
  'payouts',
  'import_logs',
  'dismissed_unmapped_ads',
  'manual_ad_links',
  'admin_todos',
]
const views = ['ads_with_creators', 'creator_videos_with_relations', 'ads_with_partners']

async function probe(name) {
  try {
    const { error } = await supabase.from(name).select('*', { count: 'exact', head: true })
    if (error) return { name, ok: false, note: interpret(error) }
    return { name, ok: true }
  } catch (e) {
    return { name, ok: false, note: interpret(e) }
  }
}

if (!hardFail) {
  console.log('\nSchema (' + (tables.length + views.length) + ' objects)\n' + '-'.repeat(50))
  const results = await Promise.all([...tables, ...views].map(probe))
  const failures = results.filter((r) => !r.ok)
  for (const r of results) {
    console.log(`  [${r.ok ? PASS : FAIL}] ${r.name}${r.ok ? '' : '\n        ' + r.note}`)
  }
  console.log('-'.repeat(50))
  if (failures.length === 0) {
    console.log(green(`\nAll checks passed — Supabase is healthy.\n`))
    process.exit(0)
  } else {
    console.log(red(`\n${failures.length} object(s) failed. See notes above.\n`))
    process.exit(1)
  }
} else {
  console.log(
    yellow('\nSkipped schema checks — fix the connection/key issue above first.\n')
  )
  process.exit(1)
}
