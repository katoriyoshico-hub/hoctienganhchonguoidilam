import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localChatReply} from '../server/local-chat.js';
import {parseAIReply} from '../server/ai.js';
test('website replies to greetings and common topics without an API key',()=>{
 assert.ok(localChatReply({message:'Hi'}).reply.includes('How is your day'));
 assert.ok(localChatReply({message:'I like coffee'}).reply.includes('food or drink'));
 assert.ok(localChatReply({message:'Tôi thích du lịch'}).reply.includes('next trip'));
 assert.ok(localChatReply({message:'Who are you?'}).reply.includes('automatic'));
 assert.ok(localChatReply({message:'Something unfamiliar'}).reply.length>0);
});
test('short followups use the previous topic and supported corrections are specific',()=>{
 const result=localChatReply({message:'Yes',history:[{role:'user',content:'I like cooking'},{role:'assistant',content:'Food?'}]});
 assert.ok(result.reply.includes('cooking'));
 assert.equal(localChatReply({message:'I am agree'}).correction,'I agree.');
 assert.equal(localChatReply({message:'I feel happy'}).correction,'');
});
test('stored automated replies must contain real text and a translation',()=>{
 assert.deepEqual(parseAIReply(JSON.stringify(localChatReply({message:'Hello'}))),localChatReply({message:'Hello'}));
 assert.throws(()=>parseAIReply('not json'));
});
