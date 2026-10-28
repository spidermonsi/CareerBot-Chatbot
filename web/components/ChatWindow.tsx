"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

type Props = {
  initialConversationId?: string;
  initialMessages?: Message[];
};

export default function ChatWindow({ initialConversationId, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // scroll to the newest message whenever the list changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const history: Message[] = [...messages, { role: "user", content: text }];
    // show the user's message plus an empty bot bubble that fills in as text arrives
    setMessages([...history, { role: "assistant", content: "" }]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message: text }),
      });
      if (!res.ok || !res.body) throw new Error("Request failed");

      // a brand new chat gets its ID from the server
      let createdId: string | null = null;
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== conversationId) {
        setConversationId(newId);
        createdId = newId;
        window.dispatchEvent(new Event("conversations-changed")); // show it in the sidebar now
      }

      // read the streamed reply piece by piece
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...history, { role: "assistant", content: reply }]);
      }

      // the reply is saved now: refresh the sidebar order, and move a new chat to its own URL
      window.dispatchEvent(new Event("conversations-changed"));
      if (createdId) router.replace(`/c/${createdId}`);
    } catch {
      setMessages([
        ...history,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && (
            <p className="mt-20 text-center text-gray-500">
              Ask me about computing careers, skills, resumes, internships, or interviews.
            </p>
          )}

          {messages.map((m, i) => (
            <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2 ${
                  m.role === "user"
                    ? "whitespace-pre-wrap bg-blue-600 text-white"
                    : "bg-gray-100 dark:bg-gray-800"
                }`}
              >
                {m.role === "user" ? (
                  m.content
                ) : m.content ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                ) : (
                  <span className="text-gray-400">Typing...</span>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={sendMessage} className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about careers, skills, resumes..."
            maxLength={1000}
            className="flex-1 rounded-xl border border-gray-300 bg-transparent px-4 py-2 outline-none focus:border-blue-600 dark:border-gray-700"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded-xl bg-blue-600 px-4 py-2 text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}