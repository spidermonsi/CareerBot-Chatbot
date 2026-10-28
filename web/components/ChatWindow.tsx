"use client";

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";

type Feedback = "up" | "down";

type Message = {
  id?: string; // saved messages have an ID, needed for feedback
  role: "user" | "assistant";
  content: string;
  feedback?: Feedback;
};

type Payload = { message?: string; regenerate?: boolean };

// What the error box shows, and what the "Try again" button should send
type ChatError = { message: string; retry: Payload };

type Props = {
  initialConversationId?: string;
  initialMessages?: Message[];
};

const JSON_HEADERS = { "Content-Type": "application/json" };

export default function ChatWindow({ initialConversationId, initialMessages = [] }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ChatError | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Scroll to the newest message (or error) whenever they change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, error]);

  // One function for sending, regenerating, and retrying.
  // "base" is the list of messages to show before the new bot reply.
  async function streamReply(base: Message[], payload: Payload) {
    setMessages([...base, { role: "assistant", content: "" }]);
    setError(null);
    setLoading(true);

    let userSaved = false; // once the server answers OK, the user's message is already saved
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ conversationId, ...payload }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        const botDown = res.status === 502; // the server saved the message, the bot failed

        // Remember the chat's ID even on failure, so a retry continues the same chat
        const savedId = res.headers.get("X-Conversation-Id");
        if (savedId) {
          setConversationId(savedId);
          window.dispatchEvent(new Event("conversations-changed"));
        }

        setMessages(base); // remove the empty bot bubble
        setError({
          message: botDown
            ? "CareerBot's server is not responding. It may be waking up, so try again in a few seconds."
            : data?.error ?? "Something went wrong. Please try again.",
          retry: botDown ? { regenerate: true } : payload,
        });
        return;
      }
      userSaved = true;

      // A brand new chat gets its ID from the server
      const newId = res.headers.get("X-Conversation-Id");
      if (newId && newId !== conversationId) {
        setConversationId(newId);
        window.dispatchEvent(new Event("conversations-changed")); // show it in the sidebar now
      }
      const messageId = res.headers.get("X-Message-Id") ?? undefined;

      // Read the streamed reply piece by piece
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value, { stream: true });
        setMessages([...base, { id: messageId, role: "assistant", content: reply }]);
      }

      // The reply is saved now: refresh the sidebar, and move a new chat to its own URL
      window.dispatchEvent(new Event("conversations-changed"));
      const activeId = newId ?? conversationId;
      if (activeId && pathname === "/") router.replace(`/c/${activeId}`);
    } catch {
      setMessages(base);
      setError({
        message: "The connection was interrupted. Please try again.",
        retry: userSaved ? { regenerate: true } : payload,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    streamReply([...messages, { role: "user", content: text }], { message: text });
  }

  // Enter sends, Shift+Enter makes a new line
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      handleSubmit();
    }
  }

  // Remove the last bot answer and ask for a new one
  function regenerate() {
    if (loading) return;
    streamReply(messages.slice(0, -1), { regenerate: true });
  }

  async function copyMessage(text: string, index: number) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 1500);
    } catch {
      // clipboard not available, ignore
    }
  }

  // Thumbs up or down; pressing the same thumb again clears it
  async function sendFeedback(index: number, value: Feedback) {
    const msg = messages[index];
    if (!msg?.id || !conversationId) return;

    const next = msg.feedback === value ? null : value;
    setMessages((prev) =>
      prev.map((m, i) => (i === index ? { ...m, feedback: next ?? undefined } : m))
    );
    await fetch(`/api/conversations/${conversationId}/messages/${msg.id}/feedback`, {
      method: "POST",
      headers: JSON_HEADERS,
      body: JSON.stringify({ value: next }),
    }).catch(() => {});
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {messages.length === 0 && !error && (
            <p className="mt-20 text-center text-gray-500">
              Ask me about computing careers, skills, resumes, internships, or interviews.
            </p>
          )}

          {messages.map((m, i) => {
            const isLast = i === messages.length - 1;
            const streaming = loading && isLast && m.role === "assistant";

            return (
              <div
                key={i}
                className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
              >
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

                {m.role === "assistant" && m.content && !streaming && (
                  <div className="mt-1 flex gap-3 px-1 text-xs text-gray-500">
                    <button
                      onClick={() => copyMessage(m.content, i)}
                      className="hover:text-gray-900 dark:hover:text-gray-100"
                    >
                      {copiedIndex === i ? "Copied" : "Copy"}
                    </button>

                    {m.id && (
                      <>
                        <button
                          aria-label="Helpful answer"
                          onClick={() => sendFeedback(i, "up")}
                          className={m.feedback === "up" ? "opacity-100" : "opacity-50 hover:opacity-100"}
                        >
                          👍
                        </button>
                        <button
                          aria-label="Unhelpful answer"
                          onClick={() => sendFeedback(i, "down")}
                          className={m.feedback === "down" ? "opacity-100" : "opacity-50 hover:opacity-100"}
                        >
                          👎
                        </button>
                      </>
                    )}

                    {isLast && !loading && (
                      <button
                        onClick={regenerate}
                        className="hover:text-gray-900 dark:hover:text-gray-100"
                      >
                        Regenerate
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
              <p>{error.message}</p>
              <button
                onClick={() => streamReply(messages, error.retry)}
                className="mt-2 font-medium underline"
              >
                Try again
              </button>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-200 p-4 dark:border-gray-800">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            rows={1}
            maxLength={1000}
            onChange={(e) => {
              setInput(e.target.value);
              // Grow with the text, up to 160px
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px";
            }}
            onKeyDown={handleKeyDown}
            placeholder="Ask about careers, skills, resumes..."
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-transparent px-4 py-2 outline-none focus:border-blue-600 dark:border-gray-700"
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