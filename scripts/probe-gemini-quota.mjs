// Determines whether several Gemini API keys share one quota pool.
//
// Gemini rate limits are applied per Google Cloud PROJECT, not per key. Keys
// created inside the same AI Studio project therefore share a single quota and
// give no extra daily headroom — which decides whether pooling keys in the
// Edge Function actually buys anything.
//
// Method: burst small text requests on key 1 until it reports 429, then
// immediately try the other keys with a single request each. If they are also
// rate limited, they share a project. Uses tiny text-only prompts so the probe
// costs a negligible amount of quota, and RPM limits reset within a minute.
//
//   node scripts/probe-gemini-quota.mjs <key1> <key2> ...

const keys = process.argv.slice(2);
if (keys.length < 2) {
  console.error('usage: node scripts/probe-gemini-quota.mjs <key1> <key2> [key3...]');
  process.exit(2);
}

const MODEL = process.env.MODEL ?? 'gemini-3-flash-preview';
const URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

const ping = (key) =>
  fetch(URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'hi' }] }],
      generationConfig: { maxOutputTokens: 1, temperature: 0 },
    }),
  }).then(async (r) => ({ status: r.status, body: r.ok ? null : await r.json().catch(() => null) }));

console.log(`model: ${MODEL}`);
console.log(`bursting on key 1 to find the per-minute ceiling...\n`);

let burst = 0;
let limited = false;
let quotaDetail = null;

for (let round = 0; round < 6 && !limited; round += 1) {
  const results = await Promise.all(Array.from({ length: 10 }, () => ping(keys[0])));
  burst += results.length;
  const hit = results.find((r) => r.status === 429);
  if (hit) {
    limited = true;
    quotaDetail = hit.body?.error;
  }
  const codes = [...new Set(results.map((r) => r.status))].join(',');
  console.log(`  round ${round + 1}: ${results.length} requests -> status ${codes}`);
}

if (!limited) {
  console.log(`\nkey 1 absorbed ${burst} requests without a 429 — per-minute ceiling is above that.`);
  console.log('Cannot determine sharing this way without spending more quota. Stopping.');
  process.exit(0);
}

console.log(`\nkey 1 rate limited after ~${burst} requests in a burst.`);
if (quotaDetail) {
  console.log('quota error detail:');
  console.log(JSON.stringify(quotaDetail, null, 2).slice(0, 1500));
}

console.log('\nnow testing the other keys immediately:');
for (let i = 1; i < keys.length; i += 1) {
  const result = await ping(keys[i]);
  const verdict =
    result.status === 429
      ? 'ALSO LIMITED -> shares a quota pool with key 1 (same project)'
      : result.status === 200
        ? 'OK -> independent quota (different project)'
        : `status ${result.status}`;
  console.log(`  key ${i + 1}: ${verdict}`);
}
