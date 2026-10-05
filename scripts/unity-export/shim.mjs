// A little DOM so the desert can be built in Node (the same stub the tests use:
// tests/desert-story.test.js). The story only touches the page for speech balloons.
// a 2D context that takes every call and draws nothing (the ship's painted panels stay blank)
const ctx2d = new Proxy(function () {}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' || k === 'createImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : ctx2d), set: () => true, apply: () => ctx2d });
const el = () => ({
  getContext: () => ctx2d, width: 1, height: 1,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
  style: {}, dataset: {}, remove() {}, addEventListener() {}, removeEventListener() {},
  querySelector: () => el(), querySelectorAll: () => [], appendChild() {}, append() {}, setAttribute() {}, insertAdjacentHTML() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1, height: 1 }),
  set textContent(v) {}, set innerHTML(v) {},
});
globalThis.document ??= { createElement: el, body: el(), head: el(), getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener() {} };
globalThis.window ??= globalThis;
globalThis.addEventListener ??= () => {};
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {} };
