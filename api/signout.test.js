import { describe, expect, it, vi } from 'vitest';
vi.mock('@worldcoin/minikit-js',()=>({verifySiweMessage:vi.fn()}));
import handler from './complete-siwe.js';
describe('ending a wallet session',()=>{
 it('expires all session and payment cookies on the current app',async()=>{
  const res={setHeader:vi.fn(),end:vi.fn()};await handler({method:'DELETE',headers:{host:'tcash.test',origin:'https://tcash.test'}},res);
  expect(res.statusCode).toBe(200);const cookies=res.setHeader.mock.calls.find(([k])=>k==='Set-Cookie')[1];expect(cookies).toHaveLength(3);expect(cookies.every(v=>v.includes('Max-Age=0')&&v.includes('HttpOnly'))).toBe(true);
 });
 it('rejects a cross-origin sign-out without expiring cookies',async()=>{
  const res={setHeader:vi.fn(),end:vi.fn()};await handler({method:'DELETE',headers:{host:'tcash.test',origin:'https://elsewhere.test'}},res);
  expect(res.statusCode).toBe(403);expect(res.setHeader.mock.calls.some(([k])=>k==='Set-Cookie')).toBe(false);
 });
});
