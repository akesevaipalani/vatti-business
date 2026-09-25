import React, { createContext, useContext, useState, useEffect } from "react";
import { UserSession } from "../types";
import { api, getToken, getStoredUser, clearSession, setUnauthorizedCallback } from "../services/api";

interface AuthContextType {
  user: UserSession | null;
  isAuthenticated: boolean;
  isOnline: boolean;
  language: "ta" | "en";
  setLanguage: (lang: "ta" | "en") => void;
  login: (u: string, p: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSession | null>(() => getStoredUser());
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [language, setLanguageState] = useState<"ta" | "en">(() => {
    return (localStorage.getItem("vatti_lang") as "ta" | "en") || "en";
  });

  const isAuthenticated = !!user && !!getToken();

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setUnauthorizedCallback(() => {
      clearSession();
      setUser(null);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const setLanguage = (lang: "ta" | "en") => {
    setLanguageState(lang);
    localStorage.setItem("vatti_lang", lang);
  };

  const login = async (u: string, p: string) => {
    const res = await api.login(u, p);
    setUser(res.user);
  };

  const logout = async () => {
    await api.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isOnline,
        language,
        setLanguage,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
