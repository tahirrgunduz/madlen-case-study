import os, sqlite3, httpx
from typing import List, Any, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# OpenTelemetry (Jaeger) Entegrasyonu
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

load_dotenv()

# --- OBSERVABILITY (TRACING) ---
resource = Resource(attributes={"service.name": "madlen-chat-backend"})
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

app = FastAPI(title="Madlen Chat API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
FastAPIInstrumentor.instrument_app(app)

DB_PATH = "chat_history.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)")
    cursor.execute("CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER, role TEXT, content TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)")
    conn.commit()
    conn.close()

init_db()

# --- SCHEMAS (DOĞRULAMA) ---
class Message(BaseModel):
    role: str
    # 'Any' kullanarak Pydantic'in liste uyarısı vermesini KESİN olarak engelliyoruz
    content: Any 

class ChatRequest(BaseModel):
    model_id: str
    session_id: int
    messages: List[Message]

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

# --- ENDPOINTS ---

@app.get("/sessions")
async def get_sessions():
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT id, title FROM sessions ORDER BY created_at DESC").fetchall()
    conn.close()
    return {"sessions": [{"id": r[0], "title": r[1]} for r in rows]}

@app.post("/sessions")
async def create_session(title: str = "Yeni Sohbet"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (title) VALUES (?)", (title,))
    s_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": s_id, "title": title}

@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: int):
    conn = sqlite3.connect(DB_PATH)
    rows = conn.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC", (session_id,)).fetchall()
    conn.close()
    return {"messages": [{"role": r[0], "content": r[1]} for r in rows]}

@app.get("/models")
async def get_models():
    async with httpx.AsyncClient() as client:
        resp = await client.get("https://openrouter.ai/api/v1/models", headers={"Authorization": f"Bearer {OPENROUTER_API_KEY}"})
        all_m = resp.json().get("data", [])
        return {"models": [{"id": m["id"], "name": m["name"]} for m in all_m if float(m.get("pricing", {}).get("prompt", 0)) == 0]}

@app.post("/chat")
async def chat(request: ChatRequest):
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}", "Content-Type": "application/json", "HTTP-Referer": "http://localhost:5173", "X-Title": "Madlen AI"}
    
    # Debug için terminale yazdıralım
    print(f"Gelen mesaj sayısı: {len(request.messages)}")

    async with httpx.AsyncClient() as client:
        try:
            # Multi-modal yapıyı koruyarak OpenRouter'a gönder
            response = await client.post(
                "https://openrouter.ai/api/v1/chat/completions", 
                headers=headers, 
                json={"model": request.model_id, "messages": [m.dict() for m in request.messages]}, 
                timeout=60.0
            )
            
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail=response.json())
            
            ai_text = response.json()["choices"][0]["message"]["content"]
            user_raw = request.messages[-1].content
            
            # DB'ye kaydederken görsel yapısını temiz metne çevir
            db_user_content = user_raw if isinstance(user_raw, str) else "[Görsel Mesaj Analizi]"
            
            conn = sqlite3.connect(DB_PATH)
            conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", (request.session_id, "user", str(db_user_content)))
            conn.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", (request.session_id, "assistant", ai_text))
            conn.commit()
            conn.close()
            return response.json()
        except Exception as e: raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)