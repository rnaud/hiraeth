# The ship's two consoles: the voicemail and the holo table

Code: `src/ship/ship.js` (use, hud, blinkVoicemail), `src/ship/interior.js` (VOICEMAIL, TABLE_R),
`src/ship/starmap.js` (consoleAction), `src/ship/portrait.js` (the screen over the dash).

- **The voicemail** is the cockpit dash. Standing at it (CONSOLE_R of the cockpit point) the prompt
  is `E voicemail`. E plays the waiting message (`pendingCall`, src/story/calls.js) as before, the
  parents rising over the projector; with none waiting the ship says "No new messages."
- **The voicemail button** sits at the front of the dash, right of the pilot's seat: a lamp in a brass
  ring on a small box (material `vmail`), with a pool of light on the dash under it (`vmailHalo`)
  and a local light. While a message waits it pulses (`voicemailBlink`, a beat every 1.6 s) and the
  round screen above the dash glows with "1 NEW MESSAGE", so it reads from across the deck.
  `Ship.messageWaiting()` says which ship blinks: during a scene, the scene's own `waiting()`
  (the prologue's orbiting ship until its message plays), otherwise the parked ship while a message
  is pending.
- **The holo table** in the middle of the deck (within TABLE_R of the centre) opens the galactic map:
  `E galactic map`, or shown but locked without `ship.powered`. A waiting message never keeps the
  map shut; the blinking button is the only nudge. Taking off cuts to a shot across the table.
- **The prologue's walk** has no guide on the floor and no hint. The letterbox lifts while you walk;
  at the console `Prologue.prompt()` gives `E voicemail` and `Prologue.use()` (E, routed through
  `Ship.input` while the scene is interactive) starts the father's message.
- **Wording**: nothing the player is shown calls these recordings until the messages give their age
  away (the third ends "Recording logged nineteen years ago"). Messages 1 to 3 open with "New
  message." and end "End of message."; from REEL_FROM (4) on he asks the reel for the world's word.

Arrivals (`ArrivalDirector`, src/ship/cinematics.js) are landings: the ship levels out and brakes
into the air, a soft white through the clouds, comes down upright on its jets and settles at rest
(`landingK`) with dust and foot puffs, no fire, no shaking (`tests/cutscenes.test.js`). Only the
prologue crashes.
