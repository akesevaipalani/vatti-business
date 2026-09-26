"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { getTranslations, Translations } from "@/lib/translations";
import { formatISTDisplay, formatISTDateTime } from "@/lib/date";

interface LanguageContextType {
  lang: "en" | "ta";
  setLang: (lang: "en" | "ta") => void;
  toggleLang: () => void;
  t: Translations;
  formatCurrency: (amount: number | null | undefined) => string;
  formatDate: (date: Date | string | null | undefined) => string;
  formatDateTime: (date: Date | string | null | undefined) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<"en" | "ta">("en");

  useEffect(() => {
    try {
      const savedLang = localStorage.getItem("vatti_lang") as "en" | "ta";
      if (savedLang === "en" || savedLang === "ta") {
        setLangState(savedLang);
      }
    } catch {
      // LocalStorage error fallback
    }
  }, []);

  const setLang = (newLang: "en" | "ta") => {
    setLangState(newLang);
    try {
      localStorage.setItem("vatti_lang", newLang);
    } catch {}
  };

  const toggleLang = () => {
    setLang(lang === "en" ? "ta" : "en");
  };

  const t = getTranslations(lang);

  const formatCurrency = (amount: number | null | undefined): string => {
    const val = Number(amount || 0);
    const isNegative = val < 0;
    const absVal = Math.abs(val);
    const formatted = absVal.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${isNegative ? "-" : ""}₹${formatted}`;
  };

  const formatDate = (date: Date | string | null | undefined): string => {
    return formatISTDisplay(date);
  };

  const formatDateTime = (date: Date | string | null | undefined): string => {
    return formatISTDateTime(date);
  };

  return (
    <LanguageContext.Provider
      value={{
        lang,
        setLang,
        toggleLang,
        t,
        formatCurrency,
        formatDate,
        formatDateTime,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
