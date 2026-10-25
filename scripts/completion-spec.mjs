// Print what finishing Hiraeth takes, derived from the game's data (tests/completion-spec.js; issue #670).
//   node scripts/completion-spec.mjs          Markdown
//   node scripts/completion-spec.mjs --json   the spec as JSON
await import('../tests/register-gadgets.js');
const { completionSpec, specMarkdown } = await import('../tests/completion-spec.js');
const spec = completionSpec();
console.log(process.argv.includes('--json') ? JSON.stringify(spec, null, 2) : specMarkdown(spec));
process.exitCode = spec.problems.length ? 1 : 0;
