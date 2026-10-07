// The galactic map's planets: small drawn discs in flat colours, inked like
// a comic panel (no screenshots of the worlds). Each world has a body colour,
// a flat shadow crescent, and one mark of its own: dune stripes, cloud bands,
// craters, a ring, a moon, a few lit windows.
//
// planetSvg(id) returns an <svg> string (viewBox -50..50, the ring and the
// moon may overhang it); it is pure, so the tests can call it.

const INK = '#2b211f', CREAM = '#f7ecd2';

/** body, shadow, the mark's colour, and the mark. */
export const PLANETS = {
  desert:   { body: '#e9b864', shade: '#c4864a', ink: '#f6d792', mark: 'dunes' },
  incal:    { body: '#9289c9', shade: '#625a9a', ink: '#c3bbec', mark: 'bands' },
  arzach:   { body: '#f1e9d6', shade: '#cdbf9f', ink: '#d6c8a8', mark: 'craters' },
  arzach2:  { body: '#f0c9ae', shade: '#cc9a80', ink: CREAM, mark: 'ring' },
  garage:   { body: '#5fb7ad', shade: '#3c8780', ink: '#f2c54b', mark: 'ring' },
  buried:   { body: '#c8643f', shade: '#913f29', ink: '#e8956a', mark: 'craters' },
  edena:    { body: '#8acb8f', shade: '#5a9763', ink: '#e9f3c9', mark: 'lands' },
  spheres:  { body: '#cfe5ea', shade: '#97bdc8', ink: CREAM, mark: 'moon' },
  perdide:  { body: '#6f5c9c', shade: '#4a3c72', ink: '#9fe0d6', mark: 'lights' },
  perdide2: { body: '#9064ad', shade: '#64457f', ink: '#c497d8', mark: 'bands' },
  bazaar:   { body: '#e6875f', shade: '#b35d3f', ink: '#f2c54b', mark: 'lights' },
  mangrove: { body: '#3a3f78', shade: '#262a56', ink: '#f2e8f2', mark: 'lights' },
  glassdunes: { body: '#8fdcae', shade: '#4f9c86', ink: '#e4f6b0', mark: 'dunes' },   // (a detour: glass dunes)
  waterfall: { body: '#6fc9cc', shade: '#3f8f98', ink: '#f1dcbd', mark: 'bands' },
  saltharbour: { body: '#f1e9e0', shade: '#b9c4dc', ink: '#c4664a', mark: 'bands' },
  antennas: { body: '#a98cd8', shade: '#7e68b2', ink: '#f1e6a2', mark: 'lights' },
  underwater: { body: '#2a7fae', shade: '#164f74', ink: '#f2a48e', mark: 'lights' },   // (a detour: the city on the sea floor)
  eclipse: { body: '#1c2244', shade: '#0e1128', ink: '#ffe2c8', mark: 'lights' },   // (a detour: the city under the black sun)
  fallenring: { body: '#9c9e58', shade: '#6a7a52', ink: '#f8e6c8', mark: 'bands' },   // (a detour: the fallen ring)
};
const DEFAULT = { body: '#9aa3c7', shade: '#6b739a', ink: CREAM, mark: 'craters' };

const MARKS = {
  dunes: (c) => [-24, -6, 12, 28].map((y, i) => `<path d="M-50 ${y} q 12 -7 25 0 t 25 0 t 25 0 t 25 0" fill="none" stroke="${c}" stroke-width="${5 - i * 0.6}" stroke-linecap="round"/>`).join(''),
  bands: (c) => `<rect x="-50" y="-26" width="100" height="9" fill="${c}"/><rect x="-50" y="-4" width="100" height="5" fill="${c}"/><rect x="-50" y="14" width="100" height="11" fill="${c}"/>`,
  craters: (c) => [[-18, -16, 9], [14, -4, 6], [-6, 18, 7], [20, 20, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="${INK}" stroke-width="1.6"/>`).join(''),
  lands: (c) => `<path d="M-30 -22 q 14 -10 26 0 q 6 10 -6 14 q -16 4 -20 -14z M6 6 q 16 -6 24 6 q 2 14 -14 14 q -12 -4 -10 -20z" fill="${c}" stroke="${INK}" stroke-width="1.6"/>`,
  lights: (c) => [[-20, -12], [-6, -22], [8, -10], [-14, 8], [18, 6], [2, 18], [-28, 22]].map(([x, y]) => `<rect x="${x - 2.5}" y="${y - 2.5}" width="5" height="5" fill="${c}"/>`).join(''),
  ring: () => '', moon: () => '',
};

/** The world's planet, as an inline SVG string. */
export function planetSvg(id, { cls = 'planet' } = {}) {
  const p = PLANETS[id] ?? DEFAULT, k = `pl-${id}`;
  const ringBack = p.mark === 'ring' ? `<path d="M-72 0 A72 18 0 0 1 72 0" transform="rotate(-18)" fill="none" stroke="${p.ink}" stroke-width="6"/>` : '';
  const ringFront = p.mark === 'ring' ? `<path d="M72 0 A72 18 0 0 1 -72 0" transform="rotate(-18)" fill="none" stroke="${INK}" stroke-width="9"/><path d="M72 0 A72 18 0 0 1 -72 0" transform="rotate(-18)" fill="none" stroke="${p.ink}" stroke-width="5.5"/>` : '';
  const moon = p.mark === 'moon' ? `<circle cx="44" cy="-40" r="11" fill="${p.ink}" stroke="${INK}" stroke-width="3"/>` : '';
  return `<svg class="${cls}" viewBox="-50 -50 100 100" aria-hidden="true">
    <defs><clipPath id="${k}"><circle r="46"/></clipPath></defs>
    ${ringBack}
    <circle r="46" fill="${p.shade}"/>
    <g clip-path="url(#${k})">
      <circle cx="-9" cy="-8" r="47" fill="${p.body}"/>
      ${MARKS[p.mark]?.(p.ink) ?? ''}
      <path d="M-30 -24 A 38 38 0 0 1 -6 -38" fill="none" stroke="${CREAM}" stroke-width="4" stroke-linecap="round" opacity=".9"/>
    </g>
    <circle r="46" fill="none" stroke="${INK}" stroke-width="4"/>
    ${ringFront}${moon}
  </svg>`;
}
