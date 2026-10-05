# Capes and robes at every distance

A cape (`src/cape.js`) looks the same on its wearer at every distance and through every switch of
level of detail. Four paths draw it:

| distance (Handheld) | path | where |
| --- | --- | --- |
| under 12 m | cloth simulated every frame | `NPC.updateCape`, `NPC.updatePuppet` (under 5 m) |
| 12–70 m (12–30 m) | cloth simulated every 2nd or 3rd frame, **carried** | the same |
| past that | the baked drape, hung from the collar | `Cape.rest`, `Cape.hang` |
| a crowd's mid and far figures | the cape rebuilt in the vertex shader | `crowd-shader.js` |

**Carried cloth.** An update every 2nd or 3rd frame passes `s.carry = 1` to `Cape.update`:

- the particles are first moved with the collar's motion since the last update, so the walk itself
  never has to be dragged through the cloth's constraints; only the cloth's sway is simulated on it,
  over all the time since the last update (steps of at most `CLOTH.hMax`, damped per second). The
  old updates lived 1/30 s of a 1/20 s update, in slow motion, while the body walked on at full speed:
  the cloth streamed out behind and the legs went through it;
- the air is as the near cloth feels it, and `CLOTH.lag` holds the cloth back on a walking body as the
  near cloth's world-space damping does, so the hem trails as far behind as it does up close;
- between updates `Cape.follow()` moves the mesh with the collar by its matrix (nothing recomputed),
  so the body no longer walks into its own cape for a frame or two.

Every update, carried or not, pins the collar and collides with the colliders on their way from the
last update's place to this one's (`Cape.capsulesAt`), so a swinging leg pushes the cloth instead of
jumping through it.

**Colliders.** The body's capsules (`Humanoid.capsules`, MakeHuman girths measured on the full mesh,
`Humanoid.fullBody`, whatever level of detail it draws), and when the look has a robe, a cone round
each leg from the belt to the hem following the thigh as the skinned robe does (`Humanoid.robeCones`,
`ROBE_CONE`; none round a raised thigh: seated). A cone is a collider with `rb`, open at its ends. The
shared drape's key (`NPC.drapeKey`) names the body's morph and robe too.

**The crowd's figures.** The shader's cape is the near cloth's bell (`CROWD_CAPE`,
`crowdCapeHalfWidth`, checked against a baked MakeHuman drape in `tests/robes.test.js`): as wide at the
hem, over the shoulders, barely streaming back when walking. Each cape vertex is pushed out round the
body over the arm on its side where the arm is under the cloth (not out through the opening in
front), and over the robe swung by the thighs. The figures' robe follows the thighs as the full
people's skinned robe does on its captured walk (`CROWD_ROBE`, `crowdRobeTurn`).

Cost: no new draw calls; the cloth's CPU is as before (a carried update has the same three steps).
