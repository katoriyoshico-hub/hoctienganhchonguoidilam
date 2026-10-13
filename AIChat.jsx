import React,{useEffect,useRef,useState} from 'react';
import {Mic,Send,Volume2,Square} from 'lucide-react';
async function api(path,body){
  const response=await fetch(path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Chưa kết nối được website.');return data;
}
export default function AIChat({onFlashcards}){
  const [conversation,setConversation]=useState(null),[messages,setMessages]=useState([]),[saved,setSaved]=useState([]),[draft,setDraft]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[listening,setListening]=useState(false),[autoSpeak,setAutoSpeak]=useState(true);
  const recognition=useRef(null),alive=useRef(true),end=useRef(null),operation=useRef(false);
  const refresh=async()=>{const list=await api('/api/ai/conversations');if(alive.current)setSaved(list);};
  useEffect(()=>{
    alive.current=true;
    api('/api/ai/conversations').then(h=>{if(alive.current)setSaved(h);}).catch(e=>{if(alive.current)setError(e.message);});
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
  const start=()=>run(async()=>{const data=await api('/api/ai/conversations',{});if(!alive.current)return;setConversation(data.id);setMessages([]);await refresh();});
  const open=id=>run(async()=>{const data=await api(`/api/ai/conversations/${id}`);if(!alive.current)return;setConversation(data.id);setMessages(data.messages);setDraft('');});
  const send=event=>{
    event.preventDefault();
    if(!draft.trim())return;
    const text=draft.trim();
    run(async()=>{
      let id=conversation;
      if(!id){const created=await api('/api/ai/conversations',{});id=created.id;if(alive.current)setConversation(id);await refresh();}
      const data=await api(`/api/ai/conversations/${id}/messages`,{message:text});if(!alive.current)return;
      setMessages(data.messages);setDraft('');const reply=data.messages.at(-1);if(autoSpeak&&reply?.role==='assistant')speak(reply.content);await refresh();
    });
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
    <div className="page-title"><span className="eyebrow dark">TÁN GẪU BẰNG TIẾNG ANH</span><h1>Chat luyện tiếng Anh</h1><p>Tâm sự về một ngày của bạn, sở thích hay bất cứ điều gì bạn muốn — nhập tin nhắn hoặc nói qua micro.</p></div>
    {error&&<p className="ai-error" role="alert">{error}</p>}
    <div className="ai-layout">
      <aside className="ai-sidebar">
        <button className="primary" disabled={busy} onClick={start}>Cuộc trò chuyện mới</button>
        <h3>Lịch sử luyện tập</h3>
        <div className="ai-history">{saved.map(s=><button className={'outline '+(conversation===s.id?'active':'')} disabled={busy} key={s.id} onClick={()=>open(s.id)}>{s.title}<small>{new Date(s.createdAt).toLocaleDateString('vi-VN')}</small></button>)}{!saved.length&&<p>Chưa có cuộc trò chuyện.</p>}</div>
        <button className="outline" onClick={onFlashcards}>Ôn tập Flashcards</button>
      </aside>
      <div className="ai-chat-panel">
        <div className="ai-context"><h2>Cùng trò chuyện nhé!</h2><p>Không cần chọn hoàn cảnh. Bạn có thể bắt đầu bằng “Hi!”, kể chuyện hôm nay hoặc hỏi một câu bất kỳ.</p><small>Trợ lý website · Luyện trò chuyện tiếng Anh</small></div>
        <div className="ai-messages" role="log" aria-label="Nội dung trò chuyện">
          {!messages.length&&<p className="ai-empty">{conversation?'Hãy kể về hôm nay của bạn hoặc bắt đầu bằng một lời chào.':'Nhập tin nhắn hoặc nói qua micro để bắt đầu trò chuyện.'}</p>}
          {messages.map(m=><article className={'ai-message '+m.role} key={m.id}><strong>{m.role==='assistant'?'Trợ lý website':'Bạn'}</strong><p lang="en">{m.content}</p>{m.role==='assistant'&&<><details className="ai-learning-notes"><summary>Bản dịch và gợi ý học</summary><p className="ai-translation" lang="vi">{m.translation}</p>{m.correction&&<p className="ai-correction"><b>Gợi ý sửa câu:</b> {m.correction}</p>}{m.tip&&<p className="ai-tip">{m.tip}</p>}</details><button className="outline" disabled={listening} onClick={()=>speak(m.content)}><Volume2 size={15}/>Nghe câu trả lời</button></>}</article>)}
          {busy&&<p role="status">Đang xử lý…</p>}<div ref={end}/>
        </div>
        <form onSubmit={send} className="ai-composer">
          <label htmlFor="ai-draft">Câu của bạn (tiếng Anh)</label>
          <div className="ai-send-row">
            <textarea id="ai-draft" value={draft} maxLength={1000} rows={2} disabled={busy} onChange={e=>setDraft(e.target.value)} placeholder="Nhập tin nhắn…" onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();if(!busy&&!listening&&draft.trim())e.currentTarget.form.requestSubmit();}}}/>
            <button type="submit" className="primary ai-send" aria-label="Send" disabled={busy||listening||!draft.trim()||messages.length>=40}><Send size={18}/>{busy?'Đang gửi…':'Send'}</button>
          </div>
          <div className="practice-actions"><button type="button" className="outline" disabled={busy} onClick={record}><Mic size={17}/>{listening?'Kết thúc ghi âm':'Nói qua micro'}</button><button type="button" className="outline" onClick={stop}><Square size={15}/>Dừng nghe / đọc</button></div>
          <label className="ai-auto-speak"><input type="checkbox" checked={autoSpeak} onChange={e=>setAutoSpeak(e.target.checked)}/>Tự đọc câu trả lời</label>
          <p className="note">Micro chuyển lời nói thành chữ. Xem lại câu rồi bấm Gửi. Phản hồi tự động theo chủ đề đơn giản, chưa phải AI sinh câu trả lời hay chấm phát âm. Giọng đọc và nhận dạng phụ thuộc trình duyệt.</p>
        </form>
      </div>
    </div>
  </section>;
}
