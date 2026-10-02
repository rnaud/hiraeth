import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, MODE_STRATA } from './materials.js';

// Story, collectibles, the sketchbook journal and the gates between worlds.
//  - Story: one quiet goal per level, marked by a beacon. Arriving opens a
//    wordless comic page whose panels are rendered live from the game.
//  - Relics: five per level, often on top of things you have to climb.
//    Picking one up sketches the moment into your journal.
//  - Journal (J): a sketchbook with every relic and story page found, kept
//    in localStorage.
//  - Gate: a standing stone frame that turns the page to the next world.

const STORE = 'moebius.journal.v1';

export class Journal {
  constructor(levels) {
    this.levels = levels;
    try { this.data = JSON.parse(localStorage.getItem(STORE)) ?? {}; } catch { this.data = {}; }
    this.data.relics ??= {};
    this.data.stories ??= {};
    this.data.seen ??= {};
    this.el = document.getElementById('journal');
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyJ') this.toggle();
      else if (e.code === 'Escape' && this.open) this.toggle(false);
    });
    this.el.querySelector('.close').addEventListener('click', () => this.toggle(false));
  }

  save() {
    try { localStorage.setItem(STORE, JSON.stringify(this.data)); } catch (e) { console.warn('journal not saved', e); }
  }

  hasRelic(level, i) { return !!this.data.relics[level]?.[i]; }
  addRelic(level, i, entry) { (this.data.relics[level] ??= {})[i] = entry; this.save(); }
  relicCount(level) { return Object.keys(this.data.relics[level] ?? {}).length; }
  storyDone(level) { return !!this.data.stories[level]; }
  addStory(level, entry) { this.data.stories[level] = entry; this.save(); }
  seen(level) { return !!this.data.seen[level]; }
  markSeen(level) { this.data.seen[level] = 1; this.save(); }

  toggle(on = !this.open) {
    this.open = on;
    if (on) { this.render(); document.exitPointerLock?.(); }
    this.el.classList.toggle('open', on);
  }

  render() {
    const body = this.el.querySelector('.pages');
    body.innerHTML = this.levels.map((L) => {
      const relics = (L.relicNames ?? []).map((name, i) => {
        const e = this.data.relics[L.id]?.[i];
        return e
          ? `<figure class="tile"><img src="${e.img}" alt=""><figcaption>${name}</figcaption></figure>`
          : `<figure class="tile empty"><div>?</div><figcaption>&nbsp;</figcaption></figure>`;
      }).join('');
      const st = this.data.stories[L.id];
      const story = st
        ? `<figure class="tile story"><img src="${st.img}" alt=""><figcaption>${L.storyTitle}</figcaption></figure>`
        : `<figure class="tile story empty"><div>…</div><figcaption>${L.storyTitle ?? ''}</figcaption></figure>`;
      return `<section><h2>${L.title} <span>${this.relicCount(L.id)}/${(L.relicNames ?? []).length}</span></h2><div class="row">${story}${relics}</div></section>`;
    }).join('');
  }
}

// ---------------------------------------------------------------------------

function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.remove('show');
  void t.offsetWidth;
  t.classList.add('show');
}

export class Relics {
  /**
   * @param spots [x, z] | { at: [x, y, z], snap? } (see levels/content.js)
   * @param names one name per spot
   */
  constructor(scene, physics, { levelId, spots, names, journal, sound, capture, lights }) {
    this.items = [];
    this.levelId = levelId;
    this.journal = journal;
    this.sound = sound;
    this.capture = capture;
    this.lights = lights;
    this.names = names;
    const shardMat = makeMaterial({ color: '#f2c54b', flat: true, glow: 0.9 });
    const ringMat = makeMaterial({ color: '#fff6dc', glow: 1 });
    spots.forEach((s, i) => {
      if (journal.hasRelic(levelId, i)) return;
      let pos;
      if (Array.isArray(s)) {
        const y = physics.groundAt(s[0], 1e4, s[1], 2e4);
        pos = new THREE.Vector3(s[0], (Number.isFinite(y) ? y : 0) + 1.1, s[1]);
      } else {
        pos = new THREE.Vector3(...s.at);
        if (s.snap) {
          const y = physics.groundAt(pos.x, pos.y + 3, pos.z, 6);
          if (Number.isFinite(y)) pos.y = y + 1.1;
        }
      }
      const grp = new THREE.Group();
      grp.add(new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 0).scale(0.8, 1.4, 0.8), shardMat));
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.04, 6, 24), ringMat);
      grp.add(ring);
      grp.position.copy(pos);
      grp.userData.noCollide = true;
      scene.add(grp);
      const light = new THREE.Vector4(pos.x, pos.y, pos.z, 7);
      lights.push(light);
      this.items.push({ i, grp, ring, pos, light, base: pos.y });
    });
    this.total = spots.length;
  }

  update(dt, t, player) {
    for (const it of this.items) {
      if (it.done) continue;
      it.grp.position.y = it.base + Math.sin(t * 1.6 + it.i) * 0.18;
      it.grp.rotation.y += dt * 0.9;
      it.ring.rotation.x = Math.PI / 2 + Math.sin(t * 0.7 + it.i) * 0.5;
      if (player.pos.distanceTo(it.grp.position) < 2.3) this.collect(it, player);
    }
  }

  collect(it, player) {
    it.done = true;
    const name = this.names[it.i];
    // sketch the moment: a camera a few metres off, looking at the find
    const eye = it.grp.position.clone().add(new THREE.Vector3(3.2, 1.6, 3.2).applyAxisAngle(player.frame.up, player.heading + Math.PI * 0.75));
    const img = this.capture(eye, it.grp.position, 240, 170);
    it.grp.removeFromParent();
    const k = this.lights.indexOf(it.light);
    if (k >= 0) this.lights.splice(k, 1);
    this.journal.addRelic(this.levelId, it.i, { name, img, t: Date.now() });
    this.sound.chime();
    toast(`Found: ${name} · ${this.journal.relicCount(this.levelId)}/${this.total} · J to open the sketchbook`);
  }
}

