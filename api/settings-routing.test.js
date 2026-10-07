import { describe, expect, it } from 'vitest';
import { sanitizeSettingsPayload } from './settings.js';
describe('live routing validation',()=>{
 it.each([{sellWalletAddress:'0xRecipientWallet'},{supportEmail:'a@'},{mpesaPaybillNumber:'ABC123'},{feeKesPerCoin:{BTC:4}}])('rejects malformed routing or unsupported fees %j',value=>expect(()=>sanitizeSettingsPayload(value)).toThrow());
 it('accepts a complete receiving address and support email',()=>expect(sanitizeSettingsPayload({sellWalletAddress:'0x'+'1'.repeat(40),supportEmail:'help@example.com'})).toEqual({sellWalletAddress:'0x'+'1'.repeat(40),supportEmail:'help@example.com'}));
});
