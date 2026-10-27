// The stamina wheel (issue #710): an enamel ring with nothing in its middle, the same numbers on the page and in Unity.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { STAMINA_RING as R, staminaSvg, ENAMEL } from '../src/hud-look.js';
import { STAMINA_POSE, UI_PIECES } from '../engine/ui-poses.js';

const circles = (svg) => [...svg.matchAll(/<circle([^>]*)\/>/g)].map(([, a]) => Object.fromEntries([...a.matchAll(/([\w-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v])));

/** The alpha the SVG paints at a distance d from the centre (its circles' fills and strokes, as drawn, 0..1). */
function alphaAt(svg, d) {
  let a = 0;
  for (const c of circles(svg)) {
    const r = Number(c.r), w = Number(c['stroke-width'] ?? 0);
    const op = (s) => (s && s !== 'none' ? (Number(s.match(/rgba\([^)]*,\s*([\d.]+)\)/)?.[1] ?? 1)) : 0);
    if (Math.abs(d - r) <= w / 2) a = a + op(c.stroke) * (1 - a);
    if (d <= r) a = a + op(c.fill ?? 'black') * (1 - a);   // (an SVG circle without fill is filled black)
  }
  return a;
}

test('the page\'s wheel is a ring: nothing painted inside its band, the band and the gauge where the spec says', () => {
  const svg = staminaSvg();
  for (const c of circles(svg)) assert.equal(c.fill, 'none', `every circle unfilled: ${JSON.stringify(c)}`);
  for (let d = 0; d < R.inner - 0.01; d += 0.25) assert.equal(alphaAt(svg, d), 0, `clear at ${d} px from the centre`);
  assert.ok(alphaAt(svg, (R.outer + R.inner) / 2) > 0.95, 'the band is solid');
  assert.equal(alphaAt(svg, R.outer + 0.3), 0, 'nothing outside the band');
  const arc = circles(svg).find((c) => c.class === 'arc');
  assert.equal(Number(arc.r), R.arcR); assert.equal(arc.stroke, ENAMEL.accent); assert.equal(arc.transform, 'rotate(-90)');
  assert.ok(R.arcR - R.arcWidth / 2 >= R.inner + R.edgeWidth && R.arcR + R.arcWidth / 2 <= R.outer - R.edgeWidth, 'the gauge between the hairlines');
  assert.match(svg, new RegExp(`viewBox="${-R.size / 2} ${-R.size / 2} ${R.size} ${R.size}"`));
});

test('index.html: no wheel of its own (the page builds it from the spec), the winded look from the enamel tokens', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="stamina" aria-hidden="true"><\/div>/);
  assert.match(html, /#stamina \{[^}]*width: 34px; height: 34px;/, 'the box the spec is drawn for');
  assert.match(html, /#stamina\.winded \.arc \{ stroke: var\(--en-bad\); animation: stpulse \.7s/);
  assert.match(html, /@keyframes stpulse \{ 50% \{ stroke: var\(--en-gold\); \} \}/);
  assert.ok(!/#f7ecd2[^\n]*#stamina|#stamina[^\n]*#f7ecd2/.test(html), 'no cream paper in the wheel');
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /stEl\.innerHTML = staminaSvg\(\)/);
});

test('Unity draws the same ring: BridgeHud.cs StaminaRing holds the spec\'s numbers, the gauge clockwise from the top', () => {
  const cs = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.cs', import.meta.url), 'utf8');
  const block = cs.slice(cs.indexOf('static class StaminaRing'), cs.indexOf('static readonly Dictionary<string, Sprite> ringSprites'));
  const num = (k) => Number(block.match(new RegExp(`\\b${k} = ([\\d.]+)f?`))?.[1]);
  const want = { Size: R.size, Outer: R.outer, Inner: R.inner, EdgeWidth: R.edgeWidth, ArcR: R.arcR, ArcWidth: R.arcWidth,
    ShadowDy: R.shadow.dy, ShadowBlur: R.shadow.blur, ShadowAlpha: R.shadow.alpha, PulseSecs: R.pulseSecs };
  for (const [k, v] of Object.entries(want)) assert.equal(num(k), v, `StaminaRing.${k}`);
  assert.ok(num('Box') / 2 >= R.outer + 2 * R.shadow.blur, 'the sprites hold the shadow\'s blur (two deviations)');
  assert.match(block + cs, /float sigma = StaminaRing\.ShadowBlur;/, 'a filter\'s drop-shadow blur is the deviation itself');
  assert.match(cs, /wheelFill\.fillOrigin = \(int\)Image\.Origin360\.Top; wheelFill\.fillClockwise = true;/);
  assert.match(cs, /wheelFill\.color = winded \? Color\.Lerp\(EnBad, EnGold, k\) : HintAccent;/);
  // (the colours it uses are the enamel's: the accent, the red and gold, the brass, the hints' charcoal)
  const hints = readFileSync(new URL('../unity/Hiraeth/Assets/HiraethJS/Runtime/BridgeHud.Hints.cs', import.meta.url), 'utf8');
  assert.match(hints, new RegExp(`HintAccent = Ui\\.Hex\\("${R.fill}"\\)`));
  assert.match(hints, new RegExp(`EnBad = Ui\\.Hex\\("${R.winded}"\\)`));
  assert.match(hints, new RegExp(`EnGold = Ui\\.Hex\\("${R.pulse}"\\)`));
  assert.match(hints, new RegExp(`EnBrass = Ui\\.Hex\\("${R.edge}"\\)`));
  assert.equal(R.band, 'rgba(22, 23, 23, 0.96)'); assert.match(block + cs, /new Color\(22 \/ 255f, 23 \/ 255f, 23 \/ 255f, 0\.96f\)/);
  // (no pie: the old gold disc and its faint ink back are gone)
  assert.doesNotMatch(cs, /wheelRing|wheelFill = Ui\.Fill\(wheel, Ui\.Gold/);
});

test('the poses for pictures of the wheel, the same on both sides', () => {
  for (const p of Object.keys(STAMINA_POSE)) assert.equal(UI_PIECES[p], 'desert', p);
  // (-ui runs a piece then lets it go unless the next one starts with its name: none of them may)
  const names = Object.keys(STAMINA_POSE);
  for (const a of names) for (const b of names) if (a !== b) assert.ok(!b.startsWith(a), `${b} starts with ${a}`);
});
