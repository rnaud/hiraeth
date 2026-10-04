import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutCinema, overlaps, Subtitles, Cinema, BAR } from '../src/ship/cinema.js';

// what the pieces measure in the browser (px), by screen: a long subtitle wraps to three lines on a phone
const SCREENS = {
  '1200x760': { w: 1200, h: 760, size: { sub: [700, 36], hint: [260, 30], toast: [480, 36], objective: [430, 84], skip: [200, 20] },
    hud: [{ x0: 16, y0: 680, x1: 380, y1: 744 }, { x0: 1146, y0: 706, x1: 1186, y1: 746 }] },
  '960x540': { w: 960, h: 540, size: { sub: [720, 62], hint: [260, 30], toast: [470, 36], objective: [430, 84], skip: [200, 20] },
    hud: [{ x0: 16, y0: 464, x1: 380, y1: 524 }, { x0: 906, y0: 486, x1: 946, y1: 526 }] },
  '375x812': { w: 375, h: 812, size: { sub: [343, 88], hint: [300, 46], toast: [343, 56], objective: [343, 128], skip: [200, 20] },
    // the touch HUD up top, the gear and map buttons, the stick buttons down the right
    hud: [{ x0: 16, y0: 10, x1: 188, y1: 78 }, { x0: 321, y0: 14, x1: 361, y1: 54 }, { x0: 259, y0: 14, x1: 305, y1: 60 },
      { x0: 273, y0: 566, x1: 351, y1: 644 }, { x0: 199, y0: 708, x1: 263, y1: 772 }, { x0: 287, y0: 562 - 96, x1: 351, y1: 626 - 96 }] },
};
const PLACE = { sub: 'bottom', hint: 'top', toast: 'top', objective: 'top', skip: 'corner' };
const ids = Object.keys(PLACE);
/** every subset of the pieces, in every order of appearance for small sets */
function* combos() {
  for (let m = 1; m < 1 << ids.length; m++) {
    const set = ids.filter((_, i) => m & (1 << i));
    yield set;
    if (set.length > 1) yield [...set].reverse();
  }
}

const check = (name, L, obstacles, { bars }) => {
  assert.ok(L.fits, `${name}: everything on screen and off the letterbox`);
  const o = overlaps(L.rects);
  assert.deepEqual(o, [], `${name}: overlaps ${JSON.stringify(o)}`);
  for (const [id, r] of Object.entries(L.rects)) {
    for (const ob of obstacles) {
      const x = Math.min(r.x1, ob.x1) - Math.max(r.x0, ob.x0), y = Math.min(r.y1, ob.y1) - Math.max(r.y0, ob.y0);
      assert.ok(!(x > 0 && y > 0), `${name}: ${id} covers the HUD at ${JSON.stringify(ob)}: ${JSON.stringify(r)}`);
    }
  }
  if (bars) assert.ok(L.bar > 0, `${name}: the letterbox is down`);
};

test('the subtitle, hint, toast, objective card and skip bar never overlap, at any of three screens, with or without the letterbox', () => {
  let n = 0;
  for (const [sname, S] of Object.entries(SCREENS)) {
    for (const bars of [true, false]) {
      for (const set of combos()) {
        const items = set.map((id) => ({ id, w: S.size[id][0], h: S.size[id][1], place: PLACE[id] }));
        // in a scene the HUD is hidden; out of one it is there to keep clear of
        const obstacles = bars ? [] : S.hud;
        const L = layoutCinema({ w: S.w, h: S.h, bars, items, obstacles });
        check(`${sname} ${bars ? 'bars' : 'open'} [${set}]`, L, obstacles, { bars });
        if (bars) {
          const bar = Math.round(S.h * BAR);
          for (const [id, r] of Object.entries(L.rects)) {
            if (id === 'skip') assert.ok(r.y0 >= S.h - bar && r.y1 <= S.h, `${sname}: the skip bar sits in the bottom bar`);
            else assert.ok(r.y0 >= bar && r.y1 <= S.h - bar, `${sname}: ${id} between the bars: ${JSON.stringify(r)}`);
          }
        }
        n++;
      }
    }
  }
  assert.ok(n > 300, `${n} layouts checked`);
});

