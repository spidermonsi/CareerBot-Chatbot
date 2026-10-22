import os
from dotenv import load_dotenv
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

# read the .env file so os.getenv can see BOT_API_KEY
load_dotenv()
BOT_API_KEY = os.getenv("BOT_API_KEY")

# create the app, all endpoints attach to this object.
app = FastAPI()


# describes one chat message: who sent it and what it says
class Message(BaseModel):
    role: str        # "user" or "assistant"
    content: str     # the message text


# describes the JSON body that /chat expects.
# fastAPI rejects anything that doesn't match this shape.
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

    # the newest message is the last one in the list
    last_user = body.messages[-1].content

    # a generator: each "yield" sends out a piece of the reply
    # later this will send Groq's answer piece by piece
    def stream():
        yield f"You said: {last_user}"


    # send the generator's output as it is produced
    return StreamingResponse(
        stream(),
        media_type="text/plain", #the reply is plain text
        # extra info send alongside the reply (placeholders for now)
        headers={
            "X-Intent": "placeholder",
            "X-Confidence": "0.0",
            "X-Route": "static",
        },
    )