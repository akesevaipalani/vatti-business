"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Users, CreditCard, DollarSign, Wallet, ArrowRight } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface SearchResult {
  id: string;
  title: string;
  subtitle: string;
  category: "customer" | "loan" | "partner" | "page";
  url: string;
}

export function CommandPalette({
  isOpen,
  onClose,
  isAdmin = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { t } = useLanguage();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onClose(); // toggle
      }
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) {
      setQuery("");
      setResults([]);
      return;
    }

    if (!query.trim()) {
      // Default quick navigation links
      setResults([
        { id: "p1", title: t.dailyCollections, subtitle: "Quick record daily payments", category: "page", url: "/daily-collections" },
        { id: "p2", title: t.newLoan, subtitle: "Issue a new loan to customer", category: "page", url: "/loans/new" },
        ...(isAdmin ? [{ id: "p3", title: t.partners, subtitle: "Manage partners and investments", category: "page", url: "/partners" } as SearchResult] : []),
        ...(isAdmin ? [{ id: "p4", title: t.dayClosing, subtitle: "Reconcile daily cash and lock day", category: "page", url: "/day-closing" } as SearchResult] : []),
        { id: "p5", title: t.reports, subtitle: "P&L, Balance Sheet, Ledgers", category: "page", url: "/reports" },
      ]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query, isOpen, t]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Search Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 dark:border-slate-800 gap-3">
          <Search className="w-5 h-5 text-slate-400" />
          <input
            autoFocus
            type="text"
            className="w-full bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none text-base"
            placeholder={t.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="px-2 py-0.5 text-xs text-slate-500 bg-slate-100 dark:bg-slate-800 rounded font-mono border border-slate-300 dark:border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-96 overflow-y-auto p-2">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">No results found for &quot;{query}&quot;</div>
          ) : (
            <div className="space-y-1">
              {results.map((item) => {
                const getIcon = () => {
                  switch (item.category) {
                    case "customer":
                      return <Users className="w-4 h-4 text-indigo-500" />;
                    case "loan":
                      return <CreditCard className="w-4 h-4 text-amber-500" />;
                    case "partner":
                      return <DollarSign className="w-4 h-4 text-emerald-500" />;
                    default:
                      return <Wallet className="w-4 h-4 text-slate-400" />;
                  }
                };

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      router.push(item.url);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-left transition group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-slate-100 dark:bg-slate-800 group-hover:bg-white dark:group-hover:bg-slate-700 transition">
                        {getIcon()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {item.title}
                        </div>
                        <div className="text-xs text-slate-500">{item.subtitle}</div>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-500 transition" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between text-xs text-slate-400">
          <span>Private Business System</span>
          <div className="flex gap-2">
            <span>Navigate: ↑ ↓</span>
            <span>Select: ↵</span>
          </div>
        </div>
      </div>
    </div>
  );
}
