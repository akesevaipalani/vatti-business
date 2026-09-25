import React from "react";
import { WifiOff } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export const OfflineBanner: React.FC = () => {
  const { isOnline, language } = useAuth();

  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white text-xs font-semibold px-4 py-2 flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md">
      <WifiOff className="w-4 h-4 animate-pulse flex-shrink-0" />
      <span>
        {language === "ta"
          ? "இணைய இணைப்பு இல்லை (Offline) - பணப் பதிவுகள் தற்காலிகமாக முடக்கப்பட்டுள்ளன"
          : "Offline Mode - Financial transactions disabled until reconnected"}
      </span>
    </div>
  );
};
