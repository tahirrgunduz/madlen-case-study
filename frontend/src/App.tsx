import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Send, Bot, User, Plus, MessageSquare, Copy, Paperclip, X } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

// --- Arayüz Tanımlamaları ---
interface Message { role: 'user' | 'assistant'; content: any; }
interface Model { id: string; name: string; }
interface ChatSession { id: number; title: string; }

function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Başlangıç Verilerini Yükle
  useEffect(() => {
    axios.get('http://localhost:8000/models').then(res => {
      setModels(res.data.models);
      if (res.data.models.length > 0) setSelectedModel(res.data.models[0].id);
    });
    axios.get('http://localhost:8000/sessions').then(res => setSessions(res.data.sessions));
  }, []);

  const handleNewChat = async () => {
    const title = prompt("Sohbet başlığı:") || "Yeni Sohbet";
    try {
      const res = await axios.post('http://localhost:8000/sessions', null, { params: { title } });
      setCurrentSessionId(res.data.id);
      setMessages([]);
      axios.get('http://localhost:8000/sessions').then(res => setSessions(res.data.sessions));
    } catch (err) { console.error(err); }
  };

  const selectSession = async (id: number) => {
    setCurrentSessionId(id);
    try {
      const res = await axios.get(`http://localhost:8000/sessions/${id}/messages`);
      setMessages(res.data.messages);
    } catch (err) { console.error(err); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.size < 5 * 1024 * 1024) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || loading || !currentSessionId) return;

    let messageContent: any = input;
    if (selectedImage) {
      // Multi-modal veri yapısı
      messageContent = [
        { type: "text", text: input || "Bu resmi analiz et." },
        { type: "image_url", image_url: { url: selectedImage } }
      ];
    }

    const newMessages: Message[] = [...messages, { role: 'user', content: messageContent }];
    setMessages(newMessages);
    setInput(''); setSelectedImage(null); setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/chat', {
        model_id: selectedModel, session_id: currentSessionId, messages: newMessages
      });
      setMessages([...newMessages, response.data.choices[0].message]);
    } catch (error: any) {
      const err = error.response?.data?.detail;
      let msg = typeof err === 'object' ? (err.error?.message || JSON.stringify(err)) : (err || error.message);
      // API Hata Yönetimi
      if (msg.includes("429")) msg = "Rate limit doldu (Ücretsiz 50 mesaj bitti).";
      if (msg.includes("404")) msg = "Seçilen model görsel analizini desteklemiyor.";
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Hata: ${msg}` }]);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans">
      {/* SIDEBAR */}
      <div className="w-72 bg-white border-r border-slate-200 p-4 flex flex-col shadow-sm">
        
        {/* LOGO VE BAŞLIK */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <img 
            src="/madlen_logo.jpeg" 
            alt="Madlen AI Logo" 
            className="h-9 w-9 object-contain rounded-lg shadow-sm"
          />
          <h1 className="font-bold text-xl tracking-tight text-slate-800">Madlen AI</h1>
        </div>

        {/* YENİ SOHBET BUTONU */}
        <button onClick={handleNewChat} className="flex items-center gap-2 bg-slate-800 text-white p-3 rounded-xl hover:bg-slate-700 transition-all font-medium mb-6 shadow-sm">
          <Plus size={18} /> Yeni Sohbet
        </button>

        <div className="flex-1 overflow-y-auto space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 block">Sohbet Geçmişi</label>
          {sessions.map(s => (
            <button key={s.id} onClick={() => selectSession(s.id)} className={`w-full text-left p-3 rounded-xl text-sm transition-all flex items-center gap-3 ${currentSessionId === s.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-600'}`}>
              <MessageSquare size={16} /> <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 block">Model Seçimi</label>
          <select className="w-full p-2.5 bg-slate-100 border-none rounded-lg text-sm outline-none cursor-pointer" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* ANA SOHBET ALANI */}
      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Bot size={64} className="mb-4 opacity-10" />
              <p className="text-sm">Bir sohbet seçin veya yeni bir tane başlatın.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border text-slate-600'}`}>
                  {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                <div className={`p-5 rounded-2xl text-[15px] shadow-sm prose prose-slate max-w-none ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border rounded-tl-none'}`}>
                  <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                    code({ className, children }) {
                      const match = /language-(\w+)/.exec(className || '');
                      const codeStr = String(children).replace(/\n$/, '');
                      return match ? (
                        <div className="relative group my-4">
                          <button onClick={() => navigator.clipboard.writeText(codeStr)} className="absolute right-3 top-3 p-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg text-slate-300 opacity-0 group-hover:opacity-100 transition-all z-10"><Copy size={14} /></button>
                          <SyntaxHighlighter style={vscDarkPlus as any} language={match[1]} PreTag="div" className="rounded-xl !m-0 !bg-slate-900 border border-slate-800 shadow-xl">{codeStr}</SyntaxHighlighter>
                        </div>
                      ) : ( <code className="bg-slate-100 px-1.5 py-0.5 rounded text-blue-600 font-mono text-sm">{children}</code> );
                    }
                  }}>
                    {typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.find((c: any) => c.type === 'text')?.text : '')}
                  </ReactMarkdown>
                  {Array.isArray(m.content) && m.content.find((c: any) => c.type === 'image_url') && (
                    <img src={m.content.find((c: any) => c.type === 'image_url').image_url.url} className="mt-3 max-w-xs rounded-lg shadow-md border" alt="uploaded" />
                  )}
                </div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
        </div>

        {/* GİRİŞ ALANI VE ANIMASYON */}
        <div className="p-6 bg-gradient-to-t from-slate-100 to-transparent">
          <div className="max-w-4xl mx-auto">
            {/* AI DÜŞÜNÜYOR GÖSTERGESİ */}
            {loading && (
              <div className="flex items-center gap-1.5 mb-3 ml-2 text-blue-600">
                <span className="text-[10px] font-bold uppercase tracking-widest opacity-70 mr-1">AI Düşünüyor</span>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
              </div>
            )}
            {selectedImage && (
              <div className="mb-2 relative inline-block">
                <img src={selectedImage} alt="Preview" className="h-20 w-auto rounded-lg border shadow-sm" />
                <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-slate-800 text-white rounded-full p-1 hover:bg-red-500 transition-all"><X size={14} /></button>
              </div>
            )}
            <div className="flex gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-lg focus-within:ring-2 focus-within:ring-blue-500 transition-all">
              <label className={`p-3 flex items-center justify-center text-slate-400 hover:text-blue-600 cursor-pointer ${!currentSessionId ? 'opacity-50 cursor-not-allowed' : ''}`}>
                <Paperclip size={20} />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} disabled={!currentSessionId || loading} ref={fileInputRef} />
              </label>
              <input 
                className="flex-1 p-3 bg-transparent border-none outline-none text-sm px-4" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                onKeyPress={e => e.key === 'Enter' && handleSend()} 
                placeholder={currentSessionId ? "Mesajınızı yazın..." : "Önce bir sohbet başlatın..."} 
                disabled={!currentSessionId || loading} 
              />
              <button onClick={handleSend} disabled={loading || !currentSessionId || (!input.trim() && !selectedImage)} className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl shadow-md transition-all active:scale-95"><Send size={20} /></button>
            </div>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-4 italic">Madlen AI Case Study - Built with FastAPI, React and Jaeger</p>
        </div>
      </div>
    </div>
  );
}

export default App;