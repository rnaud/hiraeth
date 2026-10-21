# Design capture review — in progress

Frozen c5449ab6c. Prescribed64 views first; invalid frames retained, never counted as gameplay faults. No audible playback.

- Desert landing: camera sits under ship ramp; stair underside dominates centre, city partially visible either side. Follow up immediately beyond stair, or reuse parent's actual arrival while preserving original.
- Desert gap: terrain face fills view; not usable for spacing/wayfinding judgement. Ground-correct camera at same outdoor X/Z and inspect direction toward endpoint.
- Desert above: heavy atmospheric fog at2km, cannot read map features. SVG map remains valid; need lower aerial context or explicitly not use aerial photo as score evidence.
- Desert blind: generated route is skull→clogged drain at the intentional giant-cave origin y1000 (`desert-sites.js:36`), NOT roots→hollow. Cave exterior visible from this fixed eye; need interior framing. Do not mistake floating interior coordinates for collision contamination. Outdoor roots→hollow mast requires its own view.
- Rose House d1: door and local hall readable. dc: plate/pier and route to upper door visible; revisit print size before criterion judgement.
- Vael landing: broad playable terrace and landmark forms readable. Gap: ground-level plateau/cliff context; does not prove traversability beyond wall. Above fogged, overhead temple also visible; avoid inferring outdoor density from overhead rendered temple.
- Aerie column: camera very close to wall/ledge and looking down, poor view of lift relationship. Rise shows vent/wind route but not entire intended landing; supplemental required before score adjustment.
- Edena landing/gap: crops, canal edges and temple silhouettes lead the eye; overhead is fogged but recognisable. Greenhouse flower door and key cage readable.
- Lorn landing readable village edge/lamp; gap camera is submerged and invalid for walking sightline. Hush gallery bridge/pendulums readable; d0's target door falls outside framing.
- Underwater landing: camera blocked by red building wall, invalid. Gap has readable seafloor context; above visibility insufficient. Whale sound hall shows vertical floors/stairs/tidal band; ledgeE camera intersects pillar/frame.
- Glass Dunes landing and aerial readable: compact populated court against enclosing glass ridges; deliberate quiet western field should not be treated as mandatory-path failure.
- Incal landing readable temple/paved plaza. Gap is inside/under city floor and invalid; above largely fogged. Well cage:kC clearly frames cage, plate and door; lift view shows stacked ring routes.
- Buried landing readable inhabited basin with aqueduct/digging machinery; gap inside wall/ceiling and above blocked by overhead roof, both invalid. Engine dS readable four-eye/chest relationship; h1 view cramped against large pillar, needs context before judging its hint.
- Moon Foundry landing/gap readable broad working hangar and return ship. Above shows only roof, not activity below. Casting dR shows gate/ball, gW shows local gate/tap/colour; larger pour-state relationship not proven by static frame.
- Signal Market landing and gap: strong avenue/bridge direction, dense inhabited facades; aerial useful layout context despite haze.
- Floating City landing/gap: bridges visibly connect destination islets and lamps mark route; overhead clear. Mooring cw is cramped near mechanism; dR shows rope store approach. Additional gN/d1 camera planned for the actual revised locks, not the auto-picked easiest pair.
- Spheres landing/gap: giant vegetation, furrows and spherical landmarks read clearly; overhead fogged. Footprint br1 bridge and bW vertical shaft readable; lens-hidden states need supplemental low-obviousness views.
- Belfry lift: disc and gallery/door readable; dP door seen but bell high off-frame. Clock discs: abyss/platform/clock/door readable, dP close door only. Lamp disc dark but pit/discs read, cur dominated by pillar; no readability uplift claimed from those two alone.
- Reused and personally inspected coordinator's actual arrival images: `../game/10-desert.jpg` gives unobstructed city/flame approach from the ramp; `../game/14-underwater-city.jpg` shows the actual Dock arrival and inhabited tunnel route. These supersede invalid automatic landing eyes for qualitative arrival review; neither proves surface-deck lift usability.

Initial run completed64/64 views plus26 map/plan rasterizations. All15 contexts muted=true/master=0; zero browser exceptions/errors. All64 inspected in contact sheets, with specific blockers retained for follow-up rather than counted as design defects.


## Corrected player-height supplemental pass

Eleven additional images completed in one muted Chrome, zero page errors. Desert roots/gate: red rag exists above the return ship; small and weakly salient behind the arch from roots, clearer from gate. Smoke/flames compete. Glass Dunes fork/posts: lamps and recessed Court entrance read clearly; preserve the optional diversion. These repair capture framing, not the frozen source.

Footprint dT now shows the door approach through successive thresholds; it does not reveal the upstairs ball. dR shows the great sphere/lift as an architectural state landmark, while the hidden eye still requires the lens and route memory. d4 shows nearby plates/sphere and remote key door; multi-stage dependencies are not all visible together. Mooring d1 shows the large room and intervening machinery; do not confuse geometric ray visibility with obvious recognition of the distant eye. gN's camera looks steeply upward at local ring/ball: confirms proximity but not an unassisted first impression. Belfry d1 shows the pole/bell relationship; dP remains too close to the door for useful target judgement, retained as invalid framing.

No full guardian playthrough is claimed by these stills. Separate live Footprint input review is in progress.
