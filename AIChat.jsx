import React,{useEffect,useRef,useState} from 'react';
import {Mic,Send,Volume2,Square} from 'lucide-react';
async function api(path,body){
  const response=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Chưa kết nối được AI.');return data;
}
export default function AIChat({fields,scenarios,onFlashcards}){
  const [status,setStatus]=useState(null),[field,setField]=useState('all'),[scenarioId,setScenarioId]=useState(String(scenarios[0].id)),[conversation,setConversation]=useState(null),[messages,setMessages]=useState([]),[saved,setSaved]=useState([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false),[autoSpeak,setAutoSpeak]=useState(true);
  const recognition=useRef(null),alive=useRef(true),end=useRef(null),operation=useRef(false);
  const selected=scenarios.find(s=>s.id===Number(scenarioId))||scenarios[0];
  const visible=scenarios.filter(s=>field==='all'||String(s.fieldId)===field);
  const refresh=async()=>{const list=await api('/api/ai/conversations');if(alive.current)setSaved(list);};
  useEffect(()=>{
    alive.current=true;
    Promise.all([api('/api/ai/status'),api('/api/ai/conversations')]).then(([s,h])=>{if(alive.current){setStatus(s);setSaved(h);}}).catch(e=>{if(alive.current)setError(e.message);});
    return()=>{alive.current=false;recognition.current?.abort();window.speechSynthesis?.cancel();};
  },[]);
  useEffect(()=>{end.current?.scrollIntoView?.({block:'nearest',behavior:'smooth'});},[messages]);
  const speak=text=>{
    if(!window.speechSynthesis||!window.SpeechSynthesisUtterance){setError('Trình duyệt chưa hỗ trợ đọc thành tiếng. Bạn vẫn có thể luyện bằng chat.');return;}
    window.speechSynthesis.cancel();const utterance=new window.SpeechSynthesisUtterance(text);utterance.lang='en-US';utterance.rate=0.85;window.speechSynthesis.speak(utterance);
  };
  const stop=()=>{recognition.current?.abort();recognition.current=null;setListening(false);window.speechSynthesis?.cancel();};
  const run=async fn=>{
    if(operation.current)return;operation.current=true;setBusy(true);setError('');stop();
    try{await fn();}catch(e){if(alive.current)setError(e.message);}finally{operation.current=false;if(alive.current)setBusy(false);}
  };
  const start=()=>run(async()=>{const data=await api('/api/ai/conversations',{scenarioId:Number(scenarioId)});if(!alive.current)return;setConversation(data.id);setMessages([]);setDraft('');await refresh();});
  const open=id=>run(async()=>{const data=await api(`/api/ai/conversations/${id}`);if(!alive.current)return;setScenarioId(String(data.scenarioId));setConversation(data.id);setMessages(data.messages);setDraft('');setField('all');});
  const send=event=>{
    event.preventDefault();if(!conversation||!draft.trim())return;
    const text=draft.trim();
    run(async()=>{const data=await api(`/api/ai/conversations/${conversation}/messages`,{message:text});if(!alive.current)return;setMessages(data.messages);setDraft('');const reply=data.messages.at(-1);if(autoSpeak&&reply?.role==='assistant')speak(reply.content);});
  };
  const record=()=>{
    if(listening){recognition.current?.stop();return;}
    const SpeechRecognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!SpeechRecognition){setError('Trình duyệt chưa hỗ trợ nhận dạng giọng nói. Hãy dùng Chrome/Edge hoặc nhập tin nhắn.');return;}
    setError('');window.speechSynthesis?.cancel();
    const recognizer=new SpeechRecognition();recognition.current=recognizer;recognizer.lang='en-US';recognizer.interimResults=false;recognizer.continuous=false;
    recognizer.onresult=e=>{if(alive.current)setDraft(previous=>[previous,e.results[0][0].transcript].filter(Boolean).join(' ').slice(0,1000));};
    recognizer.onerror=e=>{if(alive.current)setError(e.error==='not-allowed'?'Bạn cần cho phép sử dụng micro để luyện nói.':'Chưa nhận được giọng nói. Hãy thử lại hoặc nhập câu.');};
    recognizer.onend=()=>{if(alive.current)setListening(false);recognition.current=null;};
    try{recognizer.start();setListening(true);}catch{setError('Không mở được micro. Hãy thử lại.');}
  };
  return <section className="ai-practice">
    <div className="page-title"><span className="eyebrow dark">TRÒ CHUYỆN VÀ LUYỆN NÓI</span><h1>Luyện giao tiếp với AI</h1><p>Chat với Gemini hoặc nói qua micro, nghe phản hồi và học cách diễn đạt tự nhiên.</p></div>
    {status&&!status.configured&&<div className="ai-config-note" role="status">Gemini chưa được kết nối. Quản trị viên cần thêm GEMINI_API_KEY trong Biến môi trường của Vibehost, lưu rồi triển khai lại.</div>}
    {error&&<p className="ai-error" role="alert">{error}</p>}
    <div className="ai-layout">
      <aside className="ai-sidebar">
        <label>Lĩnh vực<select aria-label="Lĩnh vực luyện AI" value={field} disabled={busy||Boolean(conversation)} onChange={e=>{const value=e.target.value;setField(value);const first=scenarios.find(s=>value==='all'||String(s.fieldId)===value);if(first)setScenarioId(String(first.id));}}><option value="all">Tất cả lĩnh vực</option>{fields.map(f=><option key={f.id} value={f.id}>{f.title}</option>)}</select></label>
        <label>Tình huống<select aria-label="Tình huống luyện AI" value={scenarioId} disabled={busy||Boolean(conversation)} onChange={e=>setScenarioId(e.target.value)}>{visible.map(s=><option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        <button className="primary" disabled={busy||!status?.configured} onClick={start}>Bắt đầu cuộc trò chuyện</button>
        {conversation&&<button className="outline" disabled={busy} onClick={()=>{stop();setConversation(null);setMessages([]);setDraft('');setError('');}}>Chọn tình huống mới</button>}
        <h3>Lịch sử luyện tập</h3>
        <div className="ai-history">{saved.map(s=><button className={'outline '+(conversation===s.id?'active':'')} disabled={busy} key={s.id} onClick={()=>open(s.id)}>{s.title}<small>{new Date(s.createdAt).toLocaleDateString('vi-VN')}</small></button>)}{!saved.length&&<p>Chưa có cuộc trò chuyện.</p>}</div>
        <button className="outline" onClick={onFlashcards}>Ôn tập Flashcards</button>
      </aside>
      <div className="ai-chat-panel">
        <div className="ai-context"><h2>{selected.title}</h2><p>{selected.briefing}</p><small>AI: {selected.role} · Bạn: {selected.userRole}</small></div>
        <div className="ai-messages" role="log" aria-label="Nội dung trò chuyện">
          {!messages.length&&<p className="ai-empty">{conversation?'Hãy chào bằng tiếng Anh hoặc nói câu mở đầu. Gemini sẽ phản hồi dựa trên câu của bạn.':'Chọn tình huống và bấm bắt đầu để luyện giao tiếp.'}</p>}
          {messages.map(m=><article className={'ai-message '+m.role} key={m.id}><strong>{m.role==='assistant'?'Gemini':'Bạn'}</strong><p lang="en">{m.content}</p>{m.role==='assistant'&&<><p className="ai-translation" lang="vi">{m.translation}</p>{m.correction&&<p className="ai-correction"><b>Gợi ý sửa câu:</b> {m.correction}</p>}{m.tip&&<p className="ai-tip">{m.tip}</p>}<button className="outline" disabled={listening} onClick={()=>speak(m.content)}><Volume2 size={15}/>Nghe câu trả lời</button></>}</article>)}
          {busy&&<p role="status">Đang xử lý…</p>}<div ref={end}/>
        </div>
        <form onSubmit={send} className="ai-composer">
          <label htmlFor="ai-draft">Câu của bạn (tiếng Anh)</label>
          <textarea id="ai-draft" value={draft} maxLength={1000} rows={3} disabled={busy||!conversation} onChange={e=>setDraft(e.target.value)} placeholder="Nhập câu hoặc dùng micro…"/>
          <div className="practice-actions"><button type="button" className="outline" disabled={busy||!conversation} onClick={record}><Mic size={17}/>{listening?'Kết thúc ghi âm':'Nói qua micro'}</button><button type="submit" className="primary" disabled={busy||listening||!conversation||!draft.trim()||messages.length>=40}><Send size={17}/>Gửi cho AI</button><button type="button" className="outline" onClick={stop}><Square size={15}/>Dừng nghe / đọc</button></div>
          <label className="ai-auto-speak"><input type="checkbox" checked={autoSpeak} onChange={e=>setAutoSpeak(e.target.checked)}/>Tự đọc câu trả lời của AI</label>
          <p className="note">Micro chuyển lời nói thành chữ. Xem lại câu rồi bấm Gửi. AI sửa cách diễn đạt từ văn bản; chưa chấm phát âm. Giọng đọc và nhận dạng phụ thuộc trình duyệt.</p>
        </form>
      </div>
    </div>
  </section>;
}
