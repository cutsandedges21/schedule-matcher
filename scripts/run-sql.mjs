// Runs a .sql file against the linked Supabase project via the Management API.
// Avoids needing the database password or a local psql install.
//
//   SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-sql.mjs <ref> <file.sql>
//
// Exits non-zero if the database raises, so it works as a CI gate.

import { readFileSync } from 'node:fs';

const [ref, file] = process.argv.slice(2);
const token = process.env.SUPABASE_ACCESS_TOKEN;

if (!ref || !file || !token) {
  console.error('usage: SUPABASE_ACCESS_TOKEN=sbp_... node scripts/run-sql.mjs <project-ref> <file.sql>');
  process.exit(2);
}

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: readFileSync(file, 'utf8') }),
});

const body = await response.text();

if (!response.ok) {
  console.error(`FAILED (${response.status}):\n${body}`);
  process.exit(1);
}

console.log(`OK (${response.status}): ${body}`);
