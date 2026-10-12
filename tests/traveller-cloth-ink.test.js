import test from 'node:test';
import assert from 'node:assert/strict';
import {loadClothInk} from '../src/characters/traveller-cloth-ink.js';

test('native engine loading skips browser-only ink masks instead of waiting forever for a stub image',async t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'location');
 Object.defineProperty(globalThis,'location',{configurable:true,value:{protocol:'engine:'}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'location',previous);else delete globalThis.location;});
 // No document/Image implementation is installed: either mask must resolve without requesting one.
 assert.equal(await loadClothInk('characters/traveller-v1/cloth-ink.png'),null);
 assert.equal(await loadClothInk('characters/traveller-v1/head-v3/hair-ink.png'),null);
});
