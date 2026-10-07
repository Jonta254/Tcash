import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { loginWithWorldApp, logoutUser } from './authService';
import { STORAGE_KEYS } from '../config/appConfig';
describe('wallet account isolation',()=>{
 let values;
 beforeEach(()=>{values=new Map();vi.stubGlobal('localStorage',{getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)});});
 afterEach(()=>vi.unstubAllGlobals());
 it('does not inherit another wallet profile with the same username',()=>{
  values.set(STORAGE_KEYS.users,JSON.stringify([{id:'other',walletAddress:'0x'+'1'.repeat(40),username:'amina',mpesaPhoneNumber:'0712345678',isAdmin:true}]));
  const user=loginWithWorldApp({walletAddress:'0x'+'2'.repeat(40),username:'amina'});
  expect(user.id).not.toBe('other');expect(user.mpesaPhoneNumber).toBe('');expect(user.isAdmin).toBe(false);
 });
 it('keeps preferences for the returning wallet',()=>{
  values.set(STORAGE_KEYS.users,JSON.stringify([{id:'own',walletAddress:'0x'+'1'.repeat(40),username:'old',mpesaPhoneNumber:'0712345678'}]));
  const user=loginWithWorldApp({walletAddress:'0x'+'1'.repeat(40),username:'new'});
  expect(user.id).toBe('own');expect(user.mpesaPhoneNumber).toBe('0712345678');
 });
 it('clears the local session after the server acknowledges sign-out',async()=>{
  values.set(STORAGE_KEYS.currentUser,'{"id":"own"}');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true}));await logoutUser();expect(values.has(STORAGE_KEYS.currentUser)).toBe(false);
 });
 it('keeps the local session and surfaces failure if server sign-out fails',async()=>{
  values.set(STORAGE_KEYS.currentUser,'{"id":"own"}');vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));await expect(logoutUser()).rejects.toThrow('Could not end');expect(values.has(STORAGE_KEYS.currentUser)).toBe(true);
 });
});
