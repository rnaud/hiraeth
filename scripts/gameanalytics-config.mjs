// SDK ingestion configuration for the Unity builder container. Never print values.
import { writeFileSync } from 'node:fs';
const fields = { androidGameKey: 'GAMEANALYTICS_ANDROID_GAME_KEY', androidSecretKey: 'GAMEANALYTICS_ANDROID_SECRET_KEY', linuxGameKey: 'GAMEANALYTICS_LINUX_GAME_KEY', linuxSecretKey: 'GAMEANALYTICS_LINUX_SECRET_KEY' };
const config = Object.fromEntries(Object.entries(fields).map(([field, variable]) => [field, process.env[variable] ?? '']));
for (const [field, value] of Object.entries(config)) {
  if (value && !new RegExp(`^[a-f0-9]{${field.endsWith('GameKey') ? 32 : 40}}$`, 'i').test(value)) throw Error(`Invalid GameAnalytics ${field}; value withheld`);
}
writeFileSync(new URL('../unity/Hiraeth/.gameanalytics-build.json', import.meta.url), JSON.stringify(config), { mode: 0o600 });
console.log('GameAnalytics build configuration written (credential values withheld).');
