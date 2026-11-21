import { describe, expect, it } from 'vitest';
import { deriveKey, fetchVault, open, seal, storeVault, vaultId } from './cloudCrypto';

describe('cloud vault', () => {
  it('encrypts on the device and only the right passphrase opens it', async () => {
    const k = await deriveKey('correct horse battery staple', 1000);
    const sealed = await seal(k, '{"days":{"2026-11-21":{"writing":30}}}');
    expect(sealed.startsWith('v1.')).toBe(true);
    expect(sealed).not.toContain('writing');
    expect(await open(k, sealed)).toContain('"writing":30');
    const wrong = await deriveKey('wrong passphrase', 1000);
    await expect(open(wrong, sealed)).rejects.toBeTruthy();
  });

  it('names the vault by a hash, never the passphrase', async () => {
    const id = await vaultId('correct horse battery staple');
    expect(id).toMatch(/^[0-9a-f]{40}$/);
    expect(await vaultId('correct horse battery staple')).toBe(id);
    expect(await vaultId('another')).not.toBe(id);
  });

  it('talks to Supabase REST', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return { ok: true, status: 200, json: async () => [{ data: 'v1.x', updated_at: 't' }] } as Response;
    }) as unknown as typeof fetch;
    const cfg = { url: 'https://abc.supabase.co/', anonKey: 'anon', passphrase: 'p' };
    expect(await fetchVault(cfg, 'vid', fake)).toEqual({ data: 'v1.x', updated_at: 't' });
    await storeVault(cfg, 'vid', 'v1.y', fake);
    expect(calls[0].url).toBe('https://abc.supabase.co/rest/v1/austin_vault?id=eq.vid&select=data,updated_at');
    expect(calls[1].init?.method).toBe('POST');
    expect((calls[1].init?.headers as Record<string, string>).Prefer).toContain('merge-duplicates');
    expect(JSON.parse(String(calls[1].init?.body))[0]).toMatchObject({ id: 'vid', data: 'v1.y' });
  });
});
