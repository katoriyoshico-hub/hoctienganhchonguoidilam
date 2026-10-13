import {test} from 'node:test';
import assert from 'node:assert/strict';
import {audioRange,parseAudioTranscript,transcribeYoutubeAudio} from '../server/youtube-audio.js';
const transcript={language:'en',segments:[{text:'Good morning. How can I help you?',offset:10,duration:3},{text:'I would like a ticket, please.',offset:15,duration:4}]};
const range={start:10,end:60};
test('audio clipping and returned transcript reject invalid or fabricated format',()=>{
 assert.deepEqual(audioRange(10,60),range);
 for(const args of [[0,181],[-1,10],[20,10],['0',10],[0,0]])assert.throws(()=>audioRange(...args));
 assert.equal(parseAudioTranscript(JSON.stringify(transcript),range).segments.length,2);
 assert.throws(()=>parseAudioTranscript(JSON.stringify({language:'en',segments:[]}),range),e=>e.code==='NO_SPEECH');
 assert.throws(()=>parseAudioTranscript(JSON.stringify({...transcript,segments:[{text:'x',offset:0,duration:1}]}),range));
 assert.throws(()=>parseAudioTranscript('A summary instead of a transcript',range));
});
test('Gemini receives the actual YouTube video with a bounded clip rather than caption text',async()=>{
 let request;
 const result=await transcribeYoutubeAudio('abcdefghijk',range,{config:{configured:true,key:'test-only-key',model:'gemini-2.5-flash'},fetchImpl:async(url,options)=>{
  request={url,options};return new Response(JSON.stringify({candidates:[{finishReason:'STOP',content:{parts:[{text:JSON.stringify(transcript)}]}}]}));
 }});
 const body=JSON.parse(request.options.body);
 assert.equal(body.contents[0].parts[0].fileData.fileUri,'https://www.youtube.com/watch?v=abcdefghijk');
 assert.equal(body.contents[0].parts[0].videoMetadata.startOffset,'10s');
 assert.equal(body.contents[0].parts[0].videoMetadata.endOffset,'60s');
 assert.ok(body.contents[0].parts[1].text.includes('Do not summarize'));
 assert.equal(result.source,'gemini-audio');assert.equal(result.videoId,'abcdefghijk');assert.ok(result.text.includes('ticket'));
});
test('audio transcription reports missing key and incomplete output rather than claiming success',async()=>{
 await assert.rejects(transcribeYoutubeAudio('abcdefghijk',range,{config:{configured:false}}),e=>e.code==='AI_NOT_CONFIGURED');
 await assert.rejects(transcribeYoutubeAudio('abcdefghijk',range,{config:{configured:true,key:'test',model:'test'},fetchImpl:async()=>new Response(JSON.stringify({candidates:[{finishReason:'MAX_TOKENS',content:{parts:[{text:JSON.stringify(transcript)}]}}]}))}),e=>e.code==='INCOMPLETE_AUDIO');
});
