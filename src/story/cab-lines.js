// What a cab says (src/story/cab.js; tests/cab-ride.test.js checks each line's tone). Cabs drive themselves: nobody sits up front, and a little
// screen on the dash speaks for the cab, in a small chirping voice (the ship's, src/story/voice.js).
// {stop} is the stop's name.

/** Who speaks: the cab's dash (a world may name a cab of its own: Wren, src/story/incal-data.js). */
export const CAB_VOICE = { id: 'cab', name: 'Cab', title: 'drives itself', voice: 1.25, kind: 'f', lang: 'ship', speaks: true };

export const CAB_LINES = {
  // as you get in (one, in turn)
  where: [
    '~neutral~ (The little screen on the dash lights up.) Where to?',
    '~happy~ (A soft chime from the dash.) Hello, passenger. Where to?',
    '~curious~ (The dash screen blinks awake.) Where shall we go?',
  ],
  // after a cab of its own has had its say (Wren)
  then: '~neutral~ So. Where to?',
  // asked again (SPACE / X / □): waiting at a stop, or on the way
  again: '~neutral~ (The dash screen lights up.) Somewhere else?',
  onTheWay: '~neutral~ (The dash screen lights up.) Change of plan?',
  // your answers besides the stops
  out: '~neutral~ Nowhere, thanks. I’ll get out.',
  carryOn: '~neutral~ No, carry on.',
  stay: '~neutral~ Not yet.',
  // on the way, and there
  going: '~neutral~ {stop}. Sit back.',
  arrive: ['~happy~ {stop}. Mind the step.', '~neutral~ {stop}. Thank you for riding.', '~playful~ {stop}. No doors, no tip. Off you hop.'],
  // it couldn't
  none: '~sad~ (The screen frowns.) I know no clear way there from here. Somewhere else?',
  stuck: '~scared~ (The cab stops dead.) Something is in the way. Where to now?',
  nowhere: '~sad~ (The screen stays blank a moment.) I have nowhere to take you here.',
};
