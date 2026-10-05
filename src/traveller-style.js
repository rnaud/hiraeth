// The traveller's printed palette, sampled from the illustrated reference.
// Values are display colours (the game runs with colour management off).
export const TRAVELLER_PALETTE = {
  suit: '#e8ddbf', jacket: '#dc826c', jacketShade: '#bd6e59', glove: '#364443', boot: '#c8b796', radio: '#7eaaa0',
  strap: '#847358', pouch: '#918568', scarf: '#ceb891', blue: '#64a99e', skin: '#d9a17e', dark: '#514b40',
  brow: '#35362d', hair: '#292f2a', teal: '#69b8ae', lavender: '#b5a8c1',
};

// Imported material name -> palette entry, so separate equipment parts print in the same inks as the suit.
export const TRAVELLER_TONES = {
  'Traveller peach skin': 'skin', 'Peach face': 'skin', 'Equipment orange leather': 'glove',
  'Equipment dusty pink boots': 'boot', 'Equipment ivory radio': 'radio', 'Equipment tan pouches': 'pouch',
  'Equipment lavender fabric': 'suit', 'Grey scarf': 'scarf', 'Blue headphones': 'blue', 'Equipment rubber soles': 'dark',
};
