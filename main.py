import os
from typing import List
import httpx
from fastapi import FastAPI, HTTPException

from pydantic import BaseModel
from dotenv import load_dotenv

from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI(title="Madlen Chat API")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], # In production, you'd specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Configuration
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENROUTER_URL = "https://openrouter.ai/api/v1"



# --- 1. SCHEMAS (Data Structures) ---
# We define these to ensure type safety and automatic documentation[cite: 13, 49].

class Message(BaseModel):
    role: str  # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    model_id: str
    messages: List[Message]

# --- 2. ENDPOINTS ---


@app.get("/models")
async def get_models():
    """Fetches and filters only FREE models from OpenRouter[cite: 8, 23]."""
    
    
    # main.py içindeki chat fonksiyonu
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:5173", # Uygulama adresi
        "X-Title": "Madlen AI Chat", # Uygulama adı
        "Content-Type": "application/json"
    }
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(f"{OPENROUTER_URL}/models", headers=headers)
            response.raise_for_status() # Raises an error if the API is down [cite: 42]
            
            all_models = response.json().get("data", [])
            
            # Logic: Filter models where prompt and completion costs are 0[cite: 23].
            free_models = [
                {
                    "id": m["id"],
                    "name": m["name"],
                    "context_length": m["context_length"]
                }
                for m in all_models 
                if float(m.get("pricing", {}).get("prompt", 0)) == 0 
                and float(m.get("pricing", {}).get("completion", 0)) == 0
            ]
            return {"models": free_models}
        
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        



@app.post("/chat")
async def chat(request: ChatRequest):
    """Sohbet geçmişini seçilen modele gönderir ve yanıtı döner."""
    
    # EKSİK BAŞLIKLAR EKLENDİ: OpenRouter free modeller için bu ikisi zorunludur.
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "HTTP-Referer": "http://localhost:5173", # Lokal geliştirme adresi
        "X-Title": "Madlen AI Chat",             # Uygulama adı
        "Content-Type": "application/json",
    }
    
    payload = {
        "model": request.model_id,
        "messages": [msg.dict() for msg in request.messages]
    }

    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{OPENROUTER_URL}/chat/completions", 
                headers=headers, 
                json=payload,
                timeout=60.0 
            )
            
            # Hata detayını yakalamak için geliştirildi
            if response.status_code != 200:
                error_body = response.json()
                error_msg = error_body.get("error", {}).get("message", "OpenRouter API Error")
                raise HTTPException(status_code=response.status_code, detail=error_msg)
                
            return response.json()
            
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail="Bağlantı Hatası")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)