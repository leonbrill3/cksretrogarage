// Postgres-backed data store for cars + agents. The admin writes here and every
// page reads from here at request time — so changes are instant, no redeploys.
// Falls back to the bundled JSON on read if the DB is ever unreachable.

import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import bundledCars from '../../content/cars.json';
import bundledAgents from '../../content/agents.json';
import type { Car } from '@/data/cars';
import type { Agent } from '@/data/agents';
import type { InventoryRecord } from '@/data/inventory';
import type { Campaign, CampaignFind, CampaignRun } from '@/data/campaigns';

function makePool(): Pool | null {
  const cs = process.env.DATABASE_URL;
  if (!cs) return null;
  // External Render hosts require SSL; internal in-network hosts don't.
  const ssl = /\.render\.com/.test(cs) ? { rejectUnauthorized: false } : undefined;
  return new Pool({ connectionString: cs, ssl, max: 3, idleTimeoutMillis: 30000, connectionTimeoutMillis: 8000 });
}

// Reuse one pool across hot-reloads / invocations.
const g = globalThis as unknown as { __cksPool?: Pool | null };
const pool: Pool | null = g.__cksPool ?? (g.__cksPool = makePool());

let schemaReady = false;
async function ensureSchema() {
  if (!pool || schemaReady) return;
  await pool.query(
    'CREATE TABLE IF NOT EXISTS app_data (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz DEFAULT now())',
  );
  await pool.query(
    'CREATE TABLE IF NOT EXISTS media (id text PRIMARY KEY, content_type text NOT NULL, bytes bytea NOT NULL, created_at timestamptz DEFAULT now())',
  );
  schemaReady = true;
}

async function getCollection<T>(key: string, fallback: T): Promise<T> {
  // Never touch the DB during the build — the internal host isn't reachable then.
  if (!pool || process.env.NEXT_PHASE === 'phase-production-build') return fallback;
  try {
    await ensureSchema();
    const r = await pool.query('SELECT value FROM app_data WHERE key = $1', [key]);
    if (r.rows.length) return r.rows[0].value as T;
    // First run: seed the table from the bundled snapshot.
    await setCollection(key, fallback);
    return fallback;
  } catch (e) {
    console.error('[store] read failed for', key, e);
    return fallback;
  }
}

async function setCollection<T>(key: string, value: T): Promise<void> {
  if (!pool) throw new Error('DATABASE_URL not configured');
  await ensureSchema();
  await pool.query(
    'INSERT INTO app_data (key, value, updated_at) VALUES ($1, $2::jsonb, now()) ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = now()',
    [key, JSON.stringify(value)],
  );
}

export function dbConfigured(): boolean {
  return !!pool;
}

export async function getCars(): Promise<Car[]> {
  return getCollection<Car[]>('cars', bundledCars as Car[]);
}
export async function saveCars(cars: Car[]): Promise<void> {
  return setCollection('cars', cars);
}
export async function getAgents(): Promise<Agent[]> {
  return getCollection<Agent[]>('agents', bundledAgents as Agent[]);
}
export async function saveAgents(agents: Agent[]): Promise<void> {
  return setCollection('agents', agents);
}

// Internal buy/sell ledger (confidential). No bundled seed — starts empty.
export async function getInventory(): Promise<InventoryRecord[]> {
  return getCollection<InventoryRecord[]>('inventory', []);
}
export async function saveInventory(records: InventoryRecord[]): Promise<void> {
  return setCollection('inventory', records);
}

// ----- Sourcing campaigns (saved searches that hunt live inventory) -----
export async function getCampaigns(): Promise<Campaign[]> {
  return getCollection<Campaign[]>('campaigns', []);
}
export async function saveCampaigns(rows: Campaign[]): Promise<void> {
  return setCollection('campaigns', rows);
}
export async function getCampaignFinds(): Promise<CampaignFind[]> {
  return getCollection<CampaignFind[]>('campaign_finds', []);
}
export async function saveCampaignFinds(rows: CampaignFind[]): Promise<void> {
  return setCollection('campaign_finds', rows);
}
export async function getCampaignRuns(): Promise<CampaignRun[]> {
  return getCollection<CampaignRun[]>('campaign_runs', []);
}
export async function saveCampaignRuns(rows: CampaignRun[]): Promise<void> {
  return setCollection('campaign_runs', rows);
}

// ----- Media (images) stored in the DB, served via /api/media/[id] -----
export async function putMedia(contentType: string, bytes: Buffer): Promise<string> {
  if (!pool) throw new Error('DATABASE_URL not configured');
  await ensureSchema();
  const id = randomUUID().replace(/-/g, '');
  await pool.query('INSERT INTO media (id, content_type, bytes) VALUES ($1, $2, $3)', [id, contentType, bytes]);
  return id;
}

export async function getMedia(id: string): Promise<{ contentType: string; bytes: Buffer } | null> {
  if (!pool) return null;
  try {
    await ensureSchema();
    const r = await pool.query('SELECT content_type, bytes FROM media WHERE id = $1', [id]);
    if (!r.rows.length) return null;
    return { contentType: r.rows[0].content_type, bytes: r.rows[0].bytes as Buffer };
  } catch (e) {
    console.error('[store] media read failed', id, e);
    return null;
  }
}
