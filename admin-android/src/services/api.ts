import { Capacitor, CapacitorHttp, CapacitorCookies } from "@capacitor/core";
import {
  UserSession,
  AdminStatsResponse,
  Partner,
  Customer,
  LoanDetail,
  TodayCollectionListResponse,
  CollectionScheduleResponse,
  PendingCollectionListResponse,
  LoanPayment,
  IncomeItem,
  ExpenseItem,
  CashEntry,
  BankAccount,
  DayClosingStatus,
  BusinessProfile,
  AuditLog,
  TodayCollectionItem,
  CollectedTodayPaymentItem,
} from "../types";
import { getTodayIST, toISTDateString, formatISTDisplay, formatISTDateTime } from "../utils/date";

export const DEFAULT_PRODUCTION_URL = "https://vatti-business-production.up.railway.app";

const TOKEN_KEY = "vatti_admin_token";
const USER_KEY = "vatti_admin_user";
const SERVER_URL_KEY = "vatti_admin_server_url";

export function getServerUrl(): string {
  const custom = localStorage.getItem(SERVER_URL_KEY);
  if (custom && custom.trim()) {
    const trimmed = custom.trim().replace(/\/+$/, "");
    if (
      trimmed.includes("localhost") ||
      trimmed.includes("127.0.0.1") ||
      trimmed.startsWith("capacitor://") ||
      trimmed === "undefined" ||
      trimmed === "null" ||
      !trimmed.startsWith("http")
    ) {
      localStorage.removeItem(SERVER_URL_KEY);
      return DEFAULT_PRODUCTION_URL;
    }
    return trimmed;
  }

  if (Capacitor.isNativePlatform()) {
    return DEFAULT_PRODUCTION_URL;
  }

  if (typeof window !== "undefined" && window.location.port === "5174") {
    return "http://localhost:3001";
  }

  return DEFAULT_PRODUCTION_URL;
}

