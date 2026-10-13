// The see-through surfaces in the Unity bridge (issue #263: the City-Shaft's glass column, an air pillar's body, drawn
// as an opaque white pillar): the rim's cut reaches the port's Surface material (_Veil), the wash over the finished
// picture is mirrored as a drawable of its own on the bridge's Hiraeth/Veil, its alpha live (LightShaft.fade), and the
// shafts' own meshes, which three never draws (visible false), are drawn by nothing (docs/systems/engine-bridge.md,
// "See-through surfaces").
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { portMaterial } from '../engine/unity/port-format.js';
import { UnityBackend } from '../engine/unity/backend.js';
import { SceneMirror } from '../engine/mirror.js';
import { inkSpec } from '../engine/ink-spec.js';
import { OP } from '../engine/unity/pack.js';
import { ShaftPillars, BODY } from '../src/shaft-pillars.js';
import { Veils, LightShaft } from '../src/veil.js';

THREE.ColorManagement.enabled = false;
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

function host() {
  const H = { created: new Map(), materials: new Map(), geometries: [] };
  H.Create = (id, json) => H.created.set(id, JSON.parse(json));
  H.Material = (mid, json) => H.materials.set(mid, JSON.parse(json));
  H.Geometry = (key) => H.geometries.push(key);
  H.Frame = (buf) => { const a = buf.buffer ? buf : new Uint32Array(buf); H.last = new Uint32Array(a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength)); };
  return H;
}

test('an air pillar\'s body: its rim cut on the port\'s Surface, its wash on Hiraeth/Veil (alpha, glow, near, its side)', () => {
  const veils = new Veils();
  const pillars = new ShaftPillars(null, { veils });
  const body = pillars.bodies[0].m;
  const pm = portMaterial(inkSpec(body.material), 1);
  assert.equal(pm.port, undefined, 'the rim stays the port\'s Surface');
  assert.equal(pm.veil, BODY.veil, 'with the cut');
  assert.equal(portMaterial(inkSpec(pillars.rings.material), 2).veil, undefined, 'a surface without one has none');
  const wash = veils.list[0];
  const wm = portMaterial(inkSpec(wash.material), 3);
  assert.equal(wm.port, 'veil');
  assert.equal(wm.alpha, BODY.alpha); assert.equal(wm.glow, BODY.glow); assert.equal(wm.near, BODY.near);
  assert.equal(wm.side, 0, 'the pillars\' washes their front faces only');
  assert.equal(wm.color.length, 3);
  assert.equal(portMaterial(inkSpec(veils.add(body, { color: '#fff' }).material), 4).side, 2, 'both faces by default');
});

