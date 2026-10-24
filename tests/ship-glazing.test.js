import test from 'node:test';
import { readFileSync } from 'node:fs';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Veils } from '../src/veil.js';
import { inkSpec } from '../engine/ink-spec.js';
import { portMaterial } from '../engine/unity/port-format.js';
import { Ship } from '../src/ship/ship.js';
import { Physics } from '../src/physics.js';
import { paneCues, isCaravanPane, addPaneCues, bindPaneWashes, GLAZING } from '../src/ship/glazing.js';

test('pane cues preserve source geometry, face inward and leave the centre clear', () => {
  const pane = new THREE.PlaneGeometry(4, 3);
  const source = Array.from(pane.attributes.position.array);
  const cues = paneCues(pane), p = cues.attributes.position, n = cues.attributes.normal;
  assert.ok(p.count > 0);
  assert.deepEqual(Array.from(pane.attributes.position.array), source);
  let area = 0;
  for (let i = 0; i < p.count; i++) {
    assert.ok(n.getZ(i) < -.99, 'inward face only');
    assert.ok(Math.abs(p.getX(i)) > 1.7 || Math.abs(p.getY(i)) > 1.2, 'clear central sightline');
  }
  for (let i = 0; i < p.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(p,i), b = new THREE.Vector3().fromBufferAttribute(p,i+1), c = new THREE.Vector3().fromBufferAttribute(p,i+2);
    area += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  assert.ok(area < 12 * .08, 'less than 8% opaque reflection coverage; wash remains translucent');
  pane.dispose(); cues.dispose();
});

test('glazing never labels arbitrary dark or unsplit materials as cockpit glass', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const cockpit = new THREE.Group(); cockpit.name = 'cockpit'; cockpit.add(mesh);
  assert.equal(isCaravanPane(mesh,{name:'dark'}), false);
  assert.equal(isCaravanPane(mesh,{name:'viewGlass'}), true);
  mesh.material = [{name:'viewGlass'},{name:'dark'}];
  assert.equal(isCaravanPane(mesh,{name:'viewGlass'}), false);
});

test('interior cues are non-colliding and excluded from the shared shadow path', () => {
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(4,3));
  const cue = addPaneCues(pane);
  assert.equal(cue.parent,pane);
  assert.equal(cue.userData.noCollide,true);
  assert.equal(cue.userData.castShadow,false);
  assert.equal(cue.castShadow,false);
  assert.equal(cue.material.side,THREE.FrontSide);
  cue.geometry.dispose(); pane.geometry.dispose();
});


test('committed authored cockpit and saloon both yield nonempty inward pane cues', async () => {
  const bytes = readFileSync(new URL('../public/models/ships/caravan-a/playable.glb', import.meta.url));
  const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const panes = [];
  scene.traverse(node => {
    if (!node.isMesh || Array.isArray(node.material)) return;
    if (isCaravanPane(node, node.material)) panes.push(node);
    else if (node.material.name === 'dark') assert.equal(isCaravanPane(node,node.material),false);
  });
  assert.equal(panes.length,2,'exactly the actual windshield and saloon glazing');
  assert.deepEqual(panes.map(p => p.material.name).sort(),['dark','viewGlass']);
  for (const pane of panes) {
    const source = Array.from(pane.geometry.attributes.position.array);
    const indices = Array.from(pane.geometry.index.array);
    const cues = paneCues(pane.geometry);
    assert.ok(cues.attributes.position.count >= 24, `${pane.material.name}: real perimeter recovered`);
    assert.ok(cues.attributes.position.count < 3000, `${pane.material.name}: bounded cue mesh`);
    assert.ok(Array.from(cues.attributes.position.array).every(Number.isFinite));
    assert.deepEqual(Array.from(pane.geometry.attributes.position.array),source);
    assert.deepEqual(Array.from(pane.geometry.index.array),indices);
    // These explicit panes face outward. Each inward cue normal must oppose
    // the nearest original surface normal, including the curved windshield.
    const cp = cues.attributes.position, cn = cues.attributes.normal;
    const pp = pane.geometry.attributes.position, pn = pane.geometry.attributes.normal;
    for (let i=0;i<cp.count;i++) {
      const p = new THREE.Vector3().fromBufferAttribute(cp,i);
      let nearest=0, distance=Infinity;
      for (let j=0;j<pp.count;j++) {
        const d=p.distanceToSquared(new THREE.Vector3().fromBufferAttribute(pp,j));
        if(d<distance){distance=d;nearest=j;}
      }
      assert.ok(new THREE.Vector3().fromBufferAttribute(cn,i).dot(new THREE.Vector3().fromBufferAttribute(pn,nearest)) < -.85, `${pane.material.name}: inward surface`);
    }
    cues.dispose();
  }
  scene.traverse(node => { if(node.isMesh) node.geometry.dispose(); });
});


