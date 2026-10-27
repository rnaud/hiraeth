import { fileURLToPath } from 'node:url';

/** The pages built (tests/studio.test.js checks the studio is one, tests/motion-page.test.js the Motion page). */
export const BUILD_INPUT = {
  analytics: fileURLToPath(new URL('../analytics.html', import.meta.url)),
  'caravan-review': fileURLToPath(new URL('../caravan-review.html', import.meta.url)),
  notes: fileURLToPath(new URL('../notes.html', import.meta.url)),
  cinematics: fileURLToPath(new URL('../cinematics.html', import.meta.url)),
  enemies: fileURLToPath(new URL('../enemies.html', import.meta.url)),
  main: fileURLToPath(new URL('../index.html', import.meta.url)),
  studio: fileURLToPath(new URL('../studio.html', import.meta.url)),
  trailer: fileURLToPath(new URL('../trailer.html', import.meta.url)),
  motion: fileURLToPath(new URL('../motion.html', import.meta.url)),
  // the interactive changelog (src/changelog-page/; its pictures, changelog-media/, are the site's alone)
  changelog: fileURLToPath(new URL('../changelog.html', import.meta.url)),
  // the items to review (src/items-page/: each item's picture, what it does, where it is found)
  items: fileURLToPath(new URL('../items.html', import.meta.url)),
  // the audit reports and their scores (src/audits-page/; the data and the pictures, audits/, are the site's alone)
  audits: fileURLToPath(new URL('../audits.html', import.meta.url)),
  // the references page (src/references-page/; its index, thumbnails and web-size copies, dist/references/, are
  // the site's alone: the deploy writes them, scripts/references-site.mjs)
  references: fileURLToPath(new URL('../references.html', import.meta.url)),
  // the lore page (src/lore-page/: the story, the traveller, the worlds, temples, guardians and gadgets from the game's
  // data, scripts/lore-data.mjs; a Note on every part; its pictures, public/lore-pictures/, are the site's alone)
  lore: fileURLToPath(new URL('../lore.html', import.meta.url)),
  // the music page (src/music-page/: every song, recorded and procedural, and every sound effect, each with a Note)
  soundEffects: fileURLToPath(new URL('../sound-effects.html', import.meta.url)),
  music: fileURLToPath(new URL('../music.html', import.meta.url)),
  // the serendipity map (src/serendipity-page/: a world in 3D with every thing of interest on it by kind, issue #381)
  serendipity: fileURLToPath(new URL('../serendipity.html', import.meta.url)),
  // the temple maps (src/temple-maps/: each temple's plan, lock-and-key graph, solution and numbers, issue #396)
  temples: fileURLToPath(new URL('../temples.html', import.meta.url)),
  // the outfits test page (issue #540: the game with the Blender traveller and an outfit picker; it opens
  // index.html?outfits=, src/characters/outfit-page.js; its models, data/characters/traveller-v2/, copied into the
  // build by travellerV2Plugin)
  outfits: fileURLToPath(new URL('../outfits.html', import.meta.url)),
  // the outfits gallery (issue #549: every outfit on the v2 traveller side by side, live, src/outfits-gallery/; its
  // models, data/characters/traveller-v2/, copied into the build by travellerV2Plugin)
  'outfits-gallery': fileURLToPath(new URL('../outfits-gallery.html', import.meta.url)),
};
