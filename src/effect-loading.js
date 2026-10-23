// Recoverable preparation is independent of title activation and never starts an audio graph.
export async function prepareSoundWithRetry(sound, { message, onProgress, onFailure, onBack, signal } = {}) {
  let retry = false;
  const cancelled = () => new DOMException('Sound preparation cancelled', 'AbortError');
  for (;;) {
    if (signal?.aborted) throw cancelled();
    try {
      const result = await sound.prepareEffects({ retry, onProgress });
      if (signal?.aborted) throw cancelled();
      return result;
    } catch (error) {
      if (error.name === 'AbortError') throw error;
      console.error('[effects] preparation failed', error.failures ?? error);
      onFailure?.(error);
      if (!globalThis.document?.createElement) throw error;
      // The world loader is behind the title. A top-layer dialog remains reachable in both entry flows.
      const panel = document.createElement('dialog');
      panel.setAttribute('aria-label', 'Sound effects');
      panel.setAttribute('data-effect-loading', '');
      const text = document.createElement('p'); text.textContent = 'Sound effects couldn’t load.';
      const controls = document.createElement('div');
      const again = document.createElement('button'); again.textContent = 'Retry';
      const back = document.createElement('button'); back.textContent = 'Back to title';
      controls.append(again, back); panel.append(text, controls); document.body.append(panel);
      panel.showModal();
      const choice = await new Promise(resolve => {
        const finish = value => { signal?.removeEventListener('abort', abort); panel.close(); panel.remove(); resolve(value); };
        const abort = () => finish('cancel');
        again.addEventListener('click', () => finish('retry'), { once: true });
        back.addEventListener('click', () => finish('back'), { once: true });
        panel.addEventListener('cancel', event => { event.preventDefault(); finish('back'); }, { once: true });
        signal?.addEventListener('abort', abort, { once: true });
        if (signal?.aborted) abort();
      });
      if (choice !== 'retry') { sound.dispose(); if (choice === 'back') onBack?.(); throw cancelled(); }
      if (message) message.removeAttribute('role');
      retry = true;
    }
  }
}
