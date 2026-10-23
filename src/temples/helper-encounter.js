import { slots } from '../save-slots.js';
// The two helping encounters keep arcade scores separate from story completion.
// This record lives in GameState, hence in the selected save slot. A URL alone
// cannot award progress: its token must match a started encounter and a goal result.
export const HELPER_ENCOUNTERS = {
  desert: { game: 'cistern', prompt: 'help the Keeper', returnLabel: 'Return to the Keeper' },
  arzach: { game: 'elderflight', prompt: 'fly with the Elder', returnLabel: 'Return to the Aerie' },
};
export const HELPER_KEY = 'temple.helper.pending';
const SERIAL_KEY = 'temple.helper.serial';
// UUID where available; the engine VM also has time and independent random words.
// Slot binding below is checked separately, so identity is never only a counter.
const nonce = () => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Array.from({ length: 4 }, () => (Math.random() * 0x100000000 >>> 0).toString(36)).join('-')}`;
const finished = (game, id) => !!game.flag(`temple.${id}.done`) || game.flag(`temple.${id}.boss`) === 'done';
const vector = (v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite) ? [...v] : null;
const pose = (p) => {
  const pos = vector(p?.pos), up = vector(p?.up), fwd = vector(p?.fwd);
  return pos && up && fwd && Math.hypot(...up) > .5 && Math.hypot(...fwd) > .5 ? { pos, up, fwd } : null;
};
const pending = (game) => {
  const r = game.flag(HELPER_KEY), def = r && HELPER_ENCOUNTERS[r.temple];
  return r?.v === 1 && def?.game === r.game && typeof r.token === 'string' && typeof r.slot === 'string'
    && typeof r.from === 'string' && pose(r.returnPose) ? r : null;
};

/** Called only by the unresolved guardian's explicit interaction. */
export function beginHelperEncounter(game, temple, { from, returnPose, slot = slots.active } = {}) {
  const def = HELPER_ENCOUNTERS[temple], origin = pose(returnPose);
  if (!def || finished(game, temple) || !origin || typeof from !== 'string' || !from) return null;
  const old = game.flag(SERIAL_KEY), serial = (Number.isSafeInteger(old) && old >= 0 ? old : 0) + 1;
  const token = `${String(slot)}:${temple}:${serial}:${nonce()}`;
  game.set(SERIAL_KEY, serial);
  game.set(HELPER_KEY, { v: 1, temple, game: def.game, token, slot: String(slot), from, returnPose: origin,
    seed: Math.imul(serial, 2654435761) >>> 0, success: false, returning: false });
  return `?game=${def.game}&from=${encodeURIComponent(from)}&encounter=${encodeURIComponent(token)}`;
}

/** One game-page host, used by the browser and engine runner alike. */
export function helperRun(game, gameId, token, { slot = () => slots.active } = {}) {
  const initial = pending(game), originSlot = String(slot());
  if (!initial || initial.game !== gameId || initial.token !== token || initial.returning || initial.slot !== originSlot) return null;
  const def = HELPER_ENCOUNTERS[initial.temple];
  const current = () => { const r = pending(game); return String(slot()) === originSlot && r?.slot === originSlot && r.token === token && r.game === gameId ? r : null; };
  const href = `?level=${encodeURIComponent(initial.from)}`;
  return {
    context: { temple: initial.temple, seed: initial.seed },
    links: { quit: { label: def.returnLabel, href }, win: { label: def.returnLabel, href, hint: 'return' } },
    onResult(result) {
      const r = current();
      if (!r || r.returning || r.success || result?.failed || result?.goal?.game !== gameId || result.goal.complete !== true) return false;
      game.set(HELPER_KEY, { ...r, success: true });
      return true;
    },
    left() {
      const r = current();
      if (r) game.set(HELPER_KEY, { ...r, returning: true });
    },
  };
}

/**
 * The world's first live frame restores the arena pose before its existing finale.
 * If the page closed after a genuine win, that win is still consumable. Resolve
 * before clearing: a crash between them cannot lose the win or pay it twice.
 */
export function consumeHelperReturn(game, temple, world, { restore, resolve, slot = slots.active } = {}) {
  const r = pending(game);
  if (!r || r.slot !== String(slot) || r.temple !== temple || r.from !== world || (!r.returning && !r.success)) return null;
  restore?.(pose(r.returnPose));
  if (r.success && !game.flag(`temple.${temple}.done`)) {
    resolve?.();
    if (!game.flag(`temple.${temple}.done`)) return null;
  }
  game.set(HELPER_KEY, null);
  return { success: r.success, temple, token: r.token };
}
