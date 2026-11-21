/**
 * End-to-end encryption for cloud sync. Everything is encrypted on the device with a key made
 * from the passphrase; the cloud only ever stores ciphertext. Same passphrase → same vault on
 * every device. Uses WebCrypto only (works in browsers and in Node for tests).
 */

const enc = new TextEncoder();
const dec = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

const toB64 = (b: Uint8Array) => { let s = ''; for (const x of b) s += String.fromCharCode(x); return btoa(s); };
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** Which vault this passphrase opens: a one-way hash, so the cloud never learns the passphrase. */
export async function vaultId(passphrase: string): Promise<string> {
  return hex(await subtle().digest('SHA-256', enc.encode(`austin-os|vault|${passphrase}`))).slice(0, 40);
}

export async function deriveKey(passphrase: string, iterations = 310_000): Promise<CryptoKey> {
  const base = await subtle().importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return subtle().deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: enc.encode('austin-os|salt|v1'), iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function seal(key: CryptoKey, text: string): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, enc.encode(text)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return `v1.${toB64(out)}`;
}

/** Throws if the passphrase is wrong or the data was tampered with. */
export async function open(key: CryptoKey, sealed: string): Promise<string> {
  if (!sealed.startsWith('v1.')) throw new Error('Not an Austin OS vault.');
  const raw = fromB64(sealed.slice(3));
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, key, raw.slice(12));
  return dec.decode(pt);
}

/** The table to create once in Supabase (SQL editor). Rows hold only ciphertext. */
export const SETUP_SQL = `create table if not exists austin_vault (
  id text primary key,
  data text not null,
  updated_at timestamptz not null default now()
);
alter table austin_vault enable row level security;
create policy "encrypted vaults" on austin_vault for all using (true) with check (true);`;

export interface CloudConfig { url: string; anonKey: string; passphrase: string }

/** Read this vault's row. null when it doesn't exist yet. */
export async function fetchVault(cfg: CloudConfig, id: string, f: typeof fetch = fetch): Promise<{ data: string; updated_at: string } | null> {
  const r = await f(`${cfg.url.replace(/\/$/, '')}/rest/v1/austin_vault?id=eq.${id}&select=data,updated_at`, {
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}` },
  });
  if (!r.ok) throw new Error(`Cloud read failed (${r.status}). Check the project URL, key and that the table exists.`);
  const rows = (await r.json()) as { data: string; updated_at: string }[];
  return rows[0] ?? null;
}

export async function storeVault(cfg: CloudConfig, id: string, data: string, f: typeof fetch = fetch): Promise<void> {
  const r = await f(`${cfg.url.replace(/\/$/, '')}/rest/v1/austin_vault`, {
    method: 'POST',
    headers: { apikey: cfg.anonKey, Authorization: `Bearer ${cfg.anonKey}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id, data, updated_at: new Date().toISOString() }]),
  });
  if (!r.ok) throw new Error(`Cloud write failed (${r.status}).`);
}