// ---------------------------------------------------------------------------

export class Story {
  /**
   * @param def { title, intro, outro, goal: [x, y, z], radius, label }
   */
  constructor(scene, { levelId, def, journal, sound, capture, player, physics, ground }) {
    this.def = def;
    this.levelId = levelId;
    this.journal = journal;
    this.sound = sound;
    this.capture = capture;
    const [gx, gy, gz] = def.goal;
    const y = gy === 'top' ? physics.groundAt(gx, 1e4, gz, 2e4)
      : gy === 'ground' ? (ground?.heightAt ? ground.heightAt(gx, gz) : physics.groundAt(gx, 1e4, gz, 2e4)) : gy;
    this.goal = new THREE.Vector3(gx, (Number.isFinite(y) ? y : 0) - (def.drop ?? 0), gz);
    this.done = journal.storyDone(levelId);
    this.page = document.getElementById('page');
    this.page.addEventListener('click', () => this.closePage());
    window.addEventListener('keydown', (e) => { if (this.pageOpen && (e.code === 'Enter' || e.code === 'KeyE' || e.code === 'Escape')) this.closePage(); });
    // beacon: a tall thin column of light over the goal
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 240, 8, 1, true), makeMaterial({ color: '#fff3c8', glow: 1, side: THREE.DoubleSide }));
    beam.position.copy(this.goal).add(new THREE.Vector3(0, 120, 0));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.12, 6, 32), makeMaterial({ color: '#f2c54b', glow: 1 }));
    halo.rotation.x = Math.PI / 2;
    halo.position.copy(this.goal).add(new THREE.Vector3(0, 0.4, 0));
    this.beacon = new THREE.Group();
    this.beacon.add(beam, halo);
    this.beacon.userData.noCollide = true;
    this.beacon.visible = !this.done;
    scene.add(this.beacon);
    this.halo = halo;
    this.player = player;
    this.firstVisit = !journal.seen(levelId);
  }

  /** Called once the world is ready: the intro page on a first visit. */
  start() {
    if (this.firstVisit) {
      this.journal.markSeen(this.levelId);
      setTimeout(() => this.showPage('intro'), 600);
    }
  }

  update(dt, t) {
    this.halo.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    if (this.done || this.pageOpen) return;
    const r = this.def.radius ?? 12, p = this.player.pos;
    if (Math.hypot(p.x - this.goal.x, p.z - this.goal.z) < r && Math.abs(p.y - this.goal.y) < Math.max(r, 20)) {
      this.done = true;
      this.showPage('outro');
    }
  }

  hud() {
    if (this.done) return null;
    const d = this.player.pos.distanceTo(this.goal);
    return `◆ ${this.def.label} · ${d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1) + ' km'}`;
  }

  /** Three panels rendered live: wide, close, and the goal. */
  shots(which) {
    const p = this.player.pos.clone(), g = this.goal.clone();
    const up = this.player.frame.up;
    const toG = g.clone().sub(p).setY(0).normalize();
    const side = new THREE.Vector3().crossVectors(toG, up).normalize();
    const face = p.clone().addScaledVector(up, 2.0);
    if (which === 'intro') return [
      { eye: p.clone().addScaledVector(toG, -22).addScaledVector(up, 14).addScaledVector(side, 8), look: g.clone().lerp(p, 0.6).addScaledVector(up, 4) },
      { eye: face.clone().addScaledVector(toG, 2.6).addScaledVector(side, 0.9).addScaledVector(up, -0.15), look: face },
      { eye: g.clone().addScaledVector(toG, -95).addScaledVector(up, 24).addScaledVector(side, 30), look: g.clone().addScaledVector(up, 10) },
    ];
    return [
      { eye: p.clone().addScaledVector(side, 3.5).addScaledVector(up, 0.6).addScaledVector(toG, 1.5), look: face },
      { eye: g.clone().addScaledVector(toG, -10).addScaledVector(up, 4).addScaledVector(side, -4), look: g.clone().addScaledVector(up, 3) },
      { eye: p.clone().addScaledVector(toG, -50).addScaledVector(up, 35).addScaledVector(side, 20), look: p },
    ];
  }

  showPage(which) {
    const d = this.def;
    const imgs = this.shots(which).map((s, i) => this.capture(s.eye, s.look, i === 0 ? 900 : 440, i === 0 ? 380 : 300));
    const caption = which === 'intro' ? d.intro : d.outro;
    this.page.innerHTML = `
      <div class="sheet">
        <div class="p p1"><img src="${imgs[0]}" alt=""><div class="cap">${which === 'intro' ? `<b>${d.title}</b><br>` : ''}${caption}</div></div>
        <div class="p p2"><img src="${imgs[1]}" alt=""></div>
        <div class="p p3"><img src="${imgs[2]}" alt=""></div>
        <div class="hint">click / E to continue</div>
      </div>`;
    this.page.classList.add('open');
    this.pageOpen = true;
    document.exitPointerLock?.();
    this.sound.page();
    if (which === 'outro') {
      this.beacon.visible = false;
      this.journal.addStory(this.levelId, { img: imgs[0], t: Date.now() });
      this.sound.chime();
    }
  }

  closePage() {
    if (!this.pageOpen) return;
    this.page.classList.remove('open');
    this.pageOpen = false;
    this.sound.page();
    if (this.done && this.def.next) toast(`The gate to ${this.def.next} hums nearby.`);
  }
}

