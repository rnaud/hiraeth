# Earlier looks of the traveller

Superseded: the rider (v0.14) and the lavender-suited hero (v0.15). The traveller today: docs/systems/characters.md. (`src/gear.js` and `src/trinkets.js` named below still exist.)

## The hero (v0.15)

After the reference plate:
- **Suit:** a baggy lavender suit. The body swells along its normals in the
  vertex shader, more on the legs, and creases are inked at the elbows,
  knees and waist.
- **Gloves:** salmon.
- **Helmet:** a glass bubble. The `glass` material discards everything but
  the grazing rim and a curved highlight streak, and it casts no shadow.
- **Headset:** blue ear cups, a mic and a gadget cluster with aerials.
- **Radio pack:** blue, with dials, a lens and a sprung whip antenna with a
  ball tip.
- **Belt:** cables loop down to a tan belt crowded with pouches, plus a
  dangling meter.
- **Handheld device:** sits in the right fist, screen towards the eyes.
- **Code:** `src/gear.js`. There is no cape. The jetpack rides behind the
  radio pack.

## The rider (v0.14, the Vael-style look; NPCs still wear capes)

- **Outfit:** flat blocks of colour (a body colour and a hem band), not gradients.
- **Cape:** a short cape, knee-length.
- **Clutter:** belt pouches, a canteen, a lantern, bells, a bandolier of charms,
  a bedroll with a pot and a rolled map, and a walking stick with a pennant
  (`src/trinkets.js`). The hanging pieces are damped springs, kicked by the
  body's acceleration and the gait.
- **Standing:** an idle layer on top of the Idle clip. The weight settles on
  one leg, then shifts: the hip drops, the shoulders counter-tilt and the free
  knee bends. The stance also narrows, the chest breathes, a hand hooks the
  belt and the head glances around. The foot IK keeps the feet planted.
- **Paraglider:** the hands grip the brake handles (two-bone IK) and the
  canopy rides above them. The risers are re-aimed into the fists every frame,
  and turning pulls one brake down.
