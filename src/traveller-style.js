// The traveller's printed palette, sampled from the illustrated reference.
// Values are display colours (the game runs with colour management off).
export const TRAVELLER_PALETTE = {
  suit: '#ccb3d4', glove: '#ea835e', boot: '#e09a8a', radio: '#e7d4b4',
  strap: '#d2b49a', pouch: '#cd884c', scarf: '#aba4b4', blue: '#3b6297', skin: '#eaa996', dark: '#4a4150', brow: '#6b4a3a', liner: '#8e889c',
};

// Imported material name -> palette entry, so separate equipment parts print in the same inks as the suit.
export const TRAVELLER_TONES = {
  'Traveller peach skin': 'skin', 'Peach face': 'skin', 'Equipment orange leather': 'glove',
  'Equipment dusty pink boots': 'boot', 'Equipment ivory radio': 'radio', 'Equipment tan pouches': 'pouch',
  'Equipment lavender fabric': 'suit', 'Grey scarf': 'scarf', 'Blue headphones': 'blue', 'Equipment rubber soles': 'dark',
};
