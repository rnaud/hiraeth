// The traveller's body, heard (the sounds are Sound's: src/audio.js, on the samples of src/sfx.js).
// BodyFoley watches the player from frame to frame and says what the body just did:
//
//   jump        left the ground going up (a rustle, a scuff; now and then a soft breath)
//   land        back on the ground, by how fast it came down (feet, then a body thump past `heavy`)
//   grab        caught a wall to climb
//   mantle      pulled up over a ledge (cloth, and often an effort)
//   wings       the fluid wings opened or folded
//   jets        the jets lit
//   evade       the roll out of a blow
//   knockdown   the body went down (a fall, and a grunt)
//   getUp       getting up again (cloth, often a sigh)
//
// The breaths are soft and occasional: a chance each time, more of one when out of breath, never
// twice within `breathGap` seconds. Hurts are heard from main.js (Player onHurt → sound.hurt).
//
//   const foley = new BodyFoley(sound);  foley.update(player, dt) once a frame

export const FOLEY = {
  airMin: 0.12,        // s in the air before a landing is heard (a step down a kerb is just a step)
  landMin: 2.2,        // m/s down: under this a landing is a footstep
  breathGap: 4.5,      // s at least between two breaths
  jumpBreath: 0.22,    // the chance of a breath on a jump (rested)
  mantleBreath: 0.55,
  getUpSigh: 0.7,
  flapGap: 0.35,       // s at least between two wing sounds
};

export class BodyFoley {
  constructor(sound, { rand = Math.random, F = FOLEY } = {}) {
    this.sound = sound; this.rand = rand; this.F = F;
    this.prev = null;
    this.t = 0; this.air = 0; this.fall = 0;
    this.lastBreath = -1e9; this.lastFlap = -1e9;
    this.heard = [];   // the last events (a test / dev hook)
  }

  /** A breath now? `chance` (0..1), more when winded (stamina 0..1), never two close together. */
  breathe(chance, stamina = 1) {
    if (this.t - this.lastBreath < this.F.breathGap) return false;
    const k = Math.min(1, chance + Math.max(0, 1 - stamina) * 0.5);
    if (this.rand() >= k) return false;
    this.lastBreath = this.t;
    return true;
  }

  emit(name, arg) {
    this.heard.push(name);
    if (this.heard.length > 24) this.heard.shift();
    const f = this.sound?.[name];
    if (typeof f === 'function') f.call(this.sound, arg);
  }

  /** What the body is doing this frame (a few booleans and speeds read off the Player). */
  read(p) {
    const up = p.frame?.up, v = p.vel;
    return {
      ground: !!p.onGround,
      vy: v ? (up ? v.x * up.x + v.y * up.y + v.z * up.z : v.y) : 0,
      climbing: !!p.climbing,
      mantle: !!p.mantle,
      gliding: !!p.gliding,
      thrust: !!p.thrusting,
      down: !!p.down,
      rising: p.down?.phase === 'rise',
      evade: !!p.combatMotion?.evade,
      water: !!p.swim || (p.inWater?.depth ?? 0) > 0.4,
      riding: !!p.ride || !!p.boarding || !!p.unboarding,
      stamina: p.stamina ?? 1,
    };
  }

  update(p, dt = 1 / 60) {
    if (!p) return;
    this.t += dt;
    const c = this.read(p), o = this.prev;
    this.prev = c;
    if (!o) return;
    const F = this.F, pos = p.pos;
    // in the air: how long, and the fastest it came down (the landing's speed)
    if (!c.ground) { this.air += dt; this.fall = Math.max(this.fall, -c.vy); }
    const body = !c.riding && !c.water && !c.down;
    if (o.ground && !c.ground && c.vy > 3 && body && !c.climbing && !c.mantle) {
      this.emit('jump', { breath: this.breathe(F.jumpBreath, c.stamina), pos });
    }
    if (!o.ground && c.ground) {
      const speed = Math.max(this.fall, -o.vy);
      if (body && !o.mantle && this.air >= F.airMin && speed >= F.landMin) this.emit('land', { speed, pos });
      this.air = 0; this.fall = 0;
    }
    if (c.climbing || c.water || c.riding) { this.air = 0; this.fall = 0; }
    if (!o.climbing && c.climbing && !c.down) this.emit('grab', { pos });
    if (!o.mantle && c.mantle) this.emit('mantle', { breath: this.breathe(F.mantleBreath, c.stamina), pos });
    if (o.gliding !== c.gliding && !c.down && this.t - this.lastFlap >= F.flapGap) {
      this.lastFlap = this.t;
      this.emit('wings', { open: c.gliding, pos });
    }
    if (!o.thrust && c.thrust) this.emit('jets', { pos });
    if (!o.evade && c.evade) this.emit('evade', { pos });
    if (!o.down && c.down) this.emit('knockdown', { pos });
    if (!o.rising && c.rising) this.emit('getUp', { sigh: this.rand() < F.getUpSigh, pos });
  }
}
