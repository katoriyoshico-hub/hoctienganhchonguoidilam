import {localChatReply} from './local-chat.js';
export class AIError extends Error {
  constructor(message,status=502){super(message);this.status=status;}
}
export function parseAIReply(text){
  let data;
  try{data=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw new AIError('Website chưa trả lời đúng định dạng. Hãy thử lại.');}
  for(const [key,limit] of [['reply',1600],['translation',1600],['correction',1000],['tip',700]]){
    if(typeof data[key]!=='string' || data[key].length>limit || (['reply','translation'].includes(key)&&!data[key].trim())) throw new AIError('Phản hồi chưa hợp lệ. Hãy thử lại.');
  }
  return {reply:data.reply.trim(),translation:data.translation.trim(),correction:data.correction.trim(),tip:data.tip.trim()};
}
const validId=id=>Number.isSafeInteger(Number(id))&&Number(id)>0&&Number(id)<=2147483647;
export function registerAI(app,pool,{aiProvider}={}){
  const provider=aiProvider || localChatReply;
  let active=0;
  const lastRequest=new Map();
  const handle=fn=>async(req,res,next)=>{try{await fn(req,res);}catch(e){if(e instanceof AIError)res.status(e.status).json({error:e.message});else next(e);}};
  app.get('/api/ai/status',(_req,res)=>res.json({configured:true,provider:'website-rules',voice:'browser'}));
  app.get('/api/ai/conversations',handle(async(req,res)=>{
    const {rows}=await pool.query('SELECT c.conversation_id AS id,c.title,c.created_at AS "createdAt" FROM ai_conversations c WHERE c.user_id=$1 ORDER BY c.conversation_id DESC LIMIT 30',[req.user.user_id]);res.json(rows);
  }));
  app.post('/api/ai/conversations',handle(async(req,res)=>{
    const {rows}=await pool.query('INSERT INTO ai_conversations(user_id) VALUES($1) RETURNING conversation_id AS id',[req.user.user_id]);
    res.status(201).json(rows[0]);
  }));
  const find=async(client,id,user)=>{
    if(!validId(id))throw new AIError('Không tìm thấy cuộc trò chuyện.',404);
    const {rows}=await client.query('SELECT c.conversation_id,c.title FROM ai_conversations c WHERE c.conversation_id=$1 AND c.user_id=$2',[Number(id),user]);
    if(!rows.length)throw new AIError('Không tìm thấy cuộc trò chuyện.',404);return rows[0];
  };
  const history=async(client,id)=>(await client.query('SELECT message_id AS id,role,content,translation,correction,tip FROM ai_messages WHERE conversation_id=$1 ORDER BY message_id',[id])).rows;
  app.get('/api/ai/conversations/:id',handle(async(req,res)=>{const scenario=await find(pool,req.params.id,req.user.user_id);res.json({id:scenario.conversation_id,title:scenario.title,messages:await history(pool,scenario.conversation_id)});}));
  app.post('/api/ai/conversations/:id/messages',handle(async(req,res)=>{
    const message=req.body?.message;
    if(typeof message!=='string'||!message.trim()||message.length>1000)throw new AIError('Nhập câu trả lời từ 1 đến 1.000 ký tự.',400);
    if(active>=4)throw new AIError('Website đang xử lý nhiều tin nhắn. Hãy thử lại sau.',429);
    const user=req.user.user_id;
    if(lastRequest.has(user)&&Date.now()-lastRequest.get(user)<1500)throw new AIError('Hãy chờ một chút trước khi gửi tiếp.',429);
    lastRequest.set(user,Date.now());if(lastRequest.size>10000){for(const [key,time]of lastRequest)if(Date.now()-time>60000)lastRequest.delete(key);}
    active++;let client,locked=false,transaction=false;
    try{
      client=await pool.connect();const scenario=await find(client,req.params.id,user);const id=scenario.conversation_id;
      locked=(await client.query('SELECT pg_try_advisory_lock(6060,$1) AS locked',[id])).rows[0].locked;
      if(!locked)throw new AIError('Cuộc trò chuyện đang chờ phản hồi.',409);
      const messages=await history(client,id);
      if(messages.length>=40)throw new AIError('Bạn đã hoàn thành 20 lượt. Hãy mở cuộc trò chuyện mới.',422);
      const response=await provider({history:messages,message:message.trim()});
      const answer=parseAIReply(JSON.stringify(response));
      await client.query('BEGIN');transaction=true;
      await client.query('INSERT INTO ai_messages(conversation_id,role,content) VALUES($1,\'user\',$2)',[id,message.trim()]);
      await client.query('INSERT INTO ai_messages(conversation_id,role,content,translation,correction,tip) VALUES($1,\'assistant\',$2,$3,$4,$5)',[id,answer.reply,answer.translation,answer.correction,answer.tip]);
      if(!messages.length)await client.query('UPDATE ai_conversations SET title=$2 WHERE conversation_id=$1',[id,message.trim().slice(0,60)]);
      await client.query('COMMIT');transaction=false;
      res.json({messages:await history(client,id)});
    }finally{try{if(transaction)await client.query('ROLLBACK');if(locked)await client.query('SELECT pg_advisory_unlock(6060,$1)',[Number(req.params.id)]);}finally{client?.release();active--;}}
  }));
}
