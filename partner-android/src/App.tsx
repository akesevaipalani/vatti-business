import React, { useState } from "react";
import { useAuth } from "./context/AuthContext";
import { OfflineBanner } from "./components/OfflineBanner";
import { BottomNav, NavTab } from "./components/BottomNav";
import { LoginScreen } from "./screens/LoginScreen";
import { HomeScreen } from "./screens/HomeScreen";
import { DailyScreen } from "./screens/DailyScreen";
import { LoansScreen } from "./screens/LoansScreen";
import { CustomersScreen } from "./screens/CustomersScreen";
import { MoreScreen } from "./screens/MoreScreen";

export const App: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>("home");

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col font-sans select-none antialiased">
      <OfflineBanner />

      <main className="flex-1">
        {currentTab === "home" && (
          <HomeScreen
            onNavigateToDaily={() => setCurrentTab("daily")}
            onNavigateToCustomers={() => setCurrentTab("customers")}
            onNavigateToLoans={() => setCurrentTab("loans")}
          />
        )}
        {currentTab === "daily" && <DailyScreen />}
        {currentTab === "loans" && <LoansScreen />}
        {currentTab === "customers" && <CustomersScreen />}
        {currentTab === "more" && <MoreScreen />}
      </main>

      <BottomNav currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};
