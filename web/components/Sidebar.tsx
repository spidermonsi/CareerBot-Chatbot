"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

type ConversationItem = { id: string; title: string; updatedAt: string };

const GROUPS = ["Today", "Yesterday", "Previous 7 days", "Older"] as const;

// decide which group a date belongs to
function groupFor(dateString: string) {
  const DAY = 24 * 60 * 60 * 1000;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const t = new Date(dateString).getTime();

  if (t >= startOfToday.getTime()) return "Today";
  if (t >= startOfToday.getTime() - DAY) return "Yesterday";
  if (t >= startOfToday.getTime() - 7 * DAY) return "Previous 7 days";
  return "Older";
}

export default function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // the open chat's ID, taken from the URL (/c/<id>)
  const activeId = pathname.startsWith("/c/") ? pathname.slice(3) : null;

  const loadConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/conversations", { cache: "no-store" });
      if (res.ok) setItems(await res.json());
    } finally {
      setLoaded(true);
    }
  }, []);

  // load the list once, and again whenever a chat is created or updated
  useEffect(() => {
    loadConversations();
    window.addEventListener("conversations-changed", loadConversations);
    return () => window.removeEventListener("conversations-changed", loadConversations);
  }, [loadConversations]);

  async function renameChat(item: ConversationItem) {
    const input = window.prompt("Rename chat", item.title);
    const title = input?.trim().slice(0, 80);
    if (!title || title === item.title) return;

    const res = await fetch(`/api/conversations/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) loadConversations();
  }

  async function deleteChat(item: ConversationItem) {
    if (!window.confirm(`Delete "${item.title}"?`)) return;

    const res = await fetch(`/api/conversations/${item.id}`, { method: "DELETE" });
    if (!res.ok) return;
    if (item.id === activeId) router.push("/"); // leave the deleted chat
    loadConversations();
  }

  async function deleteAll() {
    if (!window.confirm("Delete all your chats? This cannot be undone.")) return;

    const res = await fetch("/api/conversations", { method: "DELETE" });
    if (!res.ok) return;
    router.push("/");
    loadConversations();
  }

  const grouped = GROUPS.map((name) => ({
    name,
    chats: items.filter((item) => groupFor(item.updatedAt) === name),
  })).filter((group) => group.chats.length > 0);

  return (
    <div className="flex h-full flex-col bg-gray-50 dark:bg-gray-900">
      <div className="hidden px-4 pt-4 text-lg font-semibold md:block">CareerBot</div>

      <div className="p-3">
        <Link
          href="/"
          onClick={onNavigate}
          className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-sm font-medium hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          + New chat
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-2">
        {loaded && items.length === 0 && (
          <p className="px-3 py-4 text-sm text-gray-500">
            No chats yet. Your conversations will show up here.
          </p>
        )}

        {grouped.map((group) => (
          <div key={group.name} className="mb-4">
            <p className="px-3 pb-1 text-xs font-medium uppercase text-gray-500">{group.name}</p>

            {group.chats.map((chat) => (
              <div
                key={chat.id}
                className={`group flex items-center rounded-lg ${
                  chat.id === activeId
                    ? "bg-gray-200 dark:bg-gray-800"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Link
                  href={`/c/${chat.id}`}
                  prefetch={false}
                  onClick={onNavigate}
                  className="min-w-0 flex-1 truncate px-3 py-2 text-sm"
                >
                  {chat.title}
                </Link>

                <div className="flex gap-2 pr-2 text-xs text-gray-500 md:hidden md:group-hover:flex">
                  <button onClick={() => renameChat(chat)} className="hover:text-gray-900 dark:hover:text-gray-100">
                    Rename
                  </button>
                  <button onClick={() => deleteChat(chat)} className="hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-800">
        {items.length > 0 && (
          <button onClick={deleteAll} className="mb-2 hover:text-red-600">
            Delete all chats
          </button>
        )}
        <p>Chats are saved in this browser and deleted after 90 days of inactivity.</p>
      </div>
    </div>
  );
}