import { HOSTS } from './hosts-data.js';

// Kamal owns the salvage, but only the traveller's fluid tank can power it.
// A loss records his claim; he lends the tank back for a rematch, so the wager
// cannot strand a story save without its essential tool.
export function bikeWager({ race, practice, fuelled }) {
  return {
    ...HOSTS.canyon,
    title: 'who found the hoverbike',
    prompt: 'talk to Kamal',
    talk: {
      entry: [
        { if: { flag: 'desert.bike.found' }, node: 'won' },
        { if: { flag: 'desert.bike.race.debt' }, node: 'rematch' },
        { if: { flag: 'desert.bike.race.offered' }, node: 'wager' },
        { node: 'salvage' },
      ],
      nodes: {
        salvage: {
          say: ['~neutral~ Found it under the sand. Never managed to wake it.',
            { text: '~curious~ That fluid tank on your back… I think that would do it.', if: { flag: 'item.backpack' } },
            { text: '~neutral~ It needs a traveller’s fluid tank. I haven’t got one.', if: { not: { flag: 'item.backpack' } } }],
          choices: [{ text: '~curious~ Then can I take it?', goto: 'wager' }, { text: '~neutral~ I’ll come back.', end: true }],
        },
        wager: {
          do: { set: { 'desert.bike.race.offered': true } },
          say: ['~playful~ Take it? I dug it out. Race me for it.', '~neutral~ You ride the salvage. I ride my fan sled. You win, the bike is yours. I win, I keep the bike and your backpack.'],
          choices: [
            { text: '~playful~ One lap. You’re on.', if: fuelled, do: race, end: true },
            { text: '~neutral~ I need fluid first.', if: () => !fuelled(), goto: 'fuel' },
            { text: '~neutral~ Not yet.', end: true },
          ],
        },
        fuel: { say: ['~neutral~ It needs a filled fluid tank. The sled has its own motor; the bike doesn’t.'] },
        rematch: {
          say: ['~playful~ The bike and tank are mine. Unless you win them back.', '~neutral~ Keep the tank on loan until we settle this. Another lap?'],
          choices: [{ text: '~playful~ I’m winning them back.', if: fuelled, do: race, end: true }, { text: '~neutral~ I’ll be back.', end: true }],
        },
        won: {
          say: ['~happy~ Fair win. Your bike, your backpack.', '~playful~ Fancy a longer run? Three laps through the Two Chasms. No wager.'],
          choices: [{ text: '~happy~ Let’s ride.', do: practice, end: true }, { text: '~neutral~ Another time.', end: true }],
        },
      },
    },
  };
}
