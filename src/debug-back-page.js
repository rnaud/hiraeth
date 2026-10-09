// A debug page's "◀ Debug" button (src/debug-back.js), from its <body data-debug-back data-debug-busy>.
import { installDebugBack, debugBackOptions } from './debug-back.js';

const body = document.body, busySel = body.dataset.debugBusy;
installDebugBack({ ...debugBackOptions(body.dataset.debugBack), busy: busySel ? () => !!document.querySelector(busySel) : () => false });
