import os
from typing import List
import httpx
from fastapi import FastAPI, HTTPException

from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="Madlen Chat API")

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
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "X-Title": "Madlen Case Study", # Recommended by OpenRouter
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
    """Sends a conversation history to the chosen model and returns the response[cite: 19]."""
    headers = {
        "Authorization": f"Bearer {OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }
    
    # We convert our Pydantic messages to a list of dictionaries for the API call.
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
                timeout=60.0 # AI can take a while to think
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            raise HTTPException(status_code=e.response.status_code, detail="OpenRouter API Error")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)