test('the mirror draws the washes from the veils\' scene hung in the world, without shadows, the shafts\' own meshes by nothing, the fade live', () => {
  const H = host(), B = new UnityBackend(H);
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera();
  const veils = new Veils();
  const pillars = new ShaftPillars(scene, { veils });
  const shaft = new LightShaft(veils, scene, { color: '#f2c54b', alpha: [0.1, 0.18] });
  shaft.set(new THREE.Vector3(0, 10, 0), 2, new THREE.Vector3(0, 0, 0), 4);
  const mirror = new SceneMirror(B, { castsShadow: () => true });
  // (engine/game.js veilsFrame: the washes' scene in the world, each shown while its mesh is)
  const veilsFrame = () => { if (veils.scene.parent !== scene) scene.add(veils.scene); veils.show(); };
  veilsFrame();
  mirror.sync(scene, camera);
  const nodes = [...H.created.values()];
  const port = (d) => H.materials.get(d.mids[0])?.port;
  const washes = nodes.filter((d) => port(d) === 'veil');
  assert.equal(washes.length, pillars.bodies.length + 2, 'a wash for each pillar\'s body and for each of the shaft\'s two cones');
  assert.ok(washes.every((d) => d.mesh && d.shadow === false), 'drawn, casting no shadow');
  const bodies = nodes.filter((d) => H.materials.get(d.mids[0])?.veil > 0);
  assert.equal(bodies.length, pillars.bodies.length, 'the bodies\' rims, on the port\'s Surface with the cut');
  const cones = nodes.filter((d) => H.materials.get(d.mids[0])?.port === undefined && H.materials.get(d.mids[0])?.veil === undefined && d.mesh === null);
  assert.equal(cones.length, 2, 'the shaft\'s own meshes (visible false): no mesh, nothing drawn (they were opaque white)');
  assert.ok(cones.every((d) => d.shadow === false));
  // a wash hidden with its mesh, as Veils.render does
  pillars.bodies[0].m.visible = false;
  veilsFrame();
  assert.equal(veils.list[0].visible, false);
  pillars.bodies[0].m.visible = true;
  // the shaft faded: its washes' alpha as op 15's glow
  shaft.fade(0.5);
  veilsFrame();
  mirror.sync(scene, camera);
  const u = H.last, f = new Float32Array(u.buffer);
  const alphas = [];
  for (let o = 0; o < u.length - 5; o++) if (u[o] === OP.material && H.materials.get(u[o + 1])?.port === 'veil') alphas.push(+f[o + 5].toFixed(4));
  assert.deepEqual(alphas.sort(), [0.05, 0.09], 'each cone at half its alpha');
});

test('the Unity side: the cut in the full Surface variant (veiled materials take it) and out of the depth prepass, the wash shader included, the bridge\'s material and live alpha', () => {
  const surface = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Surface.shader');
  assert.match(surface, /float _Veil;/, 'in UnityPerMaterial');
  assert.match(surface, /UNITY_BRANCH if \(LEANK && _Veil > 0\.0 && _MSurfaceDebug < 3\.5 && abs\(dot\(normalize\(i\.normal\), normalize\(toThree\(_WorldSpaceCameraPos\) - i\.worldPos\)\)\) > _Veil\) discard;/, 'the web\'s S_VEIL cut, out of the lean variants (a discard there costs every lean surface its early depth test)');
  assert.match(read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs'), /F\(m, "_Veil"\) > 0 \? "veil"/, 'a veiled material on the full variant, as the glass');
  assert.match(surface, /fragEntry\(DepthVaryings i\) \{ if \(_Glass > 0\.0 \|\| _Dissolve\.x > 0\.0 \|\| _Veil > 0\.0\) discard; \}/, 'no depth of a veil in the prepass');
  assert.match(read('unity/Hiraeth/Assets/Hiraeth/Runtime/WorldLoader.cs'), /\("veil", "_Veil"\)/);
  const veil = read('unity/Hiraeth/Assets/Hiraeth/Shaders/Veil.shader');
  assert.match(veil, /Shader "Hiraeth\/Veil"/);
  assert.match(veil, /if \(scene > 0\.0 && scene < i\.d \+ 0\.08\) discard;/, 'tested against the G-buffer\'s depth as the web\'s (VEIL.depthEps)');
  assert.match(veil, /"Queue" = "Transparent\+30"/, 'over the ink composite');
  const guid = /guid: ([0-9a-f]{32})/.exec(read('unity/Hiraeth/Assets/Hiraeth/Shaders/Veil.shader.meta'))[1];
  assert.ok(read('unity/Hiraeth/ProjectSettings/GraphicsSettings.asset').includes(`guid: ${guid}, type: 3}`), 'always included: Shader.Find finds it in a player');
  const br = read('unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeRenderer.cs');
  assert.match(br, /m\.S\("port"\) == "veil"/);
  assert.match(br, /m\.HasProperty\("_WashAlpha"\)\) m\.SetFloat\("_WashAlpha", lg\)/, 'op 15\'s glow is a wash\'s alpha');
  assert.match(read('engine/game.js'), /veilsFrame\(\);\n\s+const stats = mirror\.sync\(scene, camera\);/);
});
