// Supermarket-deals refresh job. See docs/DEALS.md.
//
// Downloads the КЗП "Колко струва" open-data archive (one ZIP per day, one CSV
// per retail chain), keeps our five chains, collapses each to one row per
// product and replaces that chain's rows in Supabase via replace_deal_prices().
//
// Runs from GitHub Actions (.github/workflows/deals-ingest.yml) — on demand while
// the app is in development. Does nothing while the deals switch is off.
//
// Local run (needs Node 22.18+ for TypeScript type stripping):
//   pnpm deals:ingest                    # newest archive (yesterday, else the day before…)
//   DEALS_DATE=2026-10-11 pnpm deals:ingest
//   pnpm deals:ingest --dry-run          # download + parse only; never touches Supabase
// Env: SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL from .env) + SUPABASE_SERVICE_ROLE_KEY.

import { Buffer } from 'node:buffer';
import process from 'node:process';
import { TextDecoder } from 'node:util';
import { inflateRawSync } from 'node:zlib';

import { CHAINS } from '../chains.ts';
import { isImportedGroup } from '../groups.ts';
import { collapseChain, parseCsv } from './kolkostruva.ts';

const SOURCE = 'https://www.kolkostruva.bg/opendata_files';
const USER_AGENT = 'couples-budget-deals/1.0 (daily price refresh)';
// A chain file with fewer products than this is treated as broken, and that
// chain's existing prices are kept rather than wiped.
const MIN_PRODUCTS = 50;

const supabaseUrl = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const dryRun = process.argv.includes('--dry-run');

// ---- ZIP reading (stored + deflate entries; enough for the КЗП archive) ----

function readZipEntries(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('The download is not a ZIP archive.');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const entries = [];
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Corrupt ZIP directory.');
    const nameLength = buf.readUInt16LE(p + 28);
    entries.push({
      name: buf.toString('utf8', p + 46, p + 46 + nameLength),
      method: buf.readUInt16LE(p + 10),
      compressedSize: buf.readUInt32LE(p + 20),
      localHeader: buf.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
  }
  return entries;
}

function readZipEntry(buf, entry) {
  const h = entry.localHeader;
  const start = h + 30 + buf.readUInt16LE(h + 26) + buf.readUInt16LE(h + 28);
  const data = buf.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return data;
  if (entry.method === 8) return inflateRawSync(data);
  throw new Error(`Unsupported ZIP compression method ${entry.method} in ${entry.name}.`);
}

// ---- helpers ----------------------------------------------------------------

/** YYYY-MM-DD in Sofia, `daysAgo` days back. */
function sofiaDate(daysAgo) {
  const d = new Date(Date.now() - daysAgo * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Sofia',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function rest(path, init = {}) {
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
}

async function dealsSwitchedOn() {
  const res = await rest('feature_flags?key=eq.deals&select=enabled');
  if (!res.ok) throw new Error(`Could not read the deals switch: HTTP ${res.status} ${await res.text()}`);
  const rows = await res.json();
  return rows[0]?.enabled === true;
}

async function downloadArchive(dates) {
  for (const date of dates) {
    const res = await fetch(`${SOURCE}/${date}.zip`, { headers: { 'User-Agent': USER_AGENT } });
    if (res.ok) return { date, buf: Buffer.from(await res.arrayBuffer()) };
    console.log(`No archive for ${date} (HTTP ${res.status}).`);
  }
  throw new Error(`No КЗП archive found for ${dates.join(', ')}.`);
}

// ---- main -------------------------------------------------------------------

async function main() {
  if (dryRun) console.log('Dry run — nothing will be written to Supabase.');
  else if (!supabaseUrl || !serviceKey) {
    throw new Error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (GitHub secrets, or .env locally).');
  } else if (!(await dealsSwitchedOn())) {
    console.log('Deals are switched off (feature_flags "deals" = false) — nothing to do.');
    return;
  }

  const wanted = process.env.DEALS_DATE?.trim();
  if (wanted && !/^\d{4}-\d{2}-\d{2}$/.test(wanted)) throw new Error(`DEALS_DATE must be YYYY-MM-DD, got "${wanted}".`);
  // Chains report each morning, so the newest archive is usually yesterday's.
  const { date, buf } = await downloadArchive(wanted ? [wanted] : [1, 2, 3].map(sofiaDate));
  console.log(`Archive ${date}: ${(buf.length / 1e6).toFixed(1)} MB`);

  const entries = readZipEntries(buf);
  const decoder = new TextDecoder('utf-8');
  let updated = 0;
  for (const chain of CHAINS) {
    const entry = entries.find((e) => e.name.endsWith(`_${chain.eik}.csv`));
    if (!entry) {
      console.warn(`${chain.name}: not in the ${date} archive — keeping its existing prices.`);
      continue;
    }
    const products = collapseChain(parseCsv(decoder.decode(readZipEntry(buf, entry))), isImportedGroup);
    if (products.length < MIN_PRODUCTS) {
      console.warn(`${chain.name}: only ${products.length} products — looks broken, keeping existing prices.`);
      continue;
    }
    const onPromo = products.filter((p) => p.promo_price != null).length;
    if (dryRun) {
      console.log(`${chain.name}: ${products.length} products (${onPromo} with a promo) — not uploaded.`);
      updated++;
      continue;
    }
    const res = await rest('rpc/replace_deal_prices', {
      method: 'POST',
      body: JSON.stringify({ p_chain: chain.id, p_price_date: date, p_rows: products }),
    });
    if (!res.ok) {
      console.error(`${chain.name}: upload failed — HTTP ${res.status} ${await res.text()}`);
      continue;
    }
    console.log(`${chain.name}: ${await res.json()} products (${onPromo} with a promo) for ${date}.`);
    updated++;
  }
  if (updated === 0) throw new Error('No chain was updated.');
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
