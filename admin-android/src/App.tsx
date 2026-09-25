import React, { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { BottomNav, AdminNavTab } from "./components/BottomNav";
import { OfflineBanner } from "./components/OfflineBanner";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { PartnersScreen } from "./screens/PartnersScreen";
import { CustomersScreen } from "./screens/CustomersScreen";
import { LoansScreen } from "./screens/LoansScreen";
import { MoreScreen, MoreSubview } from "./screens/MoreScreen";
import { getServerUrl, getToken } from "./services/api";

const MainApp: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const [currentTab, setCurrentTab] = useState<AdminNavTab>("home");
  const [moreSubview, setMoreSubview] = useState<MoreSubview>(null);

  // Real-time SSE sync listener for background updates
  useEffect(() => {
    if (!isAuthenticated) return;

    const serverUrl = getServerUrl();
    const token = getToken();
    const sseUrl = `${serverUrl}/api/sync/events${token ? `?token=${encodeURIComponent(token)}` : ""}`;

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(sseUrl);
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("[ADMIN SSE] Sync event received:", data);
        } catch {
          // ignore
        }
      };
      eventSource.onerror = () => {
        // SSE auto-reconnects
      };
    } catch {
      // EventSource may not be supported or error on setup
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-white font-sans antialiased select-none">
      <OfflineBanner />

      <main className="min-h-screen pb-16">
        {currentTab === "home" && (
          <HomeScreen
            onNavigateToPartners={() => setCurrentTab("partners")}
            onNavigateToCustomers={() => setCurrentTab("customers")}
            onNavigateToLoans={() => setCurrentTab("loans")}
            onNavigateToMore={(subviewName) => {
              if (subviewName === "cashbook" || subviewName === "bank" || subviewName === "cash_bank") {
                setMoreSubview("cash_bank");
                setCurrentTab("more");
              } else if (subviewName === "collections" || subviewName === "daily" || subviewName === "daily_collection") {
                setMoreSubview("daily_collection");
                setCurrentTab("more");
              } else if (subviewName === "closing" || subviewName === "day_closing") {
                setMoreSubview("day_closing");
                setCurrentTab("more");
              } else if (subviewName === "reports") {
                setMoreSubview("reports");
                setCurrentTab("more");
              } else if (subviewName === "expenses" || subviewName === "income" || subviewName === "income_expense") {
                setMoreSubview("income_expense");
                setCurrentTab("more");
              } else if (subviewName === "settings") {
                setMoreSubview("settings");
                setCurrentTab("more");
              } else if (subviewName === "audit_logs") {
                setMoreSubview("audit_logs");
                setCurrentTab("more");
              } else if (subviewName === "password") {
                setMoreSubview("password");
                setCurrentTab("more");
              } else {
                setMoreSubview(null);
                setCurrentTab("more");
              }
            }}
          />
        )}

        {currentTab === "partners" && <PartnersScreen />}

        {currentTab === "customers" && <CustomersScreen />}

        {currentTab === "loans" && <LoansScreen />}

        {currentTab === "more" && (
          <MoreScreen
            initialSubview={moreSubview}
            onClearInitialSubview={() => setMoreSubview(null)}
          />
        )}
      </main>

      <BottomNav
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          setMoreSubview(null);
        }}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
};
