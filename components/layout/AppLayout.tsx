"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  CreditCard,
  CheckCircle2,
  WalletCards,
  Percent,
  Landmark,
  Wallet,
  Building2,
  Receipt,
  ArrowUpRight,
  Contact,
  BookOpen,
  Clock,
  BarChart3,
  Database,
  Settings,
  ShieldAlert,
  Search,
  Plus,
  Lock,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Globe,
  Sun,
  Moon,
  Calendar,
  Menu,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { CommandPalette } from "@/components/command/CommandPalette";
import { QuickActionModal } from "@/components/common/QuickActionModal";
import { LockScreenModal } from "@/components/common/LockScreenModal";
import { useLiveSync } from "@/hooks/useLiveSync";

interface CurrentUser {
  username: string;
  name: string;
  role: string;
  partnerId?: string | null;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t, lang, toggleLang, formatDate } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isDayClosed, setIsDayClosed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);

  // Live real-time sync across all 4 devices
  const { isConnected } = useLiveSync();

  // Check initial lock state and day closing status
  useEffect(() => {
    // Check lock
    const locked = localStorage.getItem("vatti_locked") === "true";
    if (locked) setIsLocked(true);

    // Check theme
    const savedTheme = localStorage.getItem("vatti_theme") as "light" | "dark";
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }

    // Check Day Closing status
    fetch("/api/day-closing/status")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.isClosed) setIsDayClosed(true);
      })
      .catch(() => {});

    // Fetch current user session
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.authenticated && data.user) {
          setCurrentUser(data.user);
        }
      })
      .catch(() => {});
  }, []);

  const handleLock = () => {
    setIsLocked(true);
    localStorage.setItem("vatti_locked", "true");
  };

  const handleUnlock = () => {
    setIsLocked(false);
    localStorage.removeItem("vatti_locked");
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    localStorage.setItem("vatti_theme", nextTheme);
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {}
    router.push("/login");
  };

  // Skip layout for login and setup wizard
  if (pathname === "/login" || pathname === "/setup") {
    return <>{children}</>;
  }

  const isAdmin = currentUser?.role === "ADMIN";

  const navSections = [
    {
      title: isAdmin ? "Lending & Partners" : "Lending & Operations",
      items: [
        { label: t.dashboard, href: "/dashboard", icon: LayoutDashboard },
        ...(isAdmin ? [{ label: t.partners, href: "/partners", icon: Users }] : []),
        { label: t.loansGiven, href: "/loans", icon: CreditCard },
        { label: t.dailyCollections, href: "/daily-collections", icon: CheckCircle2, highlight: true },
        { label: t.collections, href: "/collections", icon: WalletCards },
        { label: t.interestManagement, href: "/interest", icon: Percent },
        { label: t.loansTaken, href: "/loans-taken", icon: Landmark },
      ],
    },
    {
      title: "Cash & Records",
      items: [
        { label: t.cashBook, href: "/cash-book", icon: Wallet },
        { label: t.bankAccounts, href: "/bank-accounts", icon: Building2 },
        { label: t.expenses, href: "/expenses", icon: Receipt },
        { label: t.income, href: "/income", icon: ArrowUpRight },
        { label: t.customers, href: "/customers", icon: Contact },
      ],
    },
    {
      title: "Accounting & Reports",
      items: [
        { label: t.accountingLedger, href: "/accounting/ledger", icon: BookOpen },
        ...(isAdmin ? [{ label: t.dayClosing, href: "/day-closing", icon: Clock }] : []),
        { label: t.reports, href: "/reports", icon: BarChart3 },
      ],
    },
    ...(isAdmin
      ? [
          {
            title: "Administration",
            items: [
              { label: t.auditLog, href: "/audit-log", icon: ShieldAlert },
              { label: t.backupRestore, href: "/backup", icon: Database },
              { label: t.settings, href: "/settings", icon: Settings },
            ],
          },
        ]
      : [
          {
            title: "Account",
            items: [
              {
                label: lang === "ta" ? "சுயவிவரம் & கடவுச்சொல்" : "Profile & Security",
                href: "/settings",
                icon: Settings,
              },
            ],
          },
        ]),
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 dark:bg-slate-950">
      {/* Modals */}
      <CommandPalette isOpen={searchOpen} onClose={() => setSearchOpen(false)} isAdmin={isAdmin} />
      <QuickActionModal isOpen={quickActionOpen} onClose={() => setQuickActionOpen(false)} isAdmin={isAdmin} />
      <LockScreenModal isLocked={isLocked} onUnlock={handleUnlock} />

      {/* MOBILE DRAWER (SLIDE-OVER) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative flex flex-col w-72 max-w-[80vw] bg-white dark:bg-slate-900 shadow-2xl z-10">
            <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm flex items-center justify-center shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
                </div>
                <div>
                  <div className="font-bold text-sm text-slate-900 dark:text-slate-100">{t.appName}</div>
                  <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium truncate max-w-[140px]">
                    {currentUser ? `${currentUser.name}` : t.privateUseOnly}
                  </div>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
              {navSections.map((sec, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                    {sec.title}
                  </div>
                  {sec.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                          isActive
                            ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                            : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60"
                        }`}
                      >
                        <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleLogout();
                }}
                className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/30 font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.logout}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDEBAR (DESKTOP) */}
      <aside
        className={`hidden md:flex relative flex-col border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all duration-300 select-none z-30 ${
          collapsed ? "w-16" : "w-64"
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
          {!collapsed && (
            <Link href="/dashboard" className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-lg overflow-hidden bg-white border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
              </div>
              <div className="truncate">
                <div className="font-bold text-sm text-slate-900 dark:text-slate-100 tracking-tight">
                  {t.appName}
                </div>
                <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                  {t.privateUseOnly}
                </div>
              </div>
            </Link>
          )}

          {collapsed && (
            <div className="w-9 h-9 mx-auto rounded-lg overflow-hidden bg-white border border-slate-200 dark:border-slate-700 p-0.5 shadow-sm flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain" />
            </div>
          )}

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Items */}
        <div className="flex-1 overflow-y-auto py-3 px-2 space-y-4">
          {navSections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              {!collapsed && (
                <div className="px-3 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                  {sec.title}
                </div>
              )}
              {sec.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
                    } ${item.highlight ? "border-l-2 border-emerald-500" : ""}`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-indigo-600 dark:text-indigo-400" : ""}`} />
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        {/* Bottom Lock / System Info */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <button
            onClick={handleLock}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs text-slate-600 dark:text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30 transition"
            title="Lock Application"
          >
            <Lock className="w-4 h-4 text-rose-500" />
            {!collapsed && <span>{t.lockApp}</span>}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* TOP BAR */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
          {/* Left: Mobile hamburger & User Badge & Search */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 -ml-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 md:hidden"
              title="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* User Badge / Device Indicator */}
            {currentUser && (
              <Link
                href="/settings"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/50 dark:border-indigo-800/50 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition cursor-pointer"
                title={lang === "ta" ? "சுயவிவரம் மற்றும் அமைப்புகள்" : "Profile & Settings"}
              >
                <span className="w-2 h-2 rounded-full bg-indigo-600" />
                <span className="max-w-[100px] sm:max-w-none truncate">{currentUser.name}</span>
                <span className="text-[10px] uppercase font-bold text-indigo-500">[{currentUser.role}]</span>
              </Link>
            )}

            {/* Sync Status Badge */}
            <div
              className={`flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${
                isConnected
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400 border border-amber-200 dark:border-amber-800"
              }`}
              title={isConnected ? "Multi-device real-time sync active" : "Reconnecting to central sync server..."}
            >
              {isConnected ? <Wifi className="w-3 h-3 text-emerald-500" /> : <WifiOff className="w-3 h-3 text-amber-500" />}
              <span className="hidden sm:inline">{isConnected ? "Live Sync" : "Syncing..."}</span>
            </div>

            {/* Global Search trigger (desktop only) */}
            <div className="hidden lg:flex items-center gap-3 w-56 xl:w-72">
              <button
                onClick={() => setSearchOpen(true)}
                className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-400 hover:border-slate-300 transition"
              >
                <div className="flex items-center gap-2">
                  <Search className="w-3.5 h-3.5 text-slate-400" />
                  <span>{t.searchPlaceholder}</span>
                </div>
                <kbd className="px-1.5 py-0.5 rounded bg-white dark:bg-slate-700 text-[10px] font-mono border border-slate-200 dark:border-slate-600">
                  Ctrl+K
                </kbd>
              </button>
            </div>
          </div>

          {/* Right: Status Badges and Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Today's Date */}
            <div className="hidden xl:flex items-center gap-1.5 text-xs text-slate-500 font-medium px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{formatDate(new Date())}</span>
            </div>

            {/* Day Status Badge */}
            <Link
              href="/day-closing"
              className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition ${
                isDayClosed
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-400"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isDayClosed ? "bg-rose-500" : "bg-emerald-500"}`} />
              <span>{isDayClosed ? t.dayClosed : t.dayOpen}</span>
            </Link>

            {/* Quick Action Button */}
            <button
              onClick={() => setQuickActionOpen(true)}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t.quickAction}</span>
            </button>

            {/* Language Switcher */}
            <button
              onClick={toggleLang}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-bold text-indigo-600 dark:text-indigo-400 transition"
              title="Switch Language / மொழியை மாற்றுக"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>{lang === "en" ? "தமிழ்" : "EN"}</span>
            </button>

            {/* Dark / Light Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title="Toggle Theme"
            >
              {theme === "light" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Lock App Button */}
            <button
              onClick={handleLock}
              className="hidden sm:block p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500 transition"
              title={t.lockApp}
            >
              <Lock className="w-4 h-4" />
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT CONTAINER (WITH MOBILE SAFE-BOTTOM PADDING) */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-6 bg-slate-50/50 dark:bg-slate-950">
          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR (FIXED) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center justify-around h-16 px-1 shadow-lg">
        <Link
          href="/dashboard"
          className={`flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-medium transition ${
            pathname === "/dashboard"
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span>Home</span>
        </Link>

        <Link
          href="/daily-collections"
          className={`relative flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-medium transition ${
            pathname === "/daily-collections"
              ? "text-emerald-600 dark:text-emerald-400 font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          <CheckCircle2 className="w-5 h-5 mb-0.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-emerald-700 dark:text-emerald-300 font-bold">Daily</span>
        </Link>

        <Link
          href="/loans"
          className={`flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-medium transition ${
            pathname.startsWith("/loans")
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          <CreditCard className="w-5 h-5 mb-0.5" />
          <span>Loans</span>
        </Link>

        <Link
          href="/customers"
          className={`flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-medium transition ${
            pathname.startsWith("/customers")
              ? "text-indigo-600 dark:text-indigo-400 font-bold"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400"
          }`}
        >
          <Contact className="w-5 h-5 mb-0.5" />
          <span>Customers</span>
        </Link>

        <button
          onClick={() => setMobileMenuOpen(true)}
          className="flex flex-col items-center justify-center w-full h-full py-1 text-[10px] font-medium text-slate-500 hover:text-slate-900 dark:text-slate-400"
        >
          <Menu className="w-5 h-5 mb-0.5" />
          <span>Menu</span>
        </button>
      </nav>
    </div>
  );
}
