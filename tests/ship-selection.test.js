import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { shipSetting, shipResume } from '../src/ship/selection.js';
import { loadPlayableCaravan } from '../src/ship/caravan-asset.js';
import { DevMenu } from '../src/dev-menu.js';

test('ship choice is reversible, shared by the menu and loader, and independent of progress', async () => {
  const kept = new Map([['hiraeth.game.v1', '{"flags":{"prologue.done":true}}']]);
  const before = globalThis.localStorage;
  globalThis.localStorage = { getItem: key => kept.get(key) ?? null, setItem: (key,value) => kept.set(key,value) };
  try {
    assert.equal(shipSetting.get(''), 'caravan');
    const menu = new DevMenu({ doc:null, world: () => ({ ship: { active:'caravan', selected:shipSetting.get('') } }) });
    menu.build();
    const row = menu.tabs.find(t=>t.id==='ship').rows.find(r=>r.act.id==='original');
    menu.act(row.act);
    assert.equal(shipSetting.get(''), 'original');
    let requested = false;
    assert.equal(await loadPlayableCaravan('', { loader:{loadAsync(){requested=true;throw Error('offline');}} }), null);
    assert.equal(requested,false,'original does not depend on the replacement download');
    assert.equal(shipSetting.get('?ship=caravan'),'caravan');
    assert.equal(shipSetting.get('?ship=tripo'),'original','unrecognised study does not erase the retained choice');
    menu.act({do:'ship',id:'caravan'});
    assert.equal(shipSetting.get(''),'caravan');
    assert.equal(kept.get('hiraeth.game.v1'),'{"flags":{"prologue.done":true}}');
    assert.throws(()=>shipSetting.set('missing'),/Unknown ship/);
  } finally { if(before === undefined)delete globalThis.localStorage;else globalThis.localStorage=before; }
});

test('changing hull after saving aboard resumes safely at the new ramp without rewriting the save', () => {
  for (const caravan of [null,{}]) {
    const old = {level:'desert',pos:[2,10,5],heading:1,yaw:2,shipModel:caravan?'original':'caravan',aboardShip:true,hour:12};
    const before = structuredClone(old);
    const ship={caravan,arrivalSpot:()=>({pos:new Vector3(10,2,30),heading:.5})};
    const next=shipResume(old,ship);
    assert.deepEqual(next.pos,[10,2,30]); assert.equal(next.hour,12); assert.equal(next.yaw,.5+Math.PI);
    assert.deepEqual(old,before);
    assert.equal(shipResume({...old,aboardShip:false},ship).pos,old.pos,'outside saves stay put');
    assert.equal(shipResume(next,ship),next,'same hull stays put');
    const legacy={pos:[1,2,3]};assert.equal(shipResume(legacy,ship),legacy);
  }
});
