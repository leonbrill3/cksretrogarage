// One-time seed: copy content/cars.json + content/agents.json into Postgres.
import { readFileSync } from 'node:fs';
import pg from 'pg';

const env = readFileSync(new URL('../.env.local', import.meta.url), 'utf8');
const cs = (env.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
if (!cs) throw new Error('DATABASE_URL not found in .env.local');

const ssl = /\.render\.com/.test(cs) ? { rejectUnauthorized: false } : undefined;
const pool = new pg.Pool({ connectionString: cs, ssl });

const cars = JSON.parse(readFileSync(new URL('../content/cars.json', import.meta.url), 'utf8'));
const agents = JSON.parse(readFileSync(new URL('../content/agents.json', import.meta.url), 'utf8'));

await pool.query(
  'CREATE TABLE IF NOT EXISTS app_data (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now())',
);
for (const [k, v] of [['cars', cars], ['agents', agents]]) {
  await pool.query(
    'INSERT INTO app_data (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()',
    [k, JSON.stringify(v)],
  );
  console.log('seeded', k, '->', v.length, 'records');
}
const r = await pool.query("SELECT key, jsonb_array_length(value) AS n FROM app_data ORDER BY key");
console.log('verify:', r.rows);
await pool.end();
