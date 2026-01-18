import os
import sqlite3
import httpx
from typing import List, Optional
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

# OpenTelemetry (Jaeger)
from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

load_dotenv()

# --- 1. OBSERVABILITY ---
resource = Resource(attributes={"service.name": "madlen-chat-backend"})
provider = TracerProvider(resource=resource)
processor = BatchSpanProcessor(OTLPSpanExporter(endpoint="http://localhost:4317", insecure=True))
provider.add_span_processor(processor)
trace.set_tracer_provider(provider)

app = FastAPI(title="Madlen Chat API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FastAPIInstrumentor.instrument_app(app)

# --- 2. DATABASE & SCHEMAS ---
DB_PATH = "chat_history.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    # Oturumlar tablosu
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Mesajlar tablosu (session_id ilişkisi eklendi)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER,
            role TEXT,
            content TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(session_id) REFERENCES sessions(id)
        )
    """)
    conn.commit()
    conn.close()

init_db()

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    model_id: str
    session_id: int  # Frontend'den hangi sohbet olduğu bilgisi gelir
    messages: List[Message]

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1"

# --- 3. ENDPOINTS ---

@app.get("/sessions")
async def get_sessions():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, title FROM sessions ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return {"sessions": [{"id": r[0], "title": r[1]} for r in rows]}

@app.post("/sessions")
async def create_session(title: str = "Yeni Sohbet"):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (title) VALUES (?)", (title,))
    session_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": session_id, "title": title}

@app.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: int):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT role, content FROM messages WHERE session_id = ? ORDER BY timestamp ASC", (session_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"messages": [{"role": r[0], "content": r[1]} for r in rows]}

@app.get("/models")
async def get_models():
    headers = {"Authorization": f"Bearer {OPENROUTER_API_KEY}"}
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{OPENROUTER_URL}/models", headers=headers)
            all_models = response.json().get("data", [])
            free_models = [{"id": m["id"], "name": m["name"]} for m in all_models if float(m.get("pricing", {}).get("prompt", 0)) == 0]
            return {"models": free_models}
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

@app.post("/chat")
async def chat(request: ChatRequest):
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:5173",
        "X-Title": "Madlen AI Chat Case Study",
        "Content-Type": "application/json"
    }
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{OPENROUTER_URL}/chat/completions", 
                headers=headers, 
                json={"model": request.model_id, "messages": [m.dict() for m in request.messages]},
                timeout=60.0 
            )
            if response.status_code != 200:
                raise HTTPException(status_code=response.status_code, detail="OpenRouter Error")
            
            ai_data = response.json()
            assistant_content = ai_data["choices"][0]["message"]["content"]
            user_content = request.messages[-1].content

            # SQLite Kaydı
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", 
                           (request.session_id, "user", user_content))
            cursor.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", 
                           (request.session_id, "assistant", assistant_content))
            conn.commit()
            conn.close()
            return ai_data
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)