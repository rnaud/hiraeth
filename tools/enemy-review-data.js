import { ARCHETYPES, skinned } from '../src/enemies/archetypes.js';
import { SKINS, HOME_SKIN } from '../src/enemies/skins.js';
import { OUT_OF_PLAY, WORLDS, worldArchetypes } from '../src/foe-worlds.js';
import { TITLES } from '../src/levels/names.js';
import { CONCEPTS } from './enemy-review-references.js';
export { CONCEPTS };

export const STATES = ['undecided', 'keep', 'rework', 'dismiss'];
export const LABELS = { creature: 'Fantastical animals', machine: 'Robots', spirit: 'Monsters', monster: 'Monsters' };
export const STORAGE_KEY = 'hiraeth-enemy-review-v1';
export const CATALOG = Object.entries(ARCHETYPES).flatMap(([type, a]) => Object.entries(SKINS[type] || {}).map(([world, skin]) => ({
  id: skinned(a.kind, world), type, world, name: skin.name, archetype: a.name, family: LABELS[a.family], role: a.role,
  home: world === HOME_SKIN[type], worldName: TITLES[world] || world,
  retired: OUT_OF_PLAY.includes(type), placed: !!WORLDS[world] && worldArchetypes(world).includes(type),
}))).filter((r) => ARCHETYPES[r.type].status === 'built');
export const REVIEW_ROWS = [...CATALOG, ...CONCEPTS];

export function decisionFor(records, row) {
  return records[row.id] || (row.id.startsWith('concept:')
    ? { status: row.selections.length ? 'keep' : 'undecided', note: '' }
    : row.type === 'heron'
    ? { status: 'dismiss', note: 'No birds — excluded from the new direction.' }
    : { status: 'undecided', note: '' });
}

/** Validate the complete file before merging; imported notes never become HTML. */
export function readReview(value) {
  if (!value || value.version !== 1 || !value.decisions || Array.isArray(value.decisions) || typeof value.decisions !== 'object') throw Error('Choose a Hiraeth enemy review JSON export.');
  const ids = new Set(REVIEW_ROWS.map((r) => r.id)), records = {};
  for (const [id, entry] of Object.entries(value.decisions)) {
    if (!ids.has(id)) throw Error(`Unknown enemy appearance: ${id}`);
    if (!entry || !STATES.includes(entry.status) || typeof entry.note !== 'string' || entry.note.length > 10000) throw Error(`Invalid decision for ${id}`);
    records[id] = { status: entry.status, note: entry.note };
  }
  return records;
}

export function exportReview(records) {
  return { version: 1, exportedAt: new Date().toISOString(), decisions: Object.fromEntries(REVIEW_ROWS.map((r) => [r.id, decisionFor(records, r)])), references: CONCEPTS.map(({ id, name, type, newEnemy, stage, selections, previousSelections, comparisonOnly, note, jobUrl }) => ({ id, name, type, newEnemy, stage, selections, previousSelections, comparisonOnly, note, jobUrl, implemented: false })) };
}

export function filterRows({ view = 'existing', world = 'home', family = '', status = '', search = '' }, records) {
  const q = search.toLowerCase().trim();
  const source = view === 'existing' ? CATALOG : CONCEPTS.filter((r) => (view !== 'new' || r.newEnemy) && (view !== 'kept' || r.comparisonOnly));
  return source.filter((r) => (view !== 'existing' || world === 'all' || (world === 'home' ? r.home : r.world === world))
    && (!family || r.family === family) && (!status || decisionFor(records, r).status === status)
    && (!q || `${r.name} ${r.archetype || ''} ${r.worldName || ''} ${r.role} ${r.note || ''}`.toLowerCase().includes(q)));
}
