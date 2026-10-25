const BOT_API_URL = process.env.BOT_API_URL;
const BOT_API_KEY = process.env.BOT_API_KEY;

export type ChatMessage = { role: "user" | "assistant"; content: string};

// sends the conversation to the FastAPI bot service and returns its (streaming) response
export async function callBot(messages: ChatMessage[]) {
    if (!BOT_API_URL || !BOT_API_KEY) {
        throw new Error("BOT_API_URL OR BOT_API_KEY is missing");
    }
    return fetch(`${BOT_API_URL}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-API-Key": BOT_API_KEY,
        },
        body: JSON.stringify({ messages }),
        cache: "no-store",
    });
}
