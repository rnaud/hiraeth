/** Presentation only: directions must not turn a catalogue name into acquired knowledge.
 * Callers supply an observed description; a specific story condition may unlock the named label.
 * Neither visiting a world nor opening an unrelated conversation proves that condition.
 */
export function unexploredHint({ hint = 'Someone to talk to', knownWhen = null } = {}, label) {
  if (typeof knownWhen === 'function' && knownWhen() === true) return label;
  const description = typeof hint === 'function' ? hint() : hint;
  return typeof description === 'string' && description.trim() ? description : 'Someone to talk to';
}
