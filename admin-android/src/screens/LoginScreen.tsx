import React, { useState, useEffect } from "react";
import { Lock, User, Eye, EyeOff, AlertCircle, ShieldCheck, Activity, RefreshCw } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  getServerUrl,
  setServerUrl,
  DEFAULT_PRODUCTION_URL,
  subscribeDiagnostic,
  resetDiagnostic,
  api,
  DiagnosticInfo,
  getDiagnosticInfo,
} from "../services/api";

export const LoginScreen: React.FC = () => {
  const { login, language, setLanguage } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showServerConfig, setShowServerConfig] = useState(false);
  const [serverInput, setServerInput] = useState(() => getServerUrl());
  const [diagnostic, setDiagnostic] = useState<DiagnosticInfo>(() => getDiagnosticInfo());
  const [pinging, setPinging] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeDiagnostic((info) => {
      setDiagnostic(info);
    });
    return unsubscribe;
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError(language === "ta" ? "பயனர் பெயர் மற்றும் கடவுச்சொல்லை உள்ளிடவும்" : "Username and password are required");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(username.trim().toLowerCase(), password);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unable to connect to server. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async () => {
    setPinging(true);
    setError(null);
    try {
      await api.pingServer();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Ping failed";
      setError(msg);
    } finally {
      setPinging(false);
    }
  };

  const handleSaveServer = () => {
    if (serverInput.trim()) {
      setServerUrl(serverInput.trim());
      setShowServerConfig(false);
    }
  };

  const handleResetServer = () => {
    setServerUrl(DEFAULT_PRODUCTION_URL);
    setServerInput(DEFAULT_PRODUCTION_URL);
    setShowServerConfig(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col justify-between p-6">
      <div className="flex justify-between items-center pt-2">
        <div className="flex items-center gap-1.5 text-xs text-amber-400 font-bold tracking-wider uppercase">
          <ShieldCheck className="w-4 h-4" />
          <span>Vatti Admin Portal</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setLanguage(language === "en" ? "ta" : "en")}
            className="text-xs bg-slate-800 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white"
          >
            {language === "en" ? "தமிழ்" : "English"}
          </button>
        </div>
      </div>

      <div className="max-w-sm w-full mx-auto space-y-5 my-auto py-4">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-gradient-to-tr from-amber-500 to-indigo-600 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-amber-500/20">
            <span className="text-3xl font-extrabold text-white tracking-tight">👑</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">VATTI BUSINESS</h1>
          <p className="text-xs text-slate-400">
            {language === "ta" ? "நிர்வாகி உள்நுழைவு (Admin Portal)" : "Executive Cloud Administration"}
          </p>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs p-3.5 rounded-xl flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">
              {language === "ta" ? "நிர்வாகி பயனர் பெயர்" : "Admin Username"}
            </label>
            <div className="relative">
              <User className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-10 pr-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-400 font-medium">
              {language === "ta" ? "கடவுச்சொல்" : "Password"}
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-800/80 border border-slate-700 rounded-xl py-3 pl-10 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-gradient-to-r from-amber-600 to-indigo-600 hover:from-amber-500 hover:to-indigo-500 text-white font-bold py-3.5 px-4 rounded-xl shadow-lg shadow-indigo-600/30 transition tap-active flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <span>{language === "ta" ? "நிர்வாகியாக உள்நுழையவும்" : "Sign In as Admin"}</span>
            )}
          </button>
        </form>

        <div className="text-center pt-1 space-y-1">
          <div className="text-[11px] text-slate-400">
            <span>Server: </span>
            <span className="font-mono text-amber-400 font-semibold">{getServerUrl()}</span>
          </div>
          <div className="flex justify-center gap-4 text-[10px]">
            <button
              type="button"
              onClick={() => setShowServerConfig(!showServerConfig)}
              className="text-slate-400 hover:text-slate-300 underline"
            >
              {showServerConfig ? "Hide Config" : "Change Server URL"}
            </button>
            <button
              type="button"
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              className="text-amber-400 hover:text-amber-300 underline"
            >
              {showDiagnostics ? "Hide Diagnostics" : "Show Diagnostics"}
            </button>
          </div>
        </div>

        {showServerConfig && (
          <div className="bg-slate-800/80 p-3.5 rounded-xl border border-slate-700 space-y-2.5 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-300 font-medium">Backend API URL:</span>
              <button
                type="button"
                onClick={handleResetServer}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline"
              >
                Reset Default
              </button>
            </div>
            <input
              type="text"
              value={serverInput}
              onChange={(e) => setServerInput(e.target.value)}
              placeholder="https://vatti-business-production.up.railway.app"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-white font-mono"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowServerConfig(false)}
                className="w-full bg-slate-800 text-slate-400 py-1.5 rounded-lg text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveServer}
                className="w-full bg-amber-600 text-white py-1.5 rounded-lg font-semibold text-xs tap-active"
              >
                Save URL
              </button>
            </div>
          </div>
        )}

        {/* Developer Network Diagnostic Panel */}
        {showDiagnostics && (
          <div className="bg-slate-950/90 border border-slate-700/80 rounded-xl p-3.5 space-y-2 text-[11px] font-mono text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Activity className="w-3.5 h-3.5" />
                <span>ADMIN NETWORK DIAGNOSTIC</span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePing}
                  disabled={pinging}
                  className="px-2 py-0.5 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white rounded text-[10px] flex items-center gap-1"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${pinging ? "animate-spin" : ""}`} />
                  <span>Test Ping</span>
                </button>
                <button
                  type="button"
                  onClick={resetDiagnostic}
                  className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded text-[10px]"
                >
                  Reset
                </button>
              </div>
            </div>

            <div className="space-y-1 divide-y divide-slate-800/60">
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Server URL:</span>
                <span className="text-right text-[10px] text-amber-300 truncate max-w-[190px]">{diagnostic.serverUrl}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Native platform:</span>
                <span className={diagnostic.isNativePlatform ? "text-emerald-400 font-bold" : "text-amber-400"}>
                  {diagnostic.isNativePlatform ? "YES (Android)" : "NO (Web)"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">CapacitorHttp available:</span>
                <span className={diagnostic.isCapacitorHttpAvailable ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
                  {diagnostic.isCapacitorHttpAvailable ? "YES" : "NO"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Request started:</span>
                <span>{diagnostic.requestStarted ? `YES (${diagnostic.requestStartedTime})` : "NO"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Request completed:</span>
                <span className={diagnostic.requestCompleted ? "text-emerald-400" : "text-slate-400"}>
                  {diagnostic.requestCompleted ? `YES (${diagnostic.requestCompletedTime})` : "NO"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">HTTP status:</span>
                <span className={diagnostic.httpStatus === 200 ? "text-emerald-400 font-bold" : diagnostic.httpStatus ? "text-amber-400 font-bold" : "text-slate-400"}>
                  {diagnostic.httpStatus !== null ? diagnostic.httpStatus : "None"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Response type:</span>
                <span className="text-[10px] text-slate-300 truncate max-w-[190px]">{diagnostic.responseType || "None"}</span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Error type:</span>
                <span className={diagnostic.errorType ? "text-rose-400 font-bold text-[10px] truncate max-w-[190px]" : "text-slate-400"}>
                  {diagnostic.errorType || "None"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Timeout:</span>
                <span className={diagnostic.isTimeout ? "text-rose-400 font-bold" : "text-slate-400"}>
                  {diagnostic.isTimeout ? "YES (15s)" : "NO"}
                </span>
              </div>
              <div className="flex justify-between py-0.5">
                <span className="text-slate-400">Last Stage:</span>
                <span className="text-amber-400 font-semibold">[LOGIN] {diagnostic.lastStage}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="text-center text-[11px] text-slate-500 pb-2">
        Vatti Business Private Cloud • Admin Mobile v1.3 (Build 4)
      </div>
    </div>
  );
};
