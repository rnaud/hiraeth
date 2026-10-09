// The traveller's printed palette, sampled from the illustrated reference.
// Values are display colours (the game runs with colour management off).
export const TRAVELLER_PALETTE = {
  suit: '#e8ddbf', jacket: '#dc826c', jacketShade: '#bd6e59', glove: '#364443', boot: '#d6c6a6', sole: '#8f7754', radio: '#7eaaa0',
  strap: '#847358', pouch: '#918568', scarf: '#d6b07a', scarfShade: '#c49a62', blue: '#64a99e', skin: '#d9a17e', dark: '#514b40',
  brow: '#35362d', hair: '#292f2a', teal: '#69b8ae', lavender: '#b5a8c1',
  // the canvas rucksack: dusty olive canvas, its lid a shade darker, worn leather straps
  canvas: '#9a936c', canvasShade: '#7f7a5a', leather: '#6f5a43', earpiece: '#5d574a',
  // the fluid glove (traveller.js fluidGlove): its lights (and the cuff's vial) before the tank's tones retint them, the cuff's brass fitting
  gloveLight: '#52c8cf', fitting: '#acaa78',
};

// Imported material name -> palette entry, so separate equipment parts print in the same inks as the suit.
// (The boots' rubber soles print in a sand-brown, like the desert boots of the reference, not a suit's black.)
export const TRAVELLER_TONES = {
  'Traveller peach skin': 'skin', 'Peach face': 'skin', 'Equipment orange leather': 'glove',
  'Equipment dusty pink boots': 'boot', 'Equipment ivory radio': 'radio', 'Equipment tan pouches': 'pouch',
  'Equipment lavender fabric': 'suit', 'Grey scarf': 'scarf', 'Blue headphones': 'blue', 'Equipment rubber soles': 'sole',
};
