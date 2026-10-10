// The build after the version on the title (src/title.js), to tell which one a device runs.
/** The build after the version, to tell which one a device runs (vite.config.js __HIRAETH_BUILD__; nothing under node). */
export function buildLabel(info = (() => { try { return typeof __HIRAETH_BUILD__ === 'object' && __HIRAETH_BUILD__ ? __HIRAETH_BUILD__ : {}; } catch { return {}; } })()) {   // eslint-disable-line no-undef
  return `${info.build ? ` · build ${info.build}` : ''}${info.commit ? ` · ${String(info.commit).slice(0, 7)}` : ''}`;
}
