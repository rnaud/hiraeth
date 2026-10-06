// Rewrites godot/project.godot's [shader_globals] section from engine/ink-params.js GLOBALS (the
// look the bridge sends each frame): node scripts/godot-globals.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shaderGlobalsIni } from '../engine/ink-params.js';

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../godot/project.godot');
const text = readFileSync(file, 'utf8');
const start = text.indexOf('[shader_globals]');
const rest = start < 0 ? '' : text.slice(start).replace(/^\[shader_globals\][\s\S]*?(?=^\[|(?![\s\S]))/m, '');
const head = start < 0 ? text : text.slice(0, start);
writeFileSync(file, `${head.trimEnd()}\n\n${shaderGlobalsIni()}${rest ? `\n${rest}` : ''}`);
console.log('wrote', file);
