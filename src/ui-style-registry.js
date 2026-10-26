// Browser bootstrap supplies presentation. Headless and native consumers only publish HUD state.
const styles = new Map();
export function registerStyles(entries) {
  for (const [id, css] of Object.entries(entries)) {
    if (typeof css !== 'string') throw new TypeError(`Invalid style: ${id}`);
    styles.set(id, css);
  }
}
export const styleText = (id) => styles.get(id) ?? '';
