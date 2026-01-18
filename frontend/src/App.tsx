import { useState, useEffect } from 'react'
import axios from 'axios'
import { Send, Bot, User, Cpu, Copy } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import remarkGfm from 'remark-gfm'

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Model {
  id: string;
  name: string;
}

function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get('http://localhost:8000/models').then(res => {
      setModels(res.data.models);
      if (res.data.models.length > 0) setSelectedModel(res.data.models[0].id);
    }).catch(err => console.error("Modeller yüklenemedi:", err));
  }, []);

  useEffect(() => {
    if (selectedModel) {
      setMessages([]);
      setInput('');
    }
  }, [selectedModel]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:8000/chat', {
        model_id: selectedModel,
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
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans">
      <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col shadow-sm">
        <div className="flex items-center gap-2 mb-8">
          <Cpu className="text-blue-600" />
          <h1 className="font-bold text-xl tracking-tight">Madlen AI</h1>
        </div>
        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Model Seçimi</label>
        <select 
          className="w-full p-2.5 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          value={selectedModel} 
          onChange={e => setSelectedModel(e.target.value)}
        >
          {models.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="mt-auto text-xs text-slate-400 border-t pt-4">
          <p>Status: <span className="text-green-500 font-medium">● Online</span></p>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <Bot size={48} className="mb-4 opacity-20" />
              <p>Model değişiminde sohbet temizlenir.</p>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-200'}`}>
                  {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                
                <div className={`p-4 rounded-2xl text-sm shadow-sm prose prose-slate max-w-none ${
                  m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border rounded-tl-none'
                }`}>
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      // TypeScript hatalarını önlemek için props yapısını temizledik
                      code({ className, children }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeContent = String(children).replace(/\n$/, '');

                        return match ? (
                          <div className="relative group my-4">
                            <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 z-10 transition-opacity">
                              <button 
                                onClick={() => navigator.clipboard.writeText(codeContent)}
                                className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded text-slate-200"
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                            <SyntaxHighlighter
                              style={vscDarkPlus as any}
                              language={match[1]}
                              PreTag="div"
                              className="rounded-lg !m-0"
                            >
                              {codeContent}
                            </SyntaxHighlighter>
                          </div>
                        ) : (
                          <code className="bg-slate-100 px-1 rounded text-blue-600 font-mono">
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
          {loading && <div className="animate-pulse bg-slate-200 h-8 w-24 rounded-full ml-11 mt-2"></div>}
        </div>

        <div className="p-6 bg-white border-t">
          <div className="max-w-3xl mx-auto flex gap-3">
            <input 
              className="flex-1 p-3.5 bg-slate-50 border rounded-xl outline-none"
              value={input} 
              onChange={e => setInput(e.target.value)}
              onKeyPress={e => e.key === 'Enter' && handleSend()}
              placeholder="Mesajınızı yazın..."
            />
            <button onClick={handleSend} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white p-3.5 rounded-xl shadow-md">
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;