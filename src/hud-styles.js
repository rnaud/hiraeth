// Register presentation before gameplay starts; components still install styles lazily in their original order.
import { registerStyles } from './ui-style-registry.js';
import css0 from './hud-styles/box-card.js';
import css1 from './hud-styles/gadget.js';
import css2 from './hud-styles/spell.js';
import css3 from './hud-styles/charge.js';
import css4 from './hud-styles/cinema.js';
import css5 from './hud-styles/fishing.js';
import css6 from './hud-styles/sketchhunt.js';
import css7 from './hud-styles/labels.js';
import css8 from './hud-styles/drums.js';
registerStyles({
  'boxcard-css': css0,
  'gadget-css': css1,
  'spell-css': css2,
  'charge-card-css': css3,
  'cine-css': css4,
  'fishing-css': css5,
  'hunt-css': css6,
  'mg-words-css': css7,
  'drum-label': css8,
});