// ---------------------------------------------------------------------------

/** A standing stone frame with a glowing veil: walk through it to change world. */
export class Gate {
  constructor(scene, { pos, heading, dest, destTitle, sound, onTravel }) {
    this.pos = pos.clone();
    this.heading = heading;
    this.dest = dest;
    this.destTitle = destTitle;
    this.sound = sound;
    this.onTravel = onTravel;
    const stone = makeMaterial({ color: '#efe4cf', color2: '#d9c7a6', color3: '#c9b8a0', mode: MODE_STRATA, strataSize: 1.4, flat: true, grid: 1.2, glyphs: true });
    const W = 5, H = 9;
    const frame = mergeGeometries([
      new THREE.BoxGeometry(1.2, H, 1.4).translate(-W / 2 - 0.6, H / 2, 0),
      new THREE.BoxGeometry(1.2, H, 1.4).translate(W / 2 + 0.6, H / 2, 0),
      new THREE.BoxGeometry(W + 3.6, 1.3, 1.8).translate(0, H + 0.65, 0),
    ]);
    const grp = new THREE.Group();
    grp.add(new THREE.Mesh(frame, stone));
    this.veil = new THREE.Mesh(new THREE.PlaneGeometry(W, H), makeMaterial({ color: '#9fd6e8', glow: 0.85, side: THREE.DoubleSide }));
    this.veil.position.y = H / 2;
    this.veil.userData.noCollide = true;
    const glyph = new THREE.Mesh(new THREE.OctahedronGeometry(0.6, 0), makeMaterial({ color: '#f2c54b', glow: 1, flat: true }));
    glyph.position.y = H + 2.4;
    glyph.userData.noCollide = true;
    grp.add(this.veil, glyph);
    this.glyph = glyph;
    grp.position.copy(pos);
    grp.rotation.y = heading;
    scene.add(grp);
    this.group = grp;
    this.normal = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    this.side = new THREE.Vector3(Math.cos(heading), 0, -Math.sin(heading));
    this.light = new THREE.Vector4(pos.x, pos.y + 4, pos.z, 14);
    this._prevSide = null;
  }

  /** Where you arrive when coming through this gate: in front of it, facing away. */
  arrival() {
    return { pos: this.pos.clone().addScaledVector(this.normal, 5), heading: this.heading };
  }

  update(dt, t, player) {
    this.glyph.rotation.y = t * 0.8;
    this.glyph.position.y = 11.4 + Math.sin(t * 1.3) * 0.25;
    const rel = player.pos.clone().sub(this.pos);
    const along = rel.dot(this.side), across = rel.dot(this.normal), height = rel.y;
    const sideNow = Math.sign(across);
    // crossing the veil plane between the pillars
    if (this._prevSide !== null && sideNow !== this._prevSide && Math.abs(along) < 2.6 && height > -1 && height < 9 && !this.travelling) {
      this.travelling = true;
      this.sound.whoosh();
      this.onTravel(this.dest, this.destTitle);
    }
    this._prevSide = sideNow;
    this.near = player.pos.distanceTo(this.pos) < 25;
  }
}

/** Page-turn transition between worlds. */
export function turnPage(title, then) {
  const el = document.getElementById('travel');
  el.querySelector('.title').textContent = title;
  el.classList.remove('out');
  el.classList.add('in');
  setTimeout(then, 1100);
}

export function arriveFromPage(title) {
  const el = document.getElementById('travel');
  el.querySelector('.title').textContent = title;
  el.classList.add('in', 'instant');
  requestAnimationFrame(() => requestAnimationFrame(() => {
    el.classList.remove('instant');
    setTimeout(() => { el.classList.remove('in'); el.classList.add('out'); }, 500);
  }));
}
