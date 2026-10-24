// Minimal DOM surface for NPC constructors in pure gameplay tests. Existing real
// or richer test DOMs keep ownership; this never supplies a renderer or body.
export function ensureNpcDom() {
  if (globalThis.document) return;
  const element = () => ({
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    style: {}, dataset: {}, remove() {}, addEventListener() {},
    querySelector: () => null, appendChild() {},
  });
  globalThis.document = { createElement: element, body: element(), getElementById: () => null, querySelector: () => null };
}
