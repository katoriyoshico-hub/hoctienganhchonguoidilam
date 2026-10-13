import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studyParagraphs,studyTurns,pastedCaptions} from '../youtube-study.js';
test('study formatting preserves caption content without inventing speaker identities',()=>{
  const segments=[{text:'Hello.',offset:0,duration:2},{text:'How are you?',offset:2,duration:3},{text:'Emma: Fine, thanks.',offset:20,duration:3}];
  assert.deepEqual(studyParagraphs(segments).map(p=>p.text),['Hello. How are you?','Emma: Fine, thanks.']);
  const turns=studyTurns(segments);
  assert.equal(turns[0].speaker,'Đoạn nói 1');
  assert.equal(turns[0].identified,false);
  assert.equal(turns[2].speaker,'Emma');
  assert.equal(turns[2].text,'Fine, thanks.');
});
test('pasted transcript and SRT retain actual words and optional timestamps',()=>{
  assert.deepEqual(pastedCaptions('0:05\nHello.\nWelcome.'),[{text:'Hello.',offset:5,duration:0},{text:'Welcome.',offset:null,duration:0}]);
  assert.equal(pastedCaptions('1\n00:01:05,000 --> 00:01:08,000\nGood morning.')[0].offset,65);
  assert.throws(()=>pastedCaptions('  '));
  assert.throws(()=>pastedCaptions('a'.repeat(100001)));
});
