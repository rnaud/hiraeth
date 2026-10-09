// The chimes' icon (docs/systems/items.md, "Chimes"): since October 2026 a small floating crystal, drawn as the
// HUD draws everything, flat colours under a dark ink line. A blunt cyan shard leaning to the right, a pale facet
// where the light catches it, the lavender seam inside (references/Core Objects/Currency/Small Floating Crystal/).
// The HUD's copy is written into index.html (#health .chimes, the same drawing: tests/chimes.test.js checks it);
// the shop panel's prices and wallet and the game menu's wallet use this one.

/** The shard's inside: its faces, the light facet, the seam, the facet lines and the outline (viewBox 0 0 16 16). */
export const CHIME_ICON_PATHS = '<path d="M6.2 1.4L10.6 2.9L12.8 8.5L10.7 14.4L5.9 13.2L3.4 7.1Z" fill="#63d3e4"/>'
  + '<path d="M6.2 1.4L10.6 2.9L8.7 7.5L4.8 6.3Z" fill="#a9eef4"/>'
  + '<path d="M6.4 9.7L10.5 8.9L9.5 11.9L6.7 11.5Z" fill="#b9a7e8"/>'
  + '<path d="M8.7 7.5L10.7 14.4M8.7 7.5L12.8 8.5M4.8 6.3L5.9 13.2" fill="none" stroke="#2b211f" stroke-width="0.7" stroke-linecap="round"/>'
  + '<path d="M6.2 1.4L10.6 2.9L12.8 8.5L10.7 14.4L5.9 13.2L3.4 7.1Z" fill="none" stroke="#2b211f" stroke-width="1.5" stroke-linejoin="round"/>'
  + '<path d="M6.6 3.1l1.9 0.6" fill="none" stroke="#ffffff" stroke-width="1" stroke-linecap="round"/>';

/** The icon as an inline SVG (`cls` its class: the shop panel's `chime-ico`). */
export const chimeIcon = (cls = 'chime-ico') => `<svg class="${cls}" viewBox="0 0 16 16" aria-hidden="true">${CHIME_ICON_PATHS}</svg>`;
