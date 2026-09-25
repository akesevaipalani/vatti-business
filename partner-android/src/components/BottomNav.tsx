import React from "react";
import { LayoutDashboard, CalendarCheck, FileText, Users, MoreHorizontal } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type NavTab = "home" | "daily" | "loans" | "customers" | "more";

interface BottomNavProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  pendingCount?: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange, pendingCount }) => {
  const { language } = useAuth();

  const tabs: Array<{ id: NavTab; labelEn: string; labelTa: string; icon: React.ElementType }> = [
    { id: "home", labelEn: "Home", labelTa: "முகப்பு", icon: LayoutDashboard },
    { id: "daily", labelEn: "Daily", labelTa: "தினசரி", icon: CalendarCheck },
    { id: "loans", labelEn: "Loans", labelTa: "கடன்கள்", icon: FileText },
    { id: "customers", labelEn: "Customers", labelTa: "வாடிக்கையாளர்", icon: Users },
    { id: "more", labelEn: "More", labelTa: "கூடுதல்", icon: MoreHorizontal },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 z-40 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;
          const showBadge = tab.id === "daily" && typeof pendingCount === "number" && pendingCount > 0;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all tap-active relative ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
                {showBadge && (
                  <span className="absolute -top-1 -right-2.5 bg-rose-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border border-white">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                )}
              </div>
              <span className="text-[11px] mt-1 truncate">
                {language === "ta" ? tab.labelTa : tab.labelEn}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
