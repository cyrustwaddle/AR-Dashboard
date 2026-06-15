#!/usr/bin/env node
// Generates a long-lived JWT for the ben_viewer PostgreSQL role.
// Set the output as VITE_BEN_SUPABASE_ANON_KEY in the Ben Vercel project.
//
// Usage:
//   node scripts/gen_ben_jwt.mjs <SUPABASE_JWT_SECRET>
//
// Find your JWT secret at:
//   Supabase dashboard → Settings → API → JWT Secret
//
// The resulting JWT grants read-only access to ben_pipeline_view and
// ben_onboarding_view only. Direct queries to artists/onboarding tables
// are blocked at the database level.

import crypto from 'crypto'

const secret = process.argv[2]
if (!secret) {
  console.error('Error: JWT secret required.')
  console.error('Usage: node scripts/gen_ben_jwt.mjs <SUPABASE_JWT_SECRET>')
  console.error('\nFind it at: Supabase dashboard → Settings → API → JWT Secret')
  process.exit(1)
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url')
}

const header = { alg: 'HS256', typ: 'JWT' }
const now = Math.floor(Date.now() / 1000)
const payload = {
  role: 'ben_viewer',
  iss: 'supabase',
  iat: now,
  exp: now + (10 * 365 * 24 * 60 * 60), // 10 years
}

const signingInput = `${b64url(header)}.${b64url(payload)}`
const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url')
const jwt = `${signingInput}.${signature}`

const expDate = new Date((payload.exp) * 1000).toISOString().split('T')[0]

console.log('\n--- Ben viewer JWT ---')
console.log(jwt)
console.log(`\nRole:    ben_viewer`)
console.log(`Expires: ${expDate}`)
console.log('\nNext steps:')
console.log('1. Set VITE_BEN_SUPABASE_ANON_KEY to the token above in the Ben Vercel project.')
console.log('2. Verify access:')
console.log(`   # Should return [] (no policy for ben_viewer on raw table)`)
console.log(`   curl "$SUPABASE_URL/rest/v1/artists?select=id,artist_name,notes" \\`)
console.log(`     -H "apikey: <jwt>" -H "Authorization: Bearer <jwt>"`)
console.log(`   # Should return filtered artist rows`)
console.log(`   curl "$SUPABASE_URL/rest/v1/ben_pipeline_view?select=id,artist_name" \\`)
console.log(`     -H "apikey: <jwt>" -H "Authorization: Bearer <jwt>"`)
