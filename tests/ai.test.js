import {test} from 'node:test';
import assert from 'node:assert/strict';
import {aiConfiguration,generateAIReply,parseAIReply} from '../server/ai.js';
const reply={reply:'Could you tell me your budget?',translation:'Bạn cho tôi biết ngân sách nhé?',correction:'I would like a gift.',tip:'Dùng would like để yêu cầu lịch sự.'};
const config={configured:true,provider:'gemini',key:'test-key',model:'gemini-2.5-flash'};
test('Gemini configuration needs a server key and structured replies reject invalid content',()=>{
 assert.equal(aiConfiguration({}).configured,false);
 assert.equal(aiConfiguration({GEMINI_API_KEY:'test'}).model,'gemini-2.5-flash');
 assert.deepEqual(parseAIReply(JSON.stringify(reply)),reply);
 assert.throws(()=>parseAIReply('plain text'));
 assert.throws(()=>parseAIReply(JSON.stringify({...reply,reply:''})));
});
test('Gemini adapter sends contextual conversation and returns bilingual corrections',async()=>{
 let call;
 const actual=await generateAIReply({scenario:{title:'Buying a gift',context_briefing:'In a shop',ai_role_name:'Seller',user_role_name:'Buyer'},history:[{role:'user',content:'Hello'},{role:'assistant',content:'Welcome!'}],message:'I want gift'},{config,fetchImpl:async(url,options)=>{
 call={url,options};return new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(reply)}]}}]}));
 }});
 assert.deepEqual(actual,reply);
 assert.ok(call.url.includes('gemini-2.5-flash:generateContent'));
 assert.equal(call.options.headers['x-goog-api-key'],'test-key');
 const body=JSON.parse(call.options.body);
 assert.ok(body.systemInstruction.parts[0].text.includes('without assigned roles'));
 assert.ok(!body.systemInstruction.parts[0].text.includes('Seller'));
 assert.equal(body.contents[1].role,'model');
 assert.equal(body.contents[2].parts[0].text,'I want gift');
 assert.equal(body.generationConfig.responseMimeType,'application/json');
});
test('Gemini missing key, quota and invalid upstream output return clear errors',async()=>{
 await assert.rejects(generateAIReply({},{config:{configured:false}}),e=>e.status===503);
 const args={scenario:{},history:[],message:'Hello'};
 await assert.rejects(generateAIReply(args,{config,fetchImpl:async()=>new Response('',{status:429})}),e=>e.status===429);
 await assert.rejects(generateAIReply(args,{config,fetchImpl:async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:'invented invalid format'}]}}]}))}),e=>e.status===502);
});
