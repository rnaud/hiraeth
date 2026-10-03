// What's new, version by version (newest first). Shown in the game with N or
// from the settings menu; after an update a note points you to it once.
// Add an entry at the top for every release.

export const CHANGELOG = [
  { v: '0.22', date: '2026-10-03', items: [
    'The world notices you: reactive scenery across all eight worlds responds to proximity and attention, then settles when you leave. Nearby objects answer in a delayed wave.',
    'Salt blooms open and release spores in the desert; Edena flowers turn pink and unfold; shy Perdide fungi close and glow. Pale fronds listen in Arzach and the Atelier.',
    'City and Garage terminals wake with messages. Signal Market storefronts and selected existing billboards respond as you pass. Returning visitors and encounters from other worlds leave a remembered signal.',
    'Reactions respect walls, pause in menus and photo mode, and use bounded spore effects. The Garage reactions follow local gravity, including the upside-down quarter and ring.',
  ] },
  { v: '0.21', date: '2026-10-03', items: [
    'Desert birds now have bodies, heads, beaks, fan tails and feathered wings. They circle closer at a smaller scale, with bounded distance scaling to keep their silhouettes natural.',
    'The Arzach riding bird has a curved neck, hooked beak, eyes, talons and a feathered tail. Layered flight feathers replace the old flat wing panels.',
    'Shoulders and wrists articulate through the wingbeat; wings fold along the back on landing, legs tuck in flight and the tail responds to banking. Feathers are batched within each joint for rendering.',
  ] },
  { v: '0.20', date: '2026-10-03', items: [
    'New world: The Signal Market. A street-level city of coral and teal towers, illustrated billboards, awnings, lanterns, cables and four walkable skybridges, inspired by your city reference sheets.',
    'Meet the market crowd and lavender inhabitants, hail flying taxis, or take the cab parked near the entrance. Climb or jetpack to the broadcast balcony to find The Last Broadcast.',
    'Five new relics, a city soundtrack and sketchbook entries. Choose world 7 in the picker; the journey now continues from Perdide through the market and back to the desert.',
  ] },
  { v: '0.19', date: '2026-10-03', items: [
    'Controller support: analog movement and camera, jumping, climbing, gliding, vehicles, interaction and scout ping. Hold RT/R2 to run or boost; LB/RB zoom the camera.',
    'Navigate settings, worlds, story pages and the sketchbook with your controller. Photo mode supports flying, altitude and saving pictures. Button hints appear when you use a controller.',
    'Stick deadzones prevent drift. Disconnecting releases controls, and menu confirmation cannot carry a held jump into gameplay.',
  ] },
  { v: '0.18', date: '2026-10-03', items: [
    'More natural running and climbing cadence. Climbing hands hold their place during the support stroke; palms face the wall and boots point toward it. Wrists follow the animation.',
    'Ping lasts five seconds, then the scout returns to the backpack.',
    'The hoverbike arrives faster and parks close enough to board. If blocked or still approaching after four seconds, it recalls to a clear spot nearby.',
    'Inspired by the new reference sheets: softer lavender coveralls, a cream radio pack, a turquoise mineral basin, a suspension bridge and vast dish canopies over the desert village. Fewer scattered rocks leave the dunes more open.',
  ] },
  { v: '0.17', date: '2026-10-03', items: [
    'Press Q or tap ping to launch a tiny scout from your backpack. It flies ahead toward your next objective, waits nearby and returns home.',
    'The scout follows your progress: traveler, observatory ledges, unfinished lenses, story objectives, relics and gates. Doorways and gravity portals are included.',
    'Clearer small characters: thinner silhouettes, lighter shadows and less clothing detail at a distance, so the lavender suit stays readable on phones.',
  ] },
  { v: '0.16', date: '2026-10-03', items: [
    'Install on iPhone from Safari: Share → Add to Home Screen. Launch from the Moebius icon to play without browser bars, with controls clear of the notch and home indicator.',
    'The Sleeping Observatory: meet the traveler beside desert camp, follow their sketch east, climb six resting ledges and align three lenses to unfold the roof and reveal a constellation.',
    'Lens positions, discoveries and the awakened observatory are saved in the sketchbook. Return to the traveler for new dialogue.',
    'Smoother outlines at every graphics setting. Mobile Auto now favours a clear image at 30 fps, starts at full resolution and stops reducing resolution at 0.75×.',
    'Lighter, more widely spaced sky dots, with less ink at low resolution. Comic pages fit narrow phone screens.',
  ] },
  { v: '0.15', date: '2026-10-03', items: [
    'A new hero after your reference: a baggy lavender suit with creases, salmon gloves, a glass bubble helmet over a blue headset, a radio pack with a whip antenna, cables, a pouch belt and a handheld device. No cape.',
    'Real climbing animation (Quaternius mocap): up, down, sideways and a hanging idle, with the hands and feet pressed onto the wall. The ledge climb is mocap too.',
    'Standing still a while, the hero sometimes looks around properly.',
    'Footprints take the colour of whatever they\'re on, as a darker print in the surface.',
    'The hoverbike drives over to you when you whistle, instead of appearing.',
    'Whistle for the bird in mid-air and it swoops in and catches you.',
    'The paraglider is in fixed colour cells (no more pulsing stripes), and folds away when you mount.',
  ] },
  { v: '0.14', date: '2026-10-03', items: [
    'Speech balloons sit over the speaker\'s head and stay put as the camera moves.',
    'The paraglider\'s lines run into the rider\'s hands, gripping the brake handles; pull one to turn.',
    'The outfit is in flat blocks of colour, like a printed plate.',
    'A shorter cape, and the rider carries a lot of little things: belt pouches, a canteen, a lantern, bells, a bandolier of charms, a bedroll with a pot, and a walking stick with a pennant. The hanging ones swing as you move.',
    'A proper standing pose: the weight settles on one leg, then shifts, with breathing, a hand on the belt and the odd glance around.',
    'The hoverbike is about 25% slower (34 m/s, 54 m/s boosted).',
    'Arzach: warm peach sand under an aqua sky, rose shadows, mushroom rocks and balanced stones.',
    'Edena: a ligne-claire look (thin lines, flat colour, little hatching) and an android garden of spheres, cones and diamonds.',
    'Perdide: giant glowing fungus trees and reeds along the waterlines.',
    'The Garage: pipes with valves and pumps, aerials, cabins and cables all over Grubert\'s plateau.',
    'This changelog (N).',
  ] },
  { v: '0.13', date: '2026-10-03', items: [
    'Drawn textures: windows with shutters on the city houses, tiled roofs, leaves on the trees, cracks in the rocks.',
    'City houses get arched doors, balconies and chimneys; umbrella pines join the cypresses.',
    'Broken pen strokes on interior lines, and a heavier outline round the rider.',
    'Distant layers go paler and greyer (aerial perspective); marks are finer near the camera.',
    'A robe under the cape.',
    'Errands: villagers ask you to carry things to someone in the next world.',
    'Walk, ride or glide off the edge of a world into the neighbouring one.',
    'Auto quality: the resolution adapts to keep the frame rate up, with a low-detail mode for phones.',
    'Villa floors no longer flicker against the ground.',
  ] },
  { v: '0.12', date: '2026-10-03', items: [
    'Walk-in interiors: city villas, the masked head\'s chamber, Edena\'s ship cabin.',
    'A paraglider with momentum, banking turns, dives and flares.',
    'A soundtrack per world, with its own lead instrument, melody and ambience.',
    'A blue-to-purple cape and a purple hat.',
  ] },
  { v: '0.11', date: '2026-10-03', items: [
    'The city-shaft rebuilt as a Moebius hill-town: terraces, terracotta roofs, cypresses and olives, viaducts and a megastructure overhead.',
    'Street life: a crowd, market stalls, laundry lines, passengers in the taxis.',
    'Faster city: collision built in the background, culling per terrace, distance detail.',
  ] },
  { v: '0.10', date: '2026-10-02', items: [
    'Faster walking, and feet that follow the slope.',
    'A faster hoverbike with two glowing, colour-shifting jet trails.',
    'A heavier cape that barely lifts in the wind.',
    'An FPS counter (F).',
  ] },
  { v: '0.9', date: '2026-10-02', items: [
    'The "Moebius print" look: flat dotted skies, a cumulus bank, dotted sand, scrub, blue-grey shadows.',
    'Climbing with hands and feet on real holds, and mantling over ledges.',
    'A steadier camera you can drop low to look at the sky.',
  ] },
  { v: '0.8', date: '2026-10-02', items: [
    'Varied villagers, a settings menu, touch controls, continue where you left off, and an ending.',
  ] },
  { v: '0.7', date: '2026-10-02', items: [
    'A real human rider with motion-captured walking and running, in slim Moebius proportions with an inked face.',
    'The cape collides with the whole body; the jetpack leans forward and holds twice the fuel.',
  ] },
  { v: '0.6', date: '2026-10-02', items: [
    'A cloth cape, planted feet, a story thread per world, villagers, relics, gates between worlds, sound and weather.',
  ] },
  { v: '0.5', date: '2026-10-02', items: [
    'A slender, Arzach-style rider with a real run cycle.',
  ] },
  { v: '0.4', date: '2026-10-01', items: [
    'Beauty pass: inked line weights, antialiasing, form-following hatching, skies, birds and life, photo mode.',
    'Published on GitHub Pages; Sable-like thin outlines by default.',
  ] },
  { v: '0.3', date: '2026-10-01', items: [
    'Four new worlds (Arzach, the Garage, Edena, Perdide) and a world picker (L).',
  ] },
  { v: '0.2', date: '2026-10-01', items: [
    'The L\'Incal city-shaft with a jetpack and rideable taxis; you can stand on everything.',
  ] },
  { v: '0.1', date: '2026-10-01', items: [
    'The first desert: inked edges, two-tone shading, hatching that sticks to surfaces, dunes, the hoverbike.',
  ] },
];

