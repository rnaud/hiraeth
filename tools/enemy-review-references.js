// Author selections from the visible Midjourney review, 2026-10-30.
// These describe concept decisions, never implemented game assets.
const pick = (job, index) => ({ job, index,
  url: `https://www.midjourney.com/jobs/${job}?index=${index}`,
  image: `https://cdn.midjourney.com/${job}/0_${index}_640_N.webp?method=shortest` });
const concept = (key, name, family, type, note, selections, stage = 'selected', job = '') => ({
  id: `concept:${key}`, key, name, family, type, note, selections, stage,
  newEnemy: !type, role: type ? `Rework ${type}` : 'New enemy',
  jobUrl: job ? `https://www.midjourney.com/jobs/${job}?index=0` : '',
});
const A = 'Fantastical animals', M = 'Monsters', R = 'Robots';
export const CONCEPTS = [
  concept('shellback', 'Shellback', A, 'crab', 'Dramatic shell silhouette; keep the legs free to move.', [pick('96cb4064-e846-4413-85f6-344cda9cf9c8', 3)]),
  concept('bellows-toad', 'Bellows toad', A, 'toad', 'Simple rounded body with a clear breathing action.', [pick('1f131821-5102-403a-b590-47cad4e0497c', 0)]),
  concept('centipede', 'Drill-head centipede', A, 'centipede', 'Stronger shapes and simpler colours.', [pick('2d51ea34-5c74-41a5-b2e3-ba75ddd3c460', 0)]),
  concept('reed-knot', 'Reed knot', M, 'rootknot', 'More dramatic silhouette.', [pick('51ba625c-2c7f-497e-ae8b-1b9ed77f8bf0', 3)]),
  concept('cloud-jelly', 'Cloud jelly', A, 'jelly', 'Creature plus one clear concept. Avoid fragile thin details.', [pick('61f3e222-b28c-4de9-a1f6-1f3cda28e82c', 0)]),
  concept('lamp-moth', 'Lamp moth', A, 'moth', 'Broader, less angular shapes.', [pick('facfa349-c1d1-4a6e-8f28-6608eb39ab74', 2)]),
  concept('storm-ray', 'Storm ray', A, 'ray', 'More volume; avoid a flat sheet silhouette.', [pick('5f9c3751-a1bd-496d-b1aa-efffa5bbc60d', 1)]),
  concept('dune-worm', 'Dune worm', A, 'worm', 'Rounder body shapes.', [pick('dd808701-a439-4561-9807-0b852424a038', 1)]),
  concept('fencer', 'Foundry fencer', R, 'fencer', 'Selected replacement direction for the existing fencer.', [pick('8998838f-8a9d-4ba9-aaeb-04fb0ee97355', 3)]),
  concept('blob', 'Mobile ink blob', M, 'blot', 'Self-contained moving body. The pooled, floor-attached version was rejected.', [pick('fe758e2c-50b6-4638-b0c1-388d1e234c4b', 2)]),
  concept('hound', 'Broad-pawed hound', M, 'hound', 'Large paws and thick lower legs. No cape; thin-legged versions rejected.', [pick('e613076c-2d61-446e-ba60-e19e95db5e2b', 1)]),
  concept('cistern-forager', 'Cistern forager', M, 'grunt', 'Grunt shortlist: simple eyes, cheek organs and broad hands. Multiple directions liked; final grunt choice remains open. Seedpod and Bokoblin-like versions rejected.', [pick('e7f4d3f5-de8c-4c1e-8c6c-69804bac7b85', 1), pick('509d2563-8e51-4650-8bd1-13b032b0fff9', 0), pick('c4086168-5ecf-4644-9163-3fc1645be0aa', 0)], 'shortlist'),
  concept('salt-drifter', 'Salt-flat drifter', M, 'grunt', 'Grunt shortlist: elongated face and simple eyes. Preserve broad hands; strengthen thin legs before building.', [pick('504390cd-9735-4e47-9526-abe8fe95f29f', 3), pick('e0af33a3-1cce-4a8e-8820-054651a5f08f', 2)], 'shortlist'),
  concept('hulk', 'Root crusher', M, 'hulk', 'Selected hulk: heavy root-crushing palms, thick limbs and simple eyes.', [pick('69ae4d9f-9bdb-4eab-998a-08bdf543617d', 2)]),
  concept('prowler', 'Pod stalker', M, 'prowler', 'Selected prowler: low ambush stance and broad limbs.', [pick('5d011893-58f1-4c33-a34d-ac8df1a99842', 2)]),
  concept('warlord', 'Resonator chief', M, 'warlord', 'Selected warlord: compact throat chamber calls the pack; no cape.', [pick('b7d9aa56-69bf-44a7-becc-6a2e9737b4bf', 2)]),
  concept('sentinel', 'Cistern keeper', R, 'sentinel', 'Selected sentinel: ceramic shield arm and one simple eye slit.', [pick('395884ff-9eec-4903-ba5c-e910310ff88d', 0)]),
  concept('boar', 'Clay-pot boar', M, '', 'Reserved for a separate future enemy. Explicitly not the grunt.', [pick('b9e6a46b-7997-44d3-bf2b-7d182a17d4a9', 3)], 'reserved'),
  concept('dew-gatherer', 'Dew gatherer', M, '', 'Two liked designs: sturdy rounded version and wide-headed version. Roster role remains open; the broad head should read as anatomy, not a hat.', [pick('fee16b22-fbf9-4250-a225-8179ef4fa67d', 1), pick('7e1ddd98-bd37-45c2-8128-61192ea5d24a', 3)]),
  concept('tripod-surveyor', 'Tripod surveyor', R, '', 'Three-legged survey machine. New concept; the existing inspection tripod was marked keep.', [pick('1cb3a983-41de-4c96-9b19-cd143990c114', 3)]),
  concept('plumb-walker', 'Plumb walker', R, '', 'Four-legged version also hearted. Keep as its own option alongside the true tripod.', [pick('ef3b0203-c81d-4f64-bd85-1253a5598144', 1)]),
  concept('kiln-beetle', 'Kiln beetle', R, '', 'Four-legged ceramic machine with a compact heat vent.', [pick('d83c3f89-4602-41ca-a8e5-bad7f9ce5a5f', 1)]),
  concept('compass-warden', 'Compass warden', R, '', 'Floating robot with a compact body and simple eye. New concept; existing drone retained.', [pick('c397331d-8fc5-470e-bbbb-6cd4e453ada9', 0)]),
  concept('puff-keeper', 'Puff keeper', M, '', 'Floating organic creature: body is the gas chamber, with no dangling limbs.', [pick('7ae3347a-d68f-4d71-928a-cab8ec66cff2', 1)]),
  concept('shovel-mole', 'Shovel mole', A, '', 'Selected mole plus spade direction; broad forepaws dig through mineral crust.', [pick('57f66563-892d-4373-a2d6-83c631e7e9b0', 1)]),
  concept('cistern-ram', 'Cistern ram', A, '', 'Selected ram plus water jar direction. Strengthen the lower legs when preparing the model.', [pick('ea19bfb0-518c-4868-b2f5-41db51095ec8', 1)]),
  concept('pebble-hare', 'Pebble hare', A, '', 'Selected hopping animal with a smooth pebble-like body and broad paws.', [pick('31d4e042-743f-422b-a815-95c153d539fc', 2)]),
  concept('seed-splitter', 'Seed splitter', M, '', 'Selected biped seed-eater with a broad nutcracker jaw.', [pick('c0860859-bd12-43ff-8228-782a68ec39fd', 1)]),
];


// Alternatives to models the author marked Keep; no replacement is approved yet.
export const KEEP_EXPLORATIONS = [
  {
    "type": "skitter",
    "name": "Seedpod skitter",
    "family": "Fantastical animals",
    "note": "Beetle plus seedpod: keep the small scuttling role, simplify the shell and strengthen the legs.",
    "job": "711f83a4-63bc-4576-b299-458c14ce5bac",
    "selected": [
      1
    ]
  },
  {
    "type": "roller",
    "name": "Pearl roller",
    "family": "Fantastical animals",
    "note": "Snail plus pearl: a smooth round shell and broad muscular foot; retracts to roll. Favour fewer shell lines.",
    "job": "f586ce93-9d9c-4203-a22c-2731075f1065",
    "selected": [
      1
    ]
  },
  {
    "type": "tripod",
    "name": "Inspection tripod",
    "family": "Robots",
    "note": "Inspection lamp plus survey instrument. Retain three-legged locomotion; check the third leg is distinct before choosing.",
    "job": "9bb4fd97-30dd-471d-8ac0-c8da599468ee",
    "selected": [
      0
    ]
  },
  {
    "type": "cart",
    "name": "Crucible walker",
    "family": "Robots",
    "note": "A four-legged crucible alternative to the welding cart, with a compact pouring spout and contained heat chamber.",
    "job": "13ed7341-1960-43e2-8f12-8b8481c2bd68",
    "selected": [
      3
    ]
  },
  {
    "type": "bell",
    "name": "Bell walker",
    "family": "Robots",
    "note": "Approved clean-background bell walker. Earlier backgrounds were rejected as too busy. Bell, arch, clapper and four sturdy legs retained.",
    "job": "b4852320-c23b-4bf7-a8e2-10c9ede8cabd",
    "selected": [
      1
    ],
    "previousJob": "6c6ddcfc-b4eb-4dc9-b218-250b31e8619b"
  },
  {
    "type": "drone",
    "name": "Spool drone",
    "family": "Robots",
    "note": "Floating salvage spool with a compact retrieval nozzle; remove dangling mechanisms and keep the tether role.",
    "job": "e708a0d0-e805-46fd-aee5-4c328202ff41",
    "selected": [
      0
    ]
  },
  {
    "type": "brute",
    "name": "Wood cutter",
    "family": "Robots",
    "note": "Compact forest work robot with a saw forearm, heavy feet and simple clamp hand. Keep equipment close to the body.",
    "job": "a1860f49-ecc5-4922-91f6-94b031e5e9a7",
    "selected": [
      0
    ]
  },
  {
    "type": "shade",
    "name": "Hollow woodsman",
    "family": "Monsters",
    "note": "A hollow seed-husk duelist. The head casing is anatomy; no hood, robe or cape. Keep the feet and joints broad.",
    "job": "91fff498-280d-4229-bae9-e270dee52ba4",
    "selected": [
      3
    ]
  },
  {
    "type": "wisp",
    "name": "Cinder wisp",
    "family": "Monsters",
    "note": "Ember plus flower bud. Four broad petals open around the core; no dangling limbs. Prefer the compact bud silhouettes.",
    "job": "885e3431-b1b8-4db6-ad7b-c772cd14d530",
    "selected": [
      3
    ]
  },
  {
    "type": "mummer",
    "name": "Dune mummer",
    "family": "Monsters",
    "note": "Approved gourd-and-mask troupe member: simple club, broad hands and sturdy feet.",
    "job": "ad94a6b0-55ba-461e-9577-d745036565ae",
    "selected": [
      1
    ]
  },
  {
    "type": "mummerking",
    "name": "Mummer king",
    "family": "Monsters",
    "note": "Larger masked troupe chief with three compact crown lobes, broad hands and a paddle club. Keep its family resemblance to the mummer.",
    "job": "71c2e792-5ceb-40f7-966d-19b12c1b10a6",
    "selected": [
      1
    ]
  },
  {
    "type": "oracle",
    "name": "Pendulum oracle",
    "family": "Robots",
    "note": "Floating ceramic pendulum with simple arms and a ward-signalling chest inset. A compact hovering caster, without long thin attachments.",
    "job": "b4b39e06-0115-4b08-8d3b-1e017919b98c",
    "selected": [
      1
    ]
  },
  {
    "type": "crawler",
    "name": "Survey crawler",
    "family": "Robots",
    "note": "Beetle plus compass: a low ceramic scout on four sturdy legs. Several options add extra legs; four-legged anatomy remains the target.",
    "job": "22d8861b-51c8-4a48-9776-9c45ee542615",
    "selected": [
      0
    ]
  }
];
for (const e of KEEP_EXPLORATIONS) {
  const c = concept(`keep-${e.type}`, e.name, e.family, e.type,
    `${e.selected?.length ? 'Reference approved; current model unchanged.' : 'Comparison for a model marked Keep.'} ${e.note}`,
    (e.selected || []).map((index) => pick(e.job, index)), e.selected?.length ? 'selected' : 'exploring', e.revisionJob || e.job);
  c.comparisonOnly = true;
  c.role = `Alternative for kept ${e.type}`;
  CONCEPTS.push(c);
}

// Confirmed hearts supersede the earlier art, retained as decision history.
const APPROVED_STYLE = {
  shellback: pick('e8102be7-014a-4a03-8150-394a7f722fec', 2),
  'bellows-toad': pick('c5a76758-e908-4034-acc5-7b88452dcb71', 0),
  centipede: pick('616e0bd4-9a63-476b-9485-1e5efda02210', 3),
  'cloud-jelly': pick('0cdfba00-da12-409f-8fd5-03de262f50ca', 1),
  'lamp-moth': pick('5b88e9ea-3cc5-4ea8-ab97-4431bfb5584b', 1),
  'storm-ray': pick('4fc2da68-aa8c-4a93-bc00-5f1795b5e039', 0),
  hound: pick('5d7b275f-a6fd-4e34-a0fe-7c6d4ebc850a', 1),
  'reed-knot': pick('0de92fb6-aa84-4252-b110-fd96a9913888', 1),
  'dune-worm': pick('ca727e90-9d58-49d2-a060-bbbd815e325f', 3),
  fencer: pick('dd52ce4f-1165-4d5c-b09b-a459cf2baa4d', 1),
  boar: pick('221148a3-5cfa-4c0d-a595-7816f210f56e', 3),
  blob: pick('eb43fb37-f063-47ab-9a4f-212ba29d443b', 2),
};
for (const c of CONCEPTS) if (APPROVED_STYLE[c.key]) {
  c.previousSelections = c.selections;
  c.selections = [APPROVED_STYLE[c.key]];
  c.note += ' New style pass approved; supersedes the earlier reference.';
}

// Earlier choices stay visible until the author selects the new style pass.
export const STYLE_PASSES = {};
for (const c of CONCEPTS) if (STYLE_PASSES[c.key]) {
  c.stage = 'revising';
  c.jobUrl = `https://www.midjourney.com/jobs/${STYLE_PASSES[c.key]}?index=0`;
}

export const STAGE_LABELS = { selected: 'Reference selected', shortlist: 'Shortlisted · final choice open', reserved: 'Reserved for later', exploring: 'Awaiting selection', revising: 'New style pass · awaiting selection' };
export const referencesFor = (type) => CONCEPTS.filter((c) => c.type === type);
export const BUILD_LABEL = 'Not implemented';
