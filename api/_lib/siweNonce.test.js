import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignedServerNonce, isValidSignedServerNonce, claimSiweNonce } from './world.js';
describe('short-lived one-time wallet challenges',()=>{
 beforeEach(()=>{vi.stubEnv('SIWE_NONCE_SECRET','nonce-test-secret');vi.useFakeTimers();vi.setSystemTime(new Date('2026-10-07T12:00:00Z'));});
 afterEach(()=>{vi.useRealTimers();vi.unstubAllEnvs();vi.unstubAllGlobals();});
 it('accepts a fresh challenge and rejects tampering',()=>{const n=createSignedServerNonce();expect(isValidSignedServerNonce(n.nonce,n.nonceSignature)).toBe(true);expect(isValidSignedServerNonce(n.nonce+'x',n.nonceSignature)).toBe(false);});
 it('expires the challenge after ten minutes',()=>{const n=createSignedServerNonce();vi.advanceTimersByTime(600000);expect(isValidSignedServerNonce(n.nonce,n.nonceSignature)).toBe(false);});
 it('rejects future-dated challenges and old signature formats',()=>{const n=createSignedServerNonce();vi.setSystemTime(new Date('2026-10-07T11:59:00Z'));expect(isValidSignedServerNonce(n.nonce,n.nonceSignature)).toBe(false);expect(isValidSignedServerNonce(n.nonce,n.nonceSignature.split('.')[1])).toBe(false);});
 it('never signs with a public application ID as a fallback secret',()=>{vi.stubEnv('SIWE_NONCE_SECRET','');vi.stubEnv('ADMIN_SESSION_SECRET','');vi.stubEnv('DEV_PORTAL_API_KEY','');expect(()=>createSignedServerNonce()).toThrow('not configured');});
 it('claims a nonce atomically once across requests',async()=>{vi.stubEnv('UPSTASH_REDIS_REST_URL','https://redis.test');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','test');const used=new Set();const fetch=vi.fn(async(_url,options)=>{const command=JSON.parse(options.body);expect(command.slice(3)).toEqual(['NX','EX','600']);const first=!used.has(command[1]);used.add(command[1]);return {ok:true,json:async()=>({result:first?'OK':null})};});vi.stubGlobal('fetch',fetch);expect(await claimSiweNonce('nonce-one')).toBe(true);expect(await claimSiweNonce('nonce-one')).toBe(false);});
 it('fails closed if the nonce store is unavailable',async()=>{vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('KV_REST_API_URL','');await expect(claimSiweNonce('nonce-one')).rejects.toThrow('unavailable');});
});