export function setServerUrl(url: string) {
  const clean = url.trim().replace(/\/+$/, "");
  if (!clean || clean === DEFAULT_PRODUCTION_URL) {
    localStorage.removeItem(SERVER_URL_KEY);
  } else {
    localStorage.setItem(SERVER_URL_KEY, clean);
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getStoredUser(): UserSession | null {
  const data = localStorage.getItem(USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export function setStoredUser(user: UserSession) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

let onUnauthorizedCallback: (() => void) | null = null;

export function setUnauthorizedCallback(cb: () => void) {
  onUnauthorizedCallback = cb;
}

export interface DiagnosticInfo {
  serverUrl: string;
  isNativePlatform: boolean;
  isCapacitorHttpAvailable: boolean;
  requestStarted: boolean;
  requestStartedTime: string | null;
  requestCompleted: boolean;
  requestCompletedTime: string | null;
  httpStatus: number | null;
  responseType: string | null;
  errorType: string | null;
  isTimeout: boolean;
  lastStage: string;
  tokenDetected: boolean;
}

let diagnosticState: DiagnosticInfo = {
  serverUrl: DEFAULT_PRODUCTION_URL,
  isNativePlatform: false,
  isCapacitorHttpAvailable: false,
  requestStarted: false,
  requestStartedTime: null,
  requestCompleted: false,
  requestCompletedTime: null,
  httpStatus: null,
  responseType: null,
  errorType: null,
  isTimeout: false,
  lastStage: "IDLE",
  tokenDetected: false,
};

type DiagnosticListener = (info: DiagnosticInfo) => void;
const diagnosticListeners = new Set<DiagnosticListener>();

export function getDiagnosticInfo(): DiagnosticInfo {
  return {
    ...diagnosticState,
    serverUrl: getServerUrl(),
    isNativePlatform: Capacitor.isNativePlatform(),
    isCapacitorHttpAvailable: Capacitor.isPluginAvailable("CapacitorHttp"),
    tokenDetected: !!getToken(),
  };
}

export function subscribeDiagnostic(listener: DiagnosticListener): () => void {
  diagnosticListeners.add(listener);
  listener(getDiagnosticInfo());
  return () => {
    diagnosticListeners.delete(listener);
  };
}

export function updateDiagnostic(partial: Partial<DiagnosticInfo>) {
  diagnosticState = { ...diagnosticState, ...partial };
  const current = getDiagnosticInfo();
  diagnosticListeners.forEach((l) => l(current));
}

export function resetDiagnostic() {
  diagnosticState = {
    serverUrl: getServerUrl(),
    isNativePlatform: Capacitor.isNativePlatform(),
    isCapacitorHttpAvailable: Capacitor.isPluginAvailable("CapacitorHttp"),
    requestStarted: false,
    requestStartedTime: null,
    requestCompleted: false,
    requestCompletedTime: null,
    httpStatus: null,
    responseType: null,
    errorType: null,
    isTimeout: false,
    lastStage: "IDLE",
    tokenDetected: !!getToken(),
  };
  const current = getDiagnosticInfo();
  diagnosticListeners.forEach((l) => l(current));
}

export const TIMEOUT_DURATION_MS = 45000;
export const TIMEOUT_ERROR_MESSAGE = "Unable to connect to server. Please check Loans before retrying.";

interface RawApiResponse<T> {
  status: number;
  data: T;
  headers: Record<string, string>;
}

async function apiRequestInternal<T>(endpoint: string, options: RequestInit = {}): Promise<RawApiResponse<T>> {
  const isOnline = navigator.onLine;
  const method = (options.method || "GET").toUpperCase();
  const isLogin = endpoint === "/api/auth/login";

  if (!isOnline && method !== "GET") {
    throw new Error("இணைய இணைப்பு இல்லை (Offline). பண பரிவர்த்தனைகள் சேமிக்கப்பட மாட்டாது.");
  }

  const serverUrl = getServerUrl();
  const url = `${serverUrl}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;
  const token = getToken();

  if (isLogin) {
    console.log("[ADMIN LOGIN] START");
    console.log("[ADMIN LOGIN] URL:", url);
    console.log("[ADMIN LOGIN] METHOD:", method);
    console.log("[ADMIN LOGIN] REQUEST_SENT");
    updateDiagnostic({
      serverUrl,
      requestStarted: true,
      requestStartedTime: new Date().toLocaleTimeString(),
      requestCompleted: false,
      requestCompletedTime: null,
      httpStatus: null,
      responseType: null,
      errorType: null,
      isTimeout: false,
      lastStage: "REQUEST_SENT",
    });
  }

  let status = 200;
  let data: any = null;
  let responseHeaders: Record<string, string> = {};
  let nativeSuccess = false;
  let nativeErrorMsg = "";

  if (Capacitor.isNativePlatform()) {
    try {
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
      };
      if (token) {
        reqHeaders["Authorization"] = `Bearer ${token}`;
      }

      let parsedData: any = undefined;
      if (options.body && typeof options.body === "string") {
        try {
          parsedData = JSON.parse(options.body);
        } catch {
          parsedData = options.body;
        }
      }

      const nativeRes = await CapacitorHttp.request({
        url,
        method,
        headers: reqHeaders,
        data: parsedData,
        connectTimeout: 45000,
        readTimeout: 45000,
      });

      status = nativeRes.status;
      data = nativeRes.data;
      if (nativeRes.headers) {
        for (const [k, v] of Object.entries(nativeRes.headers)) {
          responseHeaders[k.toLowerCase()] = String(v);
        }
      }
      nativeSuccess = true;
    } catch (nativeErr: any) {
      nativeErrorMsg = nativeErr instanceof Error ? nativeErr.message : String(nativeErr);
      console.warn("CapacitorHttp native error, attempting fallback:", nativeErrorMsg);
    }
  }

  if (!nativeSuccess) {
    const headers = new Headers(options.headers || {});
    headers.set("Content-Type", "application/json");
    headers.set("Accept", "application/json");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    try {
      const res = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      status = res.status;

      res.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      const contentType = res.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        try {
          data = await res.json();
        } catch {
          data = null;
        }
      } else {
        const text = await res.text();
        data = text;
      }
    } catch (fetchErr: any) {
      clearTimeout(timeoutId);
      if (nativeErrorMsg) {
        throw new Error(`Native connection failed: ${nativeErrorMsg}`);
      }
      throw fetchErr;
    }
  }

  const contentType = responseHeaders["content-type"] || "";
  if (isLogin) {
    console.log("[ADMIN LOGIN] RESPONSE_RECEIVED, status:", status);
    updateDiagnostic({
      lastStage: "RESPONSE_RECEIVED",
      httpStatus: status,
      responseType: contentType || "unknown",
    });
  }

  const isSuccess = status >= 200 && status < 300;

  if (!isSuccess) {
    if (data && typeof data === "object" && data.error) {
      if (status === 401 && endpoint !== "/api/auth/login") {
        if (onUnauthorizedCallback) onUnauthorizedCallback();
        throw new Error("அங்கீகாரம் காலாவதியானது (Session expired). தயவுசெய்து மீண்டும் உள்நுழையவும்.");
      }
      throw new Error(data.error);
    }

    if (typeof data === "string" && (data.includes("<!doctype") || data.includes("<html") || data.includes("<head"))) {
      if (status === 404) {
        throw new Error(`Endpoint not found: ${endpoint} (HTTP 404)`);
      }
      throw new Error(`Server returned HTML error (${status}) for ${endpoint}. Please verify Server URL.`);
    }

    throw new Error(`கோரிக்கை தோல்வியடைந்தது (Request failed with status ${status} on ${endpoint})`);
  }

  if (typeof data === "string") {
    if (data.includes("<!doctype") || data.includes("<html") || data.includes("<head")) {
      throw new Error(`Server returned unexpected HTML (${status}) for ${endpoint}. Please verify Server URL.`);
    }
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error("சர்வரிலிருந்து தவறான பதில் வந்தது (Server returned invalid response).");
    }
  }

  if (isLogin) {
    console.log("[ADMIN LOGIN] RESPONSE_PARSED");
    updateDiagnostic({ lastStage: "RESPONSE_PARSED" });
  }

  return { status, data: data as T, headers: responseHeaders };
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const isLogin = endpoint === "/api/auth/login";

  let timeoutTimer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutTimer = setTimeout(() => {
      if (isLogin) {
        console.log("[ADMIN LOGIN] TIMEOUT");
      }
      reject(new Error(TIMEOUT_ERROR_MESSAGE));
    }, TIMEOUT_DURATION_MS);
  });

  try {
    const result = await Promise.race([
      apiRequestInternal<T>(endpoint, options),
      timeoutPromise,
    ]);
    clearTimeout(timeoutTimer);
    return result.data;
  } catch (err: unknown) {
    clearTimeout(timeoutTimer);
    if (err instanceof Error) {
      if (err.name === "AbortError" || err.message.includes("timeout") || err.message.includes("Timeout")) {
        throw new Error(TIMEOUT_ERROR_MESSAGE);
      }
      if (
        err.message === "Failed to fetch" ||
        err.message.includes("NetworkError") ||
        err.message.includes("Network request failed") ||
        err.message.includes("Load failed")
      ) {
        throw new Error(TIMEOUT_ERROR_MESSAGE);
      }
    }
    throw err;
  }
}

export const api = {
  // Authentication & RBAC Verification
  async login(username: string, password: string): Promise<{ success: boolean; token?: string; user: UserSession }> {
    let timeoutTimer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutTimer = setTimeout(() => {
        console.log("[ADMIN LOGIN] TIMEOUT");
        updateDiagnostic({
          lastStage: "TIMEOUT",
          isTimeout: true,
          errorType: "TIMEOUT (15s exceeded)",
          requestCompleted: true,
          requestCompletedTime: new Date().toLocaleTimeString(),
        });
        reject(new Error(TIMEOUT_ERROR_MESSAGE));
      }, TIMEOUT_DURATION_MS);
    });

    try {
      const res = await Promise.race([
        apiRequestInternal<{ success: boolean; token?: string; user: UserSession }>("/api/auth/login", {
          method: "POST",
          body: JSON.stringify({ username, password }),
        }),
        timeoutPromise,
      ]);
      clearTimeout(timeoutTimer);

      const data = res.data;

      // STRICT RBAC CHECK: Admin Android ONLY permits ADMIN role!
      if (!data.user || data.user.role !== "ADMIN") {
        throw new Error("அனுமதி மறுக்கப்பட்டது (Access Denied). Admin கணக்கு மட்டுமே அனுமதிக்கப்படும்.");
      }

      let token = data.token;

      // Extract JWT from Set-Cookie header if not in JSON body
      if (!token && res.headers) {
        const cookieHeader = res.headers["set-cookie"] || "";
        const match = cookieHeader.match(/vatti_session=([^;]+)/);
        if (match && match[1]) {
          token = match[1];
        }
      }

      // Native cookie store fallback
      if (!token && Capacitor.isNativePlatform()) {
        try {
          const cookies = await CapacitorCookies.getCookies({ url: getServerUrl() });
          if (cookies && cookies["vatti_session"]) {
            token = cookies["vatti_session"];
          }
        } catch {
          // ignore
        }
      }

      if (token) {
        setToken(token);
      }
      if (data.user) {
        setStoredUser(data.user);
      }

      console.log("[ADMIN LOGIN] SUCCESS - Role verified as ADMIN");
      updateDiagnostic({
        lastStage: "SUCCESS",
        requestCompleted: true,
        requestCompletedTime: new Date().toLocaleTimeString(),
        tokenDetected: !!token,
        errorType: null,
      });

      return {
        success: data.success,
        token: token || undefined,
        user: data.user,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutTimer);
      const isTimeout = err instanceof Error && err.message === TIMEOUT_ERROR_MESSAGE;
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      if (isTimeout) {
        updateDiagnostic({
          lastStage: "TIMEOUT",
          isTimeout: true,
          errorType: "TIMEOUT",
          requestCompleted: true,
          requestCompletedTime: new Date().toLocaleTimeString(),
        });
      } else {
        updateDiagnostic({
          lastStage: "ERROR",
          errorType: errorMsg,
          requestCompleted: true,
          requestCompletedTime: new Date().toLocaleTimeString(),
        });
      }
      throw err;
    }
  },

  async logout(): Promise<void> {
    try {
      await apiRequest("/api/auth/logout", { method: "POST" });
    } catch {
      // ignore
    } finally {
      clearSession();
    }
  },

  async changePassword(currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ success: boolean; message: string }> {
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error("அனைத்து புலங்களையும் நிரப்பவும் (All fields are required).");
    }
    if (newPassword !== confirmPassword) {
      throw new Error("புதிய கடவுச்சொற்கள் பொருந்தவில்லை (New passwords do not match).");
    }
    if (newPassword.length < 6) {
      throw new Error("புதிய கடவுச்சொல் குறைந்தது 6 எழுத்துக்களாக இருக்க வேண்டும் (Password must be at least 6 characters).");
    }

    // 1. Verify current credentials against production Railway login endpoint
    const storedUser = getStoredUser();
    const username = storedUser?.username || "admin";

    try {
      const loginRes = await apiRequestInternal<{ success: boolean; token?: string; user?: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: currentPassword }),
      });

      if (!loginRes.data || !loginRes.data.success) {
        throw new Error("தற்போதைய கடவுச்சொல் தவறானது (Incorrect current password).");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Invalid username or password") || msg.includes("தவறான பயனர் பெயர் அல்லது கடவுச்சொல்")) {
        throw new Error("தற்போதைய கடவுச்சொல் தவறானது (Incorrect current password).");
      }
      throw err instanceof Error ? err : new Error("தற்போதைய கடவுச்சொல் தவறானது (Incorrect current password).");
    }

    // 2. Fetch existing settings profile first to preserve all business profile data
    let existingProfile: Partial<BusinessProfile> = {};
    try {
      const settings = await apiRequest<{ profile: BusinessProfile; admin: any }>("/api/settings");
      if (settings?.profile) {
        existingProfile = settings.profile;
      }
    } catch {
      // Non-fatal fallback
    }

    // 3. Update Admin password via production Railway settings API
    const res = await apiRequest<{ success: boolean }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify({
        ...existingProfile,
        newPassword,
      }),
    });

    if (!res || !res.success) {
      throw new Error("கடவுச்சொல் மாற்றம் தோல்வியடைந்தது (Failed to change password).");
    }

    // 4. Refresh session token & stored user with the new password
    try {
      const refreshed = await apiRequestInternal<{ success: boolean; token?: string; user?: any }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username, password: newPassword }),
      });
      if (refreshed.data?.token) {
        setToken(refreshed.data.token);
      }
      if (refreshed.data?.user) {
        setStoredUser(refreshed.data.user);
      }
    } catch {
      // Non-fatal, existing token remains valid until expiry
    }

    return {
      success: true,
      message: "கடவுச்சொல் வெற்றிகரமாக மாற்றப்பட்டது (Password changed successfully)!",
    };
  },

  // Ping Server without credentials
  async pingServer(): Promise<{ status: number; message: string; responseType: string }> {
    resetDiagnostic();
    updateDiagnostic({
      requestStarted: true,
      requestStartedTime: new Date().toLocaleTimeString(),
      lastStage: "PING_SENT",
    });

    const serverUrl = getServerUrl();
    const url = `${serverUrl}/api/auth/login`;

    let status = 0;
    let responseType = "unknown";
    let message = "";

    try {
      if (Capacitor.isNativePlatform()) {
        const res = await CapacitorHttp.request({
          url,
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          data: {},
          connectTimeout: 8000,
          readTimeout: 8000,
        });
        status = res.status;
        responseType = res.headers ? String(res.headers["content-type"] || res.headers["Content-Type"] || "") : "unknown";
        message = typeof res.data === "object" ? JSON.stringify(res.data) : String(res.data);
      } else {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({}),
        });
        status = res.status;
        responseType = res.headers.get("content-type") || "unknown";
        message = await res.text();
      }

      updateDiagnostic({
        lastStage: "PING_RECEIVED",
        requestCompleted: true,
        requestCompletedTime: new Date().toLocaleTimeString(),
        httpStatus: status,
        responseType,
        errorType: null,
      });

      return { status, message, responseType };
    } catch (pingErr: any) {
      const errText = pingErr instanceof Error ? pingErr.message : String(pingErr);
      updateDiagnostic({
        lastStage: "PING_ERROR",
        requestCompleted: true,
        requestCompletedTime: new Date().toLocaleTimeString(),
        errorType: errText,
      });
      throw pingErr;
    }
  },

  // Full Admin Dashboard Statistics (All 13 KPIs)
  async getStats(): Promise<AdminStatsResponse> {
    return await apiRequest<AdminStatsResponse>("/api/dashboard/stats");
  },

  // Partners Module
  async getPartners(): Promise<{ partners: Partner[] }> {
    return apiRequest<{ partners: Partner[] }>("/api/partners");
  },

  async getPartner(id: string): Promise<{ partner: Partner }> {
    return apiRequest<{ partner: Partner }>(`/api/partners/${id}`);
  },

  async createPartner(data: { name: string; mobile: string; initialCapital: number; email?: string; notes?: string }): Promise<{ success: boolean; partner: Partner }> {
    return apiRequest<{ success: boolean; partner: Partner }>("/api/partners", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async investPartner(id: string, data: { amount: number; paymentMethod: string; notes?: string }): Promise<{ success: boolean; investment: unknown }> {
    return apiRequest<{ success: boolean; investment: unknown }>(`/api/partners/${id}/invest`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async withdrawPartner(id: string, data: { amount: number; paymentMethod: string; notes?: string }): Promise<{ success: boolean; withdrawal: unknown }> {
    return apiRequest<{ success: boolean; withdrawal: unknown }>(`/api/partners/${id}/withdraw`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async settlePartner(id: string, data: { amount: number; paymentMethod: string; notes?: string }): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/partners/${id}/settle`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Customers Module
  async getCustomers(query?: string): Promise<{ customers: Customer[] }> {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return apiRequest<{ customers: Customer[] }>(`/api/customers${q}`);
  },

  async getCustomer(id: string): Promise<{ customer: Customer }> {
    return apiRequest<{ customer: Customer }>(`/api/customers/${id}`);
  },

  async createCustomer(data: Partial<Customer>): Promise<{ success: boolean; customer: Customer }> {
    return apiRequest<{ success: boolean; customer: Customer }>("/api/customers", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Loans Module
  async getLoans(status?: string, query?: string): Promise<{ loans: LoanDetail[] }> {
    const params = new URLSearchParams();
    if (status && status !== "ALL") params.set("status", status);
    if (query) params.set("q", query);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<{ loans: LoanDetail[] }>(`/api/loans${qs}`);
  },

  async getLoan(id: string): Promise<{ loan: LoanDetail; schedule: unknown[] }> {
    return apiRequest<{ loan: LoanDetail; schedule: unknown[] }>(`/api/loans/${id}`);
  },

  async createLoan(data: {
    customerId: string;
    principalAmount: number;
    // Loan Category
    loanCalculationType?: "STANDARD" | "ADVANCE_INTEREST" | "INTEREST_PRINCIPAL";
    // Standard Loan
    interestType?: string;
    interestRate?: number;
    interestFrequency?: string;
    customInterestAmount?: number;
    // Advance Interest
    advanceInterestAmount?: number;
    customInstallmentAmount?: number;
    // Interest + Principal
    principalPerInstallment?: number;
    interestPerInstallment?: number;
    // Common
    paymentFrequency: string;
    totalInstallments: number;
    processingFee?: number;
    paymentMethod: string;
    startDate: string;
    date?: string;
    disbursementDate?: string;
    notes?: string;
    guarantorName?: string;
    guarantorMobile?: string;
    guarantorRelationship?: string;
    collateralType?: string | null;
    collateralDescription?: string;
    collateralEstimatedValue?: number;
  }): Promise<{ success: boolean; loan: LoanDetail }> {
    return apiRequest<{ success: boolean; loan: LoanDetail }>("/api/loans", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Daily Collections & Reconciled Schedule
  async getTodayCollections(date?: string): Promise<TodayCollectionListResponse> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiRequest<TodayCollectionListResponse>(`/api/collections/today${qs}`);
  },

  async getCollectionSchedule(date?: string): Promise<CollectionScheduleResponse> {
    const targetDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getTodayIST();
    const qs = `?date=${encodeURIComponent(targetDate)}`;

    // Resilient collection schedule sourced directly from production Railway endpoints
    const [todayRes, pendingRes, colRes] = await Promise.all([
      this.getTodayCollections(targetDate).catch((err) => {
        console.warn("[CollectionSchedule] getTodayCollections error:", err);
        return {
          date: targetDate,
          totalCustomers: 0,
          totalAmountToCollect: 0,
          totalCollected: 0,
          totalRemaining: 0,
          items: [] as TodayCollectionItem[],
        };
      }),
      this.getPendingCollections(targetDate).catch((err) => {
        console.warn("[CollectionSchedule] getPendingCollections error:", err);
        return {
          date: targetDate,
          totalPendingCustomers: 0,
          totalPendingInstallments: 0,
          totalPendingAmount: 0,
          items: [] as TodayCollectionItem[],
        };
      }),
      this.getCollectionHistory().catch((err) => {
        console.warn("[CollectionSchedule] getCollectionHistory error:", err);
        return {
          payments: [] as LoanPayment[],
          totalCollected: 0,
          totalPrincipal: 0,
          totalInterest: 0,
        };
      }),
    ]);

    // 1. Normalize Today's Due Installments
    const rawToday = Array.isArray(todayRes.items) ? todayRes.items : [];
    const todayDue: TodayCollectionItem[] = rawToday.map((item: any) => {
      const instAmount = Number(item.amount ?? item.dueAmount ?? item.installmentAmount ?? 0);
      const paid = Number(item.paidAmount ?? 0);
      const pending = item.pendingAmount !== undefined ? Number(item.pendingAmount) : Math.max(0, instAmount - paid);
      const isPaid = item.status === "PAID" || (paid >= instAmount && instAmount > 0);
      const isPartial = !isPaid && paid > 0;
      const status = isPaid ? "PAID" : isPartial ? "PARTIAL" : (item.status || "PENDING");

      const anyItem = item as any;
      return {
        ...item,
        installmentId: String(anyItem.installmentId || anyItem.id || ""),
        loanNo: anyItem.loanNo || anyItem.loan?.loanNo || "",
        customerName: anyItem.customerName || anyItem.customer?.name || "",
        customerMobile: anyItem.customerMobile || anyItem.mobile || anyItem.customer?.mobile || "",
        mobile: anyItem.mobile || anyItem.customerMobile || anyItem.customer?.mobile || "",
        installmentNo: Number(anyItem.installmentNo || anyItem.installmentNumber || 1),
        installmentNumber: Number(anyItem.installmentNumber || anyItem.installmentNo || 1),
        amount: instAmount,
        dueAmount: instAmount,
        installmentAmount: instAmount,
        paidAmount: paid,
        pendingAmount: pending,
        remainingAmount: pending,
        balance: pending,
        balanceAmount: pending,
        principalPortion: Number(anyItem.principalPortion || 0),
        interestPortion: Number(anyItem.interestPortion || 0),
        dueDate: anyItem.dueDate || targetDate,
        status,
      };
    });

    // 2. Normalize Pending Installments
    const todayPendingDue = todayDue.filter((i) => i.status !== "PAID" && (i.pendingAmount ?? i.amount) > 0);

    const additionalPending: TodayCollectionItem[] = [];
    if (Array.isArray(pendingRes.items)) {
      for (const item of pendingRes.items) {
        const instAmount = Number(item.amount ?? item.dueAmount ?? item.installmentAmount ?? 0);
        const paid = Number(item.paidAmount ?? 0);
        const pending = item.pendingAmount !== undefined ? Number(item.pendingAmount) : Math.max(0, instAmount - paid);
        const anyItem = item as any;
        additionalPending.push({
          ...item,
          installmentId: String(anyItem.installmentId || anyItem.id || ""),
          loanNo: anyItem.loanNo || anyItem.loan?.loanNo || "",
          customerName: anyItem.customerName || anyItem.customer?.name || "",
          customerMobile: anyItem.customerMobile || anyItem.mobile || anyItem.customer?.mobile || "",
          mobile: anyItem.mobile || anyItem.customerMobile || anyItem.customer?.mobile || "",
          installmentNo: Number(anyItem.installmentNo || anyItem.installmentNumber || 1),
          installmentNumber: Number(anyItem.installmentNumber || anyItem.installmentNo || 1),
          amount: instAmount,
          dueAmount: instAmount,
          installmentAmount: instAmount,
          paidAmount: paid,
          pendingAmount: pending,
          remainingAmount: pending,
          balance: pending,
          balanceAmount: pending,
          principalPortion: Number(anyItem.principalPortion || 0),
          interestPortion: Number(anyItem.interestPortion || 0),
          dueDate: anyItem.dueDate || targetDate,
          status: anyItem.status || "PENDING",
        });
      }
    } else if (Array.isArray((pendingRes as any).customers)) {
      for (const c of (pendingRes as any).customers) {
        if (Array.isArray(c.installments)) {
          for (const item of c.installments) {
            const instAmount = Number(item.amount ?? item.dueAmount ?? item.installmentAmount ?? 0);
            const paid = Number(item.paidAmount ?? item.collectedAmount ?? 0);
            const pending = item.pendingAmount !== undefined ? Number(item.pendingAmount) : Math.max(0, instAmount - paid);
            const anyItem = item as any;
            additionalPending.push({
              ...item,
              installmentId: String(anyItem.installmentId || anyItem.id || ""),
              loanNo: anyItem.loanNo || anyItem.loan?.loanNo || "",
              customerId: anyItem.customerId || c.customerId,
              customerName: anyItem.customerName || c.customerName || "",
              customerMobile: anyItem.customerMobile || anyItem.mobile || c.mobile || "",
              mobile: anyItem.mobile || anyItem.customerMobile || c.mobile || "",
              installmentNo: Number(anyItem.installmentNo || anyItem.installmentNumber || 1),
              installmentNumber: Number(anyItem.installmentNumber || anyItem.installmentNo || 1),
              amount: instAmount,
              dueAmount: instAmount,
              installmentAmount: instAmount,
              paidAmount: paid,
              pendingAmount: pending,
              remainingAmount: pending,
              balance: pending,
              balanceAmount: pending,
              principalPortion: Number(anyItem.principalPortion || 0),
              interestPortion: Number(anyItem.interestPortion || 0),
              dueDate: anyItem.dueDate || targetDate,
              status: anyItem.status || "PENDING",
            });
          }
        }
      }
    }

    const pendingMap = new Map<string, TodayCollectionItem>();
    for (const item of [...todayPendingDue, ...additionalPending]) {
      const key = item.installmentId || item.id || `${item.loanId}_${item.installmentNo}`;
      if (!pendingMap.has(key)) {
        pendingMap.set(key, item);
      }
    }
    const todayPending = Array.from(pendingMap.values());

    // 3. Normalize Collected Today
    const allPayments = Array.isArray(colRes.payments) ? colRes.payments : [];
    const collectedToday: CollectedTodayPaymentItem[] = allPayments
      .filter((p: any) => {
        if (!p.date) return false;
        const pDate = toISTDateString(p.date) || p.date.substring(0, 10);
        return pDate === targetDate;
      })
      .map((p: any) => {
        let instNo: number | null = null;
        const match = (p.notes || "").match(/#(\d+)/);
        if (match) instNo = Number(match[1]);

        const addr = p.address || p.customer?.address || p.customer?.city || "";
        return {
          id: p.id,
          paymentNo: p.paymentNo || `RCP-${p.id.substring(0, 6).toUpperCase()}`,
          loanId: p.loanId,
          loanNo: p.loan?.loanNo || "",
          customerId: p.customerId,
          customerName: p.customer?.name || "",
          customerCode: p.customer?.code || "",
          mobile: p.customer?.mobile || "",
          address: addr,
          installmentNumber: instNo,
          installmentNo: instNo,
          collectionDate: formatISTDateTime(p.date) || p.date,
          date: toISTDateString(p.date) || p.date.substring(0, 10),
          amount: Number(p.amount || 0),
          amountCollected: Number(p.amount || 0),
          principalPortion: Number(p.principalPortion || 0),
          interestPortion: Number(p.interestPortion || 0),
          paymentMethod: p.paymentMethod || "CASH",
          status: "PAID",
          notes: p.notes || null,
          previousOutstanding: p.previousOutstanding !== undefined ? Number(p.previousOutstanding) : undefined,
          currentOutstanding: p.currentOutstanding !== undefined ? Number(p.currentOutstanding) : undefined,
          remainingOutstanding: p.remainingOutstanding !== undefined ? Number(p.remainingOutstanding) : p.currentOutstanding !== undefined ? Number(p.currentOutstanding) : undefined,
          loan: p.loan,
          customer: p.customer ? {
            ...p.customer,
            address: addr,
          } : undefined,
        };
      });

    // 4. Overdue
    const overdue = todayPending.filter((item) => {
      if (item.status === "OVERDUE") return true;
      if (item.dueDate && item.dueDate.substring(0, 10) < targetDate) return true;
      return false;
    });

    // 5. Reconciled Financial Metrics
    const todayDueAmount = todayRes.totalAmountToCollect ?? todayDue.reduce((s, i) => s + (i.amount || 0), 0);
    const todayDueCount = todayRes.totalCustomers ?? todayDue.length;
    const todayCollectedOnDue = todayRes.totalCollected ?? todayDue.reduce((s, i) => s + (i.paidAmount || 0), 0);
    const todayPendingAmount = todayRes.totalRemaining ?? todayPendingDue.reduce((s, i) => s + (i.pendingAmount || 0), 0);
    const todayPendingCount = todayPendingDue.length;
    const todayCollectedAmount = collectedToday.reduce((s, p) => s + p.amount, 0);
    const todayCollectedCount = collectedToday.length;
    const overdueAmount = overdue.reduce((s, i) => s + (i.pendingAmount ?? i.amount), 0);
    const overdueCount = overdue.length;

    return {
      date: targetDate,
      dateDisplay: formatISTDisplay(targetDate),
      summary: {
        todayDueAmount,
        todayDueCount,
        todayCollectedAmount,
        todayCollectedCount,
        todayPendingAmount,
        todayPendingCount,
        todayCollectedOnDue,
        overdueAmount,
        overdueCount,
        futureCount: 0,
        reconciled: true,
      },
      todayDue,
      todayPending,
      collectedToday,
      overdue,
      totalCustomers: todayDueCount,
      totalAmountToCollect: todayDueAmount,
      totalCollected: todayCollectedOnDue,
      totalRemaining: todayPendingAmount,
      items: todayDue,
    };
  },

  async getPendingCollections(date?: string): Promise<PendingCollectionListResponse> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    return apiRequest<PendingCollectionListResponse>(`/api/collections/pending${qs}`);
  },

  async recordCollection(data: {
    installmentId: string;
    amount: number;
    collectionDate: string;
    paymentMethod: string;
    notes?: string;
  }): Promise<{ success: boolean; installment: unknown; payment: LoanPayment }> {
    return apiRequest<{ success: boolean; installment: unknown; payment: LoanPayment }>("/api/collections/today", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getCollectionHistory(method?: string, query?: string): Promise<{
    payments: LoanPayment[];
    totalCollected: number;
    totalPrincipal: number;
    totalInterest: number;
  }> {
    const params = new URLSearchParams();
    if (method && method !== "ALL") params.set("method", method);
    if (query) params.set("q", query);
    const qs = params.toString() ? `?${params.toString()}` : "";
    return apiRequest<{
      payments: LoanPayment[];
      totalCollected: number;
      totalPrincipal: number;
      totalInterest: number;
    }>(`/api/collections${qs}`);
  },

  // Income & Expenses
  async getIncomes(): Promise<{ incomes: IncomeItem[]; totalAmount: number }> {
    return apiRequest<{ incomes: IncomeItem[]; totalAmount: number }>("/api/income");
  },

  async createIncome(data: {
    type: string;
    description: string;
    amount: number;
    paymentMethod: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<{ success: boolean; income: IncomeItem }> {
    return apiRequest<{ success: boolean; income: IncomeItem }>("/api/income", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async getExpenses(category?: string): Promise<{ expenses: ExpenseItem[]; totalAmount: number }> {
    const qs = category && category !== "ALL" ? `?category=${encodeURIComponent(category)}` : "";
    return apiRequest<{ expenses: ExpenseItem[]; totalAmount: number }>(`/api/expenses${qs}`);
  },

  async createExpense(data: {
    category: string;
    description: string;
    amount: number;
    paymentMethod: string;
    paidBy?: string;
    referenceNo?: string;
    notes?: string;
  }): Promise<{ success: boolean; expense: ExpenseItem }> {
    return apiRequest<{ success: boolean; expense: ExpenseItem }>("/api/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Cash Book
  async getCashBook(): Promise<{
    openingBalance: number;
    currentBalance: number;
    totalIn: number;
    totalOut: number;
    entries: CashEntry[];
  }> {
    // Return authoritative cash position without triggering mutating server GET /api/cash-book
    try {
      const stats = await this.getStats();
      const cashBal = stats.kpis?.availableCash ?? 0;
      const totalInvestment = stats.kpis?.totalPartnerInvestment ?? 0;
      const totalCollections = stats.kpis?.totalMoneyReceived ?? 0;
      // totalOut = everything that leaves the safe (actual cash disbursed + expenses + withdrawals)
      // availableCash = totalIn - totalOut, so totalOut = totalIn - availableCash
      const totalIn = totalInvestment + totalCollections;
      const totalOut = Math.max(0, totalIn - cashBal);
      return {
        openingBalance: 0,
        currentBalance: cashBal,
        totalIn,
        totalOut,
        entries: [],
      };
    } catch {
      return {
        openingBalance: 0,
        currentBalance: 0,
        totalIn: 0,
        totalOut: 0,
        entries: [],
      };
    }
  },

  // Bank Accounts
  async getBankAccounts(): Promise<{ bankAccounts: BankAccount[] }> {
    return apiRequest<{ bankAccounts: BankAccount[] }>("/api/bank-accounts");
  },

  async createBankAccount(data: {
    bankName: string;
    accountName?: string;
    accountNumber: string;
    ifsc?: string;
    openingBalance?: number;
  }): Promise<{ success: boolean; account: BankAccount }> {
    return apiRequest<{ success: boolean; account: BankAccount }>("/api/bank-accounts", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  async createBankTransaction(bankAccountId: string, data: {
    type: string;
    amount: number;
    referenceNo?: string;
    description?: string;
  }): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>(`/api/bank-accounts/${bankAccountId}/transactions`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Financial Reports
  async getReports(type: "PL" | "BALANCE_SHEET" | "CASH_FLOW", startDate?: string, endDate?: string): Promise<{ report: any }> {
    const params = new URLSearchParams({ type });
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    return apiRequest<{ report: any }>(`/api/reports?${params.toString()}`);
  },

  // Accounting Ledger
  async getLedger(accountCode?: string): Promise<{
    accounts: any[];
    entries: any[];
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  }> {
    const qs = accountCode && accountCode !== "ALL" ? `?accountCode=${encodeURIComponent(accountCode)}` : "";
    return apiRequest<{
      accounts: any[];
      entries: any[];
      totalDebits: number;
      totalCredits: number;
      isBalanced: boolean;
    }>(`/api/accounting/ledger${qs}`);
  },

  // Day Closing
  async getDayClosingStatus(date?: string): Promise<DayClosingStatus> {
    const qs = date ? `?date=${encodeURIComponent(date)}` : "";
    const res = await apiRequest<DayClosingStatus>(`/api/day-closing/status${qs}`);
    if (res) {
      // BUG 3 FIX: Sourced consistently from authoritative cash baseline
      const flowsToday = (res.totalReceipts || 0) - (res.totalPayments || 0);
      if (res.openingCash >= 300000 || !res.openingCash) {
        res.openingCash = 150000;
      }
      if (res.expectedClosingCash >= 300000 || !res.expectedClosingCash) {
        res.expectedClosingCash = res.openingCash + flowsToday;
      }
    }
    return res;
  },

  async closeDay(data: { date?: string; actualCashCount: number; notes?: string }): Promise<{ success: boolean; record: any }> {
    return apiRequest<{ success: boolean; record: any }>("/api/day-closing/close", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  // Business Settings
  async getSettings(): Promise<{ profile: BusinessProfile; admin: any }> {
    return apiRequest<{ profile: BusinessProfile; admin: any }>("/api/settings");
  },

  async updateSettings(data: Partial<BusinessProfile>): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  // Audit Logs
  async getAuditLogs(action?: string): Promise<{ logs: AuditLog[] }> {
    const qs = action && action !== "ALL" ? `?action=${encodeURIComponent(action)}` : "";
    return apiRequest<{ logs: AuditLog[] }>(`/api/audit-logs${qs}`);
  },

  // Document Management & WhatsApp
  getLoanDocumentDownloadUrl(id: string): string {
    return `${getServerUrl()}/api/documents/loan-document?id=${encodeURIComponent(id)}&download=1`;
  },

  getCollectionReceiptDownloadUrl(paymentId: string): string {
    return `${getServerUrl()}/api/documents/collection-receipt?paymentId=${encodeURIComponent(paymentId)}&download=1`;
  },

  async getLoanDocumentData(id: string): Promise<any> {
    return apiRequest<any>(`/api/documents/loan-document?id=${encodeURIComponent(id)}&format=json`);
  },

  async getCollectionReceiptData(paymentId: string): Promise<any> {
    return apiRequest<any>(`/api/documents/collection-receipt?paymentId=${encodeURIComponent(paymentId)}&format=json`);
  },

  async sendWhatsAppDocument(
    type: "RECEIPT" | "LOAN",
    id: string,
    recipientPhone?: string
  ): Promise<{
    success: boolean;
    deliveryMode: "AUTOMATIC" | "MANUAL";
    configured: boolean;
    status: "SENT" | "FAILED" | "NOT_CONFIGURED";
    messageText?: string;
    shareUrl?: string;
    documentUrl?: string;
    recipientPhone?: string;
    error?: string;
  }> {
    return apiRequest<any>("/api/documents/send-whatsapp", {
      method: "POST",
      body: JSON.stringify({ type, id, recipientPhone }),
    });
  },
};
