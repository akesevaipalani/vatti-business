import React from "react";
import { LayoutDashboard, Users, UserSquare2, Banknote, Menu } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export type AdminNavTab = "home" | "partners" | "customers" | "loans" | "more";

interface BottomNavProps {
  currentTab: AdminNavTab;
  onTabChange: (tab: AdminNavTab) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentTab, onTabChange }) => {
  const { language } = useAuth();

  const tabs = [
    {
      id: "home" as AdminNavTab,
      labelEn: "Home",
      labelTa: "முகப்பு",
      icon: LayoutDashboard,
    },
    {
      id: "partners" as AdminNavTab,
      labelEn: "Partners",
      labelTa: "பங்குதாரர்",
      icon: Users,
    },
    {
      id: "customers" as AdminNavTab,
      labelEn: "Customers",
      labelTa: "வாடிக்கையாளர்",
      icon: UserSquare2,
    },
    {
      id: "loans" as AdminNavTab,
      labelEn: "Loans",
      labelTa: "கடன்கள்",
      icon: Banknote,
    },
    {
      id: "more" as AdminNavTab,
      labelEn: "More",
      labelTa: "கூடுதல்",
      icon: Menu,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 z-40 shadow-lg">
      <div className="max-w-md mx-auto grid grid-cols-5 gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = currentTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-xl transition-all tap-active ${
                isActive
                  ? "text-indigo-600 dark:text-indigo-400 font-semibold"
                  : "text-slate-500 hover:text-slate-700 dark:text-slate-400"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : "stroke-[1.75]"}`} />
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
