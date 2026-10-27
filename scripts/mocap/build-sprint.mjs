#!/usr/bin/env node
// Kevin Iglesias's sprint, converted onto the game's clip skeleton: public/anim/sprint-kevin.glb (the traveller's
// alternative sprint loop, `?sprint=kevin` or the dev menu's switch: src/animator.js sprintSetting, issue #704).
// The source FBX stays out of git (the pack's licence forbids resale of the assets themselves: docs/motion-data.md);
// put HumanM@Sprint01_Forward.fbx from the pack's Animations/Male/Movement/Sprint/ in data/mocap/kevin-iglesias/.
// Same input, same bytes.
//
//   node scripts/mocap/build-sprint.mjs            # -> public/anim/sprint-kevin.glb
//   node scripts/mocap/build-sprint.mjs --from <file.fbx>
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sprintGLB } from './kevin-sprint.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const SRC = args.includes('--from') ? resolve(args[args.indexOf('--from') + 1]) : resolve(ROOT, 'data/mocap/kevin-iglesias/HumanM@Sprint01_Forward.fbx');
const OUT = resolve(ROOT, 'public/anim/sprint-kevin.glb');
const ab = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);

const ual = await new GLTFLoader().parseAsync(ab(await readFile(resolve(ROOT, 'public/anim/ual.glb'))), '');
const { bytes, info, n } = sprintGLB(ab(await readFile(SRC)), ual.scene);
await writeFile(OUT, bytes);
console.log(`${OUT}: ${(bytes.length / 1024).toFixed(1)} KB, ${n} frames at ${info.fps} fps (scale ${info.scale}, loop closed by ${(info.closed * 180 / Math.PI).toFixed(1)}°, pelvis drift ${(info.drift * 100).toFixed(1)} cm)`);
