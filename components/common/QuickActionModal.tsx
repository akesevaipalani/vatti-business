"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  X,
  CreditCard,
  CheckCircle2,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  UserPlus,
  Users,
  Receipt,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export function QuickActionModal({
  isOpen,
  onClose,
  isAdmin = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const { t } = useLanguage();

  if (!isOpen) return null;

  const rawActions = [
    {
      title: t.newLoan,
      subtitle: "Issue new loan & set terms",
      icon: <CreditCard className="w-5 h-5 text-amber-600" />,
      bg: "bg-amber-50 dark:bg-amber-950/30",
      href: "/loans/new",
    },
    {
      title: t.collectPayment,
      subtitle: "Fast daily collection recording",
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
      bg: "bg-emerald-50 dark:bg-emerald-950/30",
      href: "/daily-collections",
    },
    ...(isAdmin
      ? [
          {
            title: t.addInvestment,
            subtitle: "Add partner capital",
            icon: <TrendingUp className="w-5 h-5 text-indigo-600" />,
            bg: "bg-indigo-50 dark:bg-indigo-950/30",
            href: "/partners?action=invest",
          },
          {
            title: t.addWithdrawal,
            subtitle: "Record partner drawing",
            icon: <ArrowDownRight className="w-5 h-5 text-rose-600" />,
            bg: "bg-rose-50 dark:bg-rose-950/30",
            href: "/partners?action=withdraw",
          },
        ]
      : []),
    {
      title: t.addExpense,
      subtitle: "Record office/business expense",
      icon: <Receipt className="w-5 h-5 text-purple-600" />,
      bg: "bg-purple-50 dark:bg-purple-950/30",
      href: "/expenses?action=new",
    },
    {
      title: t.addIncome,
      subtitle: "Record fee, commission, or other income",
      icon: <ArrowUpRight className="w-5 h-5 text-cyan-600" />,
      bg: "bg-cyan-50 dark:bg-cyan-950/30",
      href: "/income?action=new",
    },
    {
      title: t.newCustomer,
      subtitle: "Register new borrower/customer",
      icon: <UserPlus className="w-5 h-5 text-blue-600" />,
      bg: "bg-blue-50 dark:bg-blue-950/30",
      href: "/customers?action=new",
    },
    ...(isAdmin
      ? [
          {
            title: t.newPartner,
            subtitle: "Add new business partner",
            icon: <Users className="w-5 h-5 text-teal-600" />,
            bg: "bg-teal-50 dark:bg-teal-950/30",
            href: "/partners?action=new",
          },
        ]
      : []),
  ];

  const actions = rawActions;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              {t.quickAction}
            </h3>
            <p className="text-xs text-slate-500">
              Select an action to record immediately
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[70vh] overflow-y-auto">
          {actions.map((act, i) => (
            <button
              key={i}
              onClick={() => {
                router.push(act.href);
                onClose();
              }}
              className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-left transition group"
            >
              <div className={`p-2.5 rounded-lg ${act.bg} shrink-0`}>
                {act.icon}
              </div>
              <div>
                <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                  {act.title}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{act.subtitle}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
