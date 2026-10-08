import { registerGadget, GADGETS } from './registry.js';

// Every gadget in this folder, registered (docs/systems/gadgets.md, "Adding a gadget"): each module whose
// default export is a gadget definition ({ id, name, text, use, model, create, ... }). Imported first by
// main.js and the items page (src/items-page/main.js), so the gadgets are items before anything reads
// ITEMS. Vite only (import.meta.glob): node's tests import the gadget modules themselves.
const modules = import.meta.glob(['./*.js', '!./all.js'], { eager: true });
for (const def of Object.values(modules).map((m) => m.default)) if (def && typeof def === 'object' && def.id && typeof def.create === 'function') registerGadget(def);

export { GADGETS };
