import os
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# read the .env file so os.getenv can see BOT_API_KEY
load_dotenv()
BOT_API_KEY = os.getenv("BOT_API_KEY")

from bot.chatbot import respond  # imported after load_dotenv so env vars are ready

# create the app, all endpoints attach to this object.
app = FastAPI()


# describes one chat message: who sent it and what it says
class Message(BaseModel):
    role: str        # "user" or "assistant"
    content: str     # the message text


# describes the JSON body that /chat expects
# fastAPI rejects anything that doesn't match this shape
class ChatRequest(BaseModel):
    messages: list[Message]


# stops the request if the API key is missing or wrong
def check_key(x_api_key: str | None):
    if not BOT_API_KEY or x_api_key != BOT_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


# get /health: no key needed, only confirms the server is awake
@app.get("/health")
def health():
    return {"status": "ok"}


# POST /chat: receives the conversation and returns and bot's reply
# x_api_key is read from the "X-API-KEY" request header
@app.post("/chat")
def chat(body: ChatRequest, x_api_key: str | None = Header(default=None)):
    check_key(x_api_key) # reject the request if the key is wrong

    # the last message must be the user's new message
    if not body.messages or body.messages[-1].role != "user":
        raise HTTPException(status_code=400, detail="Last message  must be from the user")

    history = [{"role": m.role, "content": m.content} for m in body.messages[:-1]]
    message = body.messages[-1].content

    d, pieces = respond(history, message)   # the bot runs here  

    return StreamingResponse(
        pieces,
        media_type="text/plain", #the reply is plain text
        # extra info send alongside the reply (placeholders for now)
        headers={
            "X-Intent": d["intent"] or "none",
            "X-Confidence": f"{d['score']:.3f}",
            "X-Route": d["action"],
        },
    )