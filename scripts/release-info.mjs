// Release metadata for the Android workflow, from the newest entry in src/changelog.js.
//   node scripts/release-info.mjs version   → 0.34
//   node scripts/release-info.mjs notes     → markdown release notes for that version
import { CHANGELOG } from '../src/changelog.js';

const [latest] = CHANGELOG;
const what = process.argv[2] ?? 'version';
if (what === 'version') console.log(latest.v);
else if (what === 'notes') {
  console.log(`Moebius v${latest.v} (${latest.date}) for Android. Download the APK below and open it on the device to install; new versions install over the old one and keep your progress.\n`);
  console.log(latest.items.map((i) => `- ${i}`).join('\n'));
  console.log('\nThe game runs fully offline. Built from the web version that is also playable on GitHub Pages.');
}
