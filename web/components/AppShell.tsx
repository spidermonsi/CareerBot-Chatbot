"use client";

import { useEffect, useState } from "react";
import Sidebar from "@/components/Sidebar";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false); // is the mobile drawer open?

  // Wake up the bot service as soon as the site loads.
  useEffect(() => {
    fetch("/api/health", { cache: "no-store" }).catch(() => {});
  }, []);

  return (
    <div className="flex h-screen bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Sidebar: fixed drawer on phones, a normal column on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 shrink-0 border-r border-gray-200 transition-transform dark:border-gray-800 md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <Sidebar onNavigate={() => setOpen(false)} />
      </aside>

      {/* Dark overlay behind the drawer on phones */}
      {open && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar, phones only */}
        <div className="flex items-center gap-3 border-b border-gray-200 px-4 py-3 md:hidden dark:border-gray-800">
          <button aria-label="Open menu" onClick={() => setOpen(true)} className="text-xl leading-none">
            ☰
          </button>
          <span className="font-semibold">CareerBot</span>
        </div>

        <main className="min-h-0 flex-1">{children}</main>
      </div>
    </div>
  );
}