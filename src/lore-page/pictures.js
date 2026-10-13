// The lore page's pictures (docs/systems/lore-page.md): the reference picks the game was drawn from, made small by
// scripts/lore-pictures.mjs into public/lore-pictures/<name>.webp (site-only: scripts/web-update.mjs LORE_FILE). The
// worlds use their own thumbnails (public/thumbs/<world>.jpg) and the items theirs (public/item-pictures/<id>.webp).
// tests/lore-page.test.js checks every picture named here is made, and every one the page shows exists.

export const LORE_DIR = 'lore-pictures';

/** name → the original (repository path), the caption. */
export const SOURCES = {
  'traveller-portrait': { from: 'references/main character/Portrait study - 2026-10-12/canonical-portrait.png', caption: 'The traveller: the canonical portrait (October 2026)' },
  'traveller-sheet': { from: 'lore/references/traveller/reference-1.jpg', caption: 'The traveller: the character sheet his look follows' },
  // the guardians (references/guardians/: the reference lab's design sheets; three are the game's own renders)
  'guardian-desert': { from: 'references/guardians/keeper/sheet-1.jpg' },
  'guardian-arzach': { from: 'references/guardians/elder/sheet-1.jpg' },
  'guardian-arzach2': { from: 'references/guardians/cloud-mother/sheet-1.jpg' },
  'guardian-perdide': { from: 'references/guardians/mother-snapper/sheet-1.jpg' },
  'guardian-perdide2': { from: 'references/guardians/lampless/sheet-1.jpg' },
  'guardian-edena': { from: 'references/guardians/gardener/sheet-1.jpg' },
  'guardian-underwater': { from: 'references/guardians/listener/game-render.jpg' },
  'guardian-incal': { from: 'references/guardians/warden/sheet-1.jpg' },
  'guardian-garage': { from: 'references/guardians/foreman/sheet-1.jpg' },
  'guardian-buried': { from: 'references/guardians/tooth-warden/sheet-1.jpg' },
  'guardian-moonfoundry': { from: 'references/guardians/last-founder/game-render.jpg' },
  'guardian-spheres': { from: 'references/guardians/echo/sheet-1.jpg' },
  'guardian-spacecity': { from: 'references/guardians/anchor-warden/game-render.jpg' },
  'guardian-bazaar': { from: 'references/guardians/first-sign/sheet-1.jpg' },
  // the temples (references/temples/: the houses' design sheets; the three newest have none yet, and show their world)
  'temple-desert': { from: 'references/temples/givers-house/sheet-1.jpg' },
  'temple-arzach': { from: 'references/temples/aerie/sheet-1.jpg' },
  'temple-arzach2': { from: 'references/temples/founders-belfry/sheet-1.jpg' },
  'temple-perdide': { from: 'references/temples/hush-house/sheet-1.jpg' },
  'temple-perdide2': { from: 'references/temples/lamp-house/sheet-1.jpg' },
  'temple-edena': { from: 'references/temples/builders-greenhouse/sheet-1.jpg' },
  'temple-incal': { from: 'references/temples/wardens-well/sheet-1.jpg' },
  'temple-garage': { from: 'references/temples/first-garage/sheet-1.jpg' },
  'temple-buried': { from: 'references/temples/engine-house/sheet-1.jpg' },
  'temple-spheres': { from: 'references/temples/footprint/sheet-1.jpg' },
  'temple-bazaar': { from: 'references/temples/undertower/sheet-1.jpg' },
};

/** The page's path to a picture of SOURCES, or null if there is none by that name. */
export const lorePicture = (name) => (Object.hasOwn(SOURCES, name) ? `${LORE_DIR}/${name}.webp` : null);