test('the layout keeps clear of a conversation panel and the box card, and keeps the order things appeared in', () => {
  const S = SCREENS['960x540'];
  const dialogue = { x0: 120, y0: 380, x1: 840, y1: 514 };
  const items = [{ id: 'toast', w: 470, h: 36, place: 'top' }, { id: 'sub', w: 720, h: 36, place: 'bottom' }];
  const L = layoutCinema({ w: S.w, h: S.h, items, obstacles: [dialogue] });
  check('dialogue', L, [dialogue], { bars: false });
  assert.ok(L.rects.sub.y1 <= dialogue.y0, 'the subtitle rises above the conversation');
  // the box card (bottom, in the scene's letterbox) and a toast for what was found
  const card = { x0: 28, y0: 230, x1: 588, y1: 459 };
  const L2 = layoutCinema({ w: S.w, h: S.h, bars: true, items: [{ id: 'toast', w: 470, h: 36, place: 'top' }], obstacles: [card] });
  check('box card', L2, [card], { bars: true });
  // a phone in a scene you walk through: the touch buttons reach into the bottom bar, the skip bar moves aside or up
  const P = SCREENS['375x812'], btns = P.hud.slice(3);
  const L5 = layoutCinema({ w: P.w, h: P.h, bars: true, items: [{ id: 'skip', w: 200, h: 20, place: 'corner' }, { id: 'sub', w: 343, h: 88, place: 'bottom' }], obstacles: btns });
  check('phone walk', L5, btns, { bars: true });
  // a toast that came first stays on top; the objective card that came after goes under it
  const L3 = layoutCinema({ w: 1200, h: 760, items: [{ id: 'toast', w: 480, h: 36, place: 'top' }, { id: 'objective', w: 430, h: 84, place: 'top' }] });
  assert.ok(L3.rects.toast.y1 <= L3.rects.objective.y0);
  const L4 = layoutCinema({ w: 1200, h: 760, items: [{ id: 'objective', w: 430, h: 84, place: 'top' }, { id: 'toast', w: 480, h: 36, place: 'top' }] });
  assert.ok(L4.rects.objective.y1 <= L4.rects.toast.y0);
});

test('subtitles: one line at a time, replaced at once, timed lines clear, queued lines wait their turn', () => {
  const S = new Subtitles();
  const a = { who: 'ship', text: 'Impact. Hull breach.' }, b = { who: 'ship', text: 'Main power lost.' }, c = { who: 'father', text: 'Listen.' };
  assert.equal(S.say(a), a);
  assert.equal(S.say(b), b, 'a new line replaces the one up');
  assert.equal(S.line, b);
  for (let i = 0; i < 600; i++) S.tick(0.1);
  assert.equal(S.line, b, 'an untimed line stays until replaced');
  S.say(a, 2);
  S.add(b, 1);
  S.add(c, 1);
  assert.equal(S.line, a, 'queued lines wait');
  S.tick(1.9);
  assert.equal(S.line, a);
  assert.equal(S.tick(0.11), true);
  assert.equal(S.line, b, 'then the next');
  S.tick(1.01);
  assert.equal(S.line, c);
  S.tick(1.01);
  assert.equal(S.line, null, 'and the last one clears');
  // a hard cut drops what was waiting
  S.say(a, 1); S.add(b); S.say(c);
  for (let i = 0; i < 100; i++) S.tick(0.1);
  assert.equal(S.line, c);
  S.say(null);
  assert.equal(S.line, null);
  // the Cinema is inert without a DOM, but keeps the same state
  const C = new Cinema();
  C.say(a, { secs: 1 });
  C.say(b, { queue: true });
  assert.equal(C.subs.line, a);
  C.update(1.05);
  assert.equal(C.subs.line, b);
});