export const VERSION = CHANGELOG[0].v;
const SEEN_KEY = 'moebius.changelog.seen';

export class Changelog {
  constructor({ onOpen } = {}) {
    const el = (this.el = document.createElement('div'));
    el.id = 'changelog';
    el.innerHTML = `<div class="panel"><h1>WHAT'S NEW <span>v${VERSION}</span></h1><div class="list">${
      CHANGELOG.map((r) => `<section><h2>v${r.v} <span>${r.date}</span></h2><ul>${r.items.map((i) => `<li>${i}</li>`).join('')}</ul></section>`).join('')
    }</div><div class="buttons"><button data-a="close">Close (N)</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el || e.target.dataset?.a === 'close') this.toggle(false); });
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyN') this.toggle();
      else if (e.code === 'Escape' && this.open) { e.stopImmediatePropagation(); this.toggle(false); }
    });
    this.onOpen = onOpen;
    let seen = null;
    try { seen = localStorage.getItem(SEEN_KEY); } catch { /* ignore */ }
    this.fresh = seen !== VERSION;      // updated since your last visit
  }

  toggle(on = !this.open) {
    this.open = on;
    if (on) { document.exitPointerLock?.(); this.onOpen?.(); try { localStorage.setItem(SEEN_KEY, VERSION); } catch { /* ignore */ } this.fresh = false; }
    this.el.classList.toggle('open', on);
  }
}
