import { useState, useEffect, useRef } from 'react'
import axios from 'axios'
import { Send, Bot, User, Cpu, Plus, MessageSquare, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

// --- Arayüz Tanımları ---
interface Message { role: 'user' | 'assistant'; content: string; }
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
  const scrollRef = useRef<HTMLDivElement>(null);

  // 1. Başlangıç Verilerini Yükle
  useEffect(() => {
    // Modelleri çek
    axios.get('http://localhost:8000/models').then(res => {
      setModels(res.data.models);
      if (res.data.models.length > 0) setSelectedModel(res.data.models[0].id);
    });
    // Mevcut oturumları (geçmişi) çek
    loadSessions();
  }, []);

  // 2. Oturumları Listele
  const loadSessions = async () => {
    try {
      const res = await axios.get('http://localhost:8000/sessions');
      setSessions(res.data.sessions);
    } catch (err) { console.error("Oturumlar yüklenemedi", err); }
  };

  // 3. Yeni Sohbet Başlat
  const handleNewChat = async () => {
    const title = prompt("Sohbet başlığı girin:", "Yeni Sohbet") || "Yeni Sohbet";
    try {
      const res = await axios.post('http://localhost:8000/sessions', null, { params: { title } });
      setCurrentSessionId(res.data.id);
      setMessages([]);
      loadSessions();
    } catch (err) { console.error("Yeni sohbet oluşturulamadı", err); }
  };

  // 4. Geçmiş Sohbeti Seç ve Mesajları Getir
  const selectSession = async (id: number) => {
    setCurrentSessionId(id);
    try {
      const res = await axios.get(`http://localhost:8000/sessions/${id}/messages`);
      setMessages(res.data.messages);
    } catch (err) { console.error("Mesajlar çekilemedi", err); }
  };

  // 5. Model Değiştiğinde Sohbeti Temizle (İster gereği)
  useEffect(() => {
    if (selectedModel && !currentSessionId) {
      setMessages([]);
      setInput('');
    }
  }, [selectedModel, currentSessionId]);

  // 6. Mesaj Gönder
  const handleSend = async () => {
    if (!input.trim() || loading || !currentSessionId) {
      if (!currentSessionId) alert("Lütfen önce bir sohbet seçin veya yeni sohbet başlatın.");
      return;
    }

    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/chat', {
        model_id: selectedModel,
        session_id: currentSessionId, // Mesajı bu oturuma kaydet
        messages: newMessages
      });
      
      if (response.data.choices?.[0]?.message) {
        setMessages([...newMessages, response.data.choices[0].message]);
      }
    } catch (error: unknown) {
      let errorMsg = "Model şu an yanıt veremiyor.";
      if (axios.isAxiosError(error)) {
        errorMsg = error.response?.data?.detail || error.message;
      }
      setMessages([...newMessages, { role: 'assistant', content: `⚠️ Hata: ${errorMsg}` }]);
    } finally {
      setLoading(false);
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* SIDEBAR: Oturum Yönetimi ve Geçmiş */}
      <div className="w-72 bg-white border-r border-slate-200 p-4 flex flex-col shadow-sm">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Cpu className="text-blue-600" />
          <h1 className="font-bold text-xl tracking-tight">Madlen AI</h1>
        </div>

        <button 
          onClick={handleNewChat}
          className="flex items-center gap-2 bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-all font-medium mb-6 shadow-md shadow-blue-100"
        >
          <Plus size={18} /> Yeni Sohbet
        </button>

        <div className="flex-1 overflow-y-auto space-y-1">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 block">Sohbet Geçmişi</label>
          {sessions.map(s => (
            <button 
              key={s.id} 
              onClick={() => selectSession(s.id)}
              className={`w-full text-left p-3 rounded-xl text-sm transition-all flex items-center gap-3 ${
                currentSessionId === s.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'hover:bg-slate-50 text-slate-600'
              }`}
            >
              <MessageSquare size={16} className={currentSessionId === s.id ? 'text-blue-600' : 'text-slate-400'} />
              <span className="truncate">{s.title}</span>
            </button>
          ))}
        </div>

        <div className="mt-auto pt-4 border-t border-slate-100">
          <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2 block">Model Seçimi</label>
          <select 
            className="w-full p-2.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none"
            value={selectedModel} 
            onChange={e => setSelectedModel(e.target.value)}
          >
            {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
      </div>

      {/* ANA CHAT ALANI */}
      <div className="flex-1 flex flex-col relative">
        <div className="flex-1 overflow-y-auto p-6 md:p-12 space-y-8">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-300">
              <Bot size={64} className="mb-4 opacity-10" />
              <p className="text-sm">Geçmişten bir sohbet seçin veya yeni bir tane başlatın.</p>
            </div>
          )}
          
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-4 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                  m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-600'
                }`}>
                  {m.role === 'user' ? <User size={18} /> : <Bot size={18} />}
                </div>
                
                <div className={`p-5 rounded-2xl text-[15px] shadow-sm leading-relaxed prose prose-slate max-w-none ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border border-slate-100 rounded-tl-none'
                }`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      code({ className, children }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');
                        return match ? (
                          <div className="relative group my-4">
                            <button 
                              onClick={() => navigator.clipboard.writeText(codeString)}
                              className="absolute right-3 top-3 p-2 bg-slate-800/50 hover:bg-slate-800 rounded-lg text-slate-300 opacity-0 group-hover:opacity-100 transition-all z-10"
                            >
                              <Copy size={14} />
                            </button>
                            <SyntaxHighlighter
                              style={vscDarkPlus as any}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-xl !m-0 !bg-slate-900 border border-slate-800 shadow-xl"
                            >
                              {codeString}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className="bg-slate-100 px-1.5 py-0.5 rounded-md text-blue-600 font-mono text-sm">
                            {children}
                          </code>
                        );
                      }
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} />
          {loading && <div className="animate-pulse bg-slate-200 h-10 w-32 rounded-2xl ml-14"></div>}
        </div>

        {/* INPUT BAR */}
        <div className="p-6 bg-gradient-to-t from-slate-50 to-transparent">
          <div className="max-w-4xl mx-auto flex gap-3 bg-white p-2 rounded-2xl border border-slate-200 shadow-lg focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <input 
              className="flex-1 p-3 bg-transparent border-none outline-none text-sm px-4"
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder={currentSessionId ? "Mesajınızı yazın..." : "Önce bir sohbet başlatın..."}
              disabled={!currentSessionId || loading}
            />
            <button 
              onClick={handleSend} 
              disabled={loading || !currentSessionId}
              className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl disabled:opacity-30 disabled:hover:bg-blue-600 transition-all shadow-md shadow-blue-200"
            >
              <Send size={20} />
            </button>
          </div>
          <p className="text-[10px] text-center text-slate-400 mt-4">Madlen AI Case Study - Built with FastAPI, React and Jaeger</p>
        </div>
      </div>
    </div>
  );
}

export default App;