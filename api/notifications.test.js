import { afterEach, describe, expect, it, vi } from 'vitest';
const session=vi.hoisted(()=>({valid:false,walletAddress:'0x'+'1'.repeat(40)}));
vi.mock('./_lib/userSession.js',()=>({USER_SESSION_COOKIE:'session',verifyUserSessionToken:()=>session}));
vi.mock('./_lib/adminAuth.js',()=>({requestIsRecognizedAdmin:()=>false}));
vi.mock('./_lib/orderNotification.js',()=>({readNotificationOrder:vi.fn().mockResolvedValue({id:'one',userWalletAddress:'0x'+'2'.repeat(40)}),notificationForOrder:vi.fn()}));
import handler from './notify-admin.js';
describe('notification access boundary',()=>{
 afterEach(()=>{session.valid=false;vi.unstubAllGlobals();});
 it('rejects unsigned requests without contacting a provider',async()=>{const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const res={setHeader:vi.fn(),end:vi.fn()};await handler({method:'POST',headers:{}},res);expect(res.statusCode).toBe(401);expect(fetch).not.toHaveBeenCalled();});
 it('rejects another wallet’s order before delivering anything',async()=>{session.valid=true;const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const res={setHeader:vi.fn(),end:vi.fn()};await handler({method:'POST',headers:{},[Symbol.asyncIterator]: async function*(){yield Buffer.from(JSON.stringify({orderId:'one',walletAddress:'0x'+'2'.repeat(40),title:'Fake',message:'Marketing'}));}},res);expect(res.statusCode).toBe(403);expect(fetch).not.toHaveBeenCalled();});
});