test('pane wash uses the existing native translucent port, tracks rotated parents and disposes once', () => {
  const veils = new Veils(), scene = new THREE.Scene(), parent = new THREE.Group();
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(4,3));
  scene.add(parent); parent.add(pane); pane.position.set(2,1,-4);
  const binding = bindPaneWashes(veils,[pane,pane]);
  assert.equal(veils.list.length,1,'one wash per actual pane');
  const wash = binding.entries[0].wash;
  const spec = portMaterial(inkSpec(wash.material));
  assert.equal(spec.port,'veil'); assert.equal(spec.alpha,.12); assert.equal(spec.side,THREE.BackSide);
  assert.equal(wash.material.depthWrite,false); assert.equal(wash.material.transparent,true);
  for (let i=0;i<3;i++) {
    parent.position.set(i*8,3-i,11); parent.rotation.set(.2*i,.7*i,-.3*i); parent.scale.setScalar(1+i*.1);
    binding.sync();
    assert.deepEqual(wash.matrixWorld.elements,pane.matrixWorld.elements,'wash follows actual arbitrary ship transform');
    assert.equal(veils.list.length,1,'no per-frame registrations');
  }
  parent.visible=false; veils.show(); assert.equal(wash.visible,false,'ancestor culling hides wash');
  parent.visible=true; veils.show(); assert.equal(wash.visible,true);
  let releases=0;wash.material.addEventListener('dispose',()=>releases++);
  binding.dispose();binding.dispose();binding.sync();
  assert.equal(veils.list.length,0);assert.equal(wash.parent,null);assert.equal(releases,1);
  pane.geometry.dispose();pane.material.dispose();
});

test('saloon reflection begins beyond the actual authored jamb overlap', () => {
  // The committed source frame is .12 author units wide, centred on the pane edge.
  assert.ok(GLAZING.inset > .12/2 + GLAZING.width,'reflection is visibly inside aperture, not below jamb');
});

test('parked and orbital copies register on the live level and orbital removal cannot leak washes', () => {
  const scene = new THREE.Scene(), ground = new THREE.Mesh(new THREE.PlaneGeometry(400,400).rotateX(-Math.PI/2));scene.add(ground);
  const physics = new Physics(scene), level = {spawn:new THREE.Vector3(0,0,60),ground:{heightAt:()=>0},lights:[],shipSite:{x:0,z:0,heading:Math.PI/2}};
  const warn=console.warn;let ship;try{console.warn=()=>{};ship=new Ship({scene,physics,level,levelId:'test',content:{npcs:[],relics:{spots:[]}}});}finally{console.warn=warn;}
  assert.ok(level.veils instanceof Veils);const parked=level.veils.list.length;assert.ok(parked>0);
  for(let i=0;i<2;i++) {
    ship.buildSpaceCopy();assert.equal(level.veils.list.length,parked*2);
    ship.removeSpaceCopy();assert.equal(level.veils.list.length,parked,'removed orbital copy releases its wash');
  }
  ship.parked.disposeAuthored();assert.equal(level.veils.list.length,0);
});
