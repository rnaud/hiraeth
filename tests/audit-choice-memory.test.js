import test from 'node:test';
import assert from 'node:assert/strict';
import { tokenList, tokenLine, choicesMade, choiceLines, ilenOnChoices } from '../src/story/ending.js';
import { keepsakeFor } from '../src/story/perdide2-data.js';

test('Hollin’s keepsake never invents a promise when the player declined', () => {
  const flags={'perdide2.promise':'maybe'};
  const token=tokenList([keepsakeFor('maybe')])[0];
  assert.ok(token);
  assert.doesNotMatch(tokenLine(token).text,/you promised/i);
  const choice=choicesMade(key=>flags[key]);
  assert.equal(choice.promise,'declined');
  assert.match(choiceLines(choice).map(l=>l.text).join(' '),/wouldn’t promise/);
  assert.match(ilenOnChoices(choice).map(l=>l.text).join(' '),/wouldn’t promise/);
});

test('keeping the visit promise does not invent delivery of Odile and Talo’s news', () => {
  for(const found of [false,true]) {
    const flags={'perdide2.promise':'yes','perdide2.promise.kept':true,'perdide2.hollin.found':found};
    const choice=choicesMade(key=>flags[key]);
    const lines=ilenOnChoices(choice).map(l=>l.text).join(' ');
    assert.equal(choice.promise,'kept');
    assert.match(lines,/went back to the deep wood/);
    if(!found)assert.doesNotMatch(lines,/Hollin knows where Odile and Talo/);
    assert.match(tokenLine(tokenList([keepsakeFor('yes')])[0]).text,/Hollin/);
  }
  const made=choicesMade(key=>key==='perdide2.promise'?'yes':undefined);
  assert.match(ilenOnChoices(made).map(l=>l.text).join(' '),/still owes/);
});
