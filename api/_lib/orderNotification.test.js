import { describe, expect, it } from 'vitest';
import { notificationForOrder } from './orderNotification.js';
const wallet='0x'+'1'.repeat(40);
describe('functional notification content',()=>{
 it('cannot target an unrelated wallet',()=>expect(notificationForOrder({userWalletAddress:wallet,status:'paid'},'0x'+'2'.repeat(40))).toBeNull());
 it('treats submitted evidence as review rather than settlement',()=>{const notice=notificationForOrder({userWalletAddress:wallet,status:'paid'},wallet);expect(notice.title).toContain('under review');expect(notice.message).toContain('must check');expect(notice.miniAppPath).toBe('/orders');});
 it('does not invent content for unknown states',()=>expect(notificationForOrder({userWalletAddress:wallet,status:'made-up'},wallet)).toBeNull());
});
