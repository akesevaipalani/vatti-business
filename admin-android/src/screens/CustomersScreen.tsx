import React, { useState, useEffect, useCallback } from "react";
import {
  UserSquare2,
  Plus,
  Search,
  RefreshCw,
  Phone,
  MapPin,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  X,
  CreditCard,
  MessageSquare,
  FileText,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Customer } from "../types";

export const CustomersScreen: React.FC = () => {
  const { language } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // New Customer Form
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [occupation, setOccupation] = useState("");
  const [referencePerson, setReferencePerson] = useState("");
  const [notes, setNotes] = useState("");

  const fetchCustomers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const data = await api.getCustomers(searchQuery || undefined);
      setCustomers(data.customers || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "வாடிக்கையாளர் பட்டியலை ஏற்றுவதில் பிழை");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers();
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchCustomers]);

  const handleOpenCustomerDetails = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingDetails(true);
    try {
      const full = await api.getCustomer(customer.id);
      setSelectedCustomer(full.customer);
    } catch {
      // keep partial customer
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mobile.trim()) {
      setFormError("பெயர் மற்றும் தொலைபேசி எண் கட்டாயமாகும்.");
      return;
    }

    setFormLoading(true);
    setFormError(null);
    try {
      await api.createCustomer({
        name: name.trim(),
        mobile: mobile.trim(),
        whatsapp: whatsapp.trim() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        occupation: occupation.trim() || undefined,
        referencePerson: referencePerson.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      setFormSuccess("வாடிக்கையாளர் வெற்றிகரமாக சேர்க்கப்பட்டார்!");
      setTimeout(() => {
        setShowAddModal(false);
        setFormSuccess(null);
        setName("");
        setMobile("");
        setWhatsapp("");
        setAddress("");
        setCity("");
        setOccupation("");
        setReferencePerson("");
        setNotes("");
        fetchCustomers(true);
      }, 1000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "சேர்ப்பதில் தோல்வி");
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-24">
      {/* Header */}
      <div className="bg-slate-900 text-white px-5 pt-4 pb-6 rounded-b-3xl shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <div className="flex items-center gap-2">
              <UserSquare2 className="w-5 h-5 text-indigo-400" />
              <h1 className="text-xl font-bold">
                {language === "ta" ? "வாடிக்கையாளர்கள்" : "Customers"}
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {language === "ta" ? "சுயவிவரம், கடன்கள் & தொடர்பு" : "Profiles, Active Loans & Contact"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => fetchCustomers(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition tap-active disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-indigo-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddModal(true);
                setFormError(null);
                setFormSuccess(null);
              }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition tap-active shadow-md"
            >
              <Plus className="w-4 h-4" />
              <span>{language === "ta" ? "புதியவர்" : "Add"}</span>
            </button>
          </div>
        </div>

        {/* Count Strip */}
        <div className="mt-4 flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl px-4 py-2.5 border border-white/10 text-xs">
          <span className="text-slate-300">
            {language === "ta" ? "மொத்த வாடிக்கையாளர்கள்" : "Total Customers Registered"}
          </span>
          <span className="font-bold text-white text-sm">{customers.length}</span>
        </div>
      </div>

      {/* Search Bar */}
      <div className="px-4 mt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={language === "ta" ? "பெயர், மொபைல் அல்லது ஊர் மூலம் தேடு..." : "Search name, mobile or city..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Customer List */}
      <div className="px-4 mt-4 space-y-3">
        {loading && customers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 space-y-2">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-500" />
            <p className="text-xs">{language === "ta" ? "ஏற்றுகிறது..." : "Loading customers..."}</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : customers.length === 0 ? (
          <div className="p-8 text-center text-slate-500 bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800">
            <UserSquare2 className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              {language === "ta" ? "வாடிக்கையாளர் எவரும் இல்லை" : "No customers found"}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {searchQuery ? "தேடலை மாற்றவும்" : "புதிய வாடிக்கையாளரைச் சேர்க்க '+' பொத்தானை அழுத்தவும்"}
            </p>
          </div>
        ) : (
          customers.map((c) => {
            const activeLoans = (c.loans || []).filter((l) => l.status === "ACTIVE" || l.status === "OVERDUE");
            const totalOutstanding = activeLoans.reduce((sum, l) => sum + (l.principalOutstanding || 0), 0);

            return (
              <div
                key={c.id}
                onClick={() => handleOpenCustomerDetails(c)}
                className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 cursor-pointer tap-active hover:border-indigo-200 dark:hover:border-indigo-900 transition space-y-2.5"
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-sm">
                      {c.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                        {c.name}
                      </h2>
                      <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                        <Phone className="w-3 h-3" />
                        <span>{c.mobile}</span>
                        {c.city && <span>• {c.city}</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/80 text-xs">
                  <div className="text-slate-500">
                    <span>{language === "ta" ? "செயலில் உள்ள கடன்கள்: " : "Active Loans: "}</span>
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      {activeLoans.length}
                    </span>
                  </div>
                  {totalOutstanding > 0 && (
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">
                        {language === "ta" ? "நிலுவை" : "Outstanding"}
                      </span>
                      <span className="font-extrabold text-amber-600 dark:text-amber-400">
                        ₹{totalOutstanding.toLocaleString("en-IN")}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Customer Details Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-100 dark:bg-indigo-950/60 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-extrabold text-base">
                  {selectedCustomer.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {selectedCustomer.name}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {selectedCustomer.customerNo || "Customer Profile"}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {loadingDetails ? (
              <div className="p-6 text-center text-slate-500">
                <RefreshCw className="w-5 h-5 animate-spin mx-auto text-indigo-500 mb-2" />
                <span className="text-xs">விவரங்களை ஏற்றுகிறது...</span>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Contact & Address Strip */}
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3.5 rounded-2xl space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">{language === "ta" ? "தொலைபேசி" : "Phone"}</span>
                    <a
                      href={`tel:${selectedCustomer.mobile}`}
                      className="font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{selectedCustomer.mobile}</span>
                    </a>
                  </div>
                  {selectedCustomer.whatsapp && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">WhatsApp</span>
                      <a
                        href={`https://wa.me/91${selectedCustomer.whatsapp.replace(/\D/g, "")}`}
                        className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        <span>{selectedCustomer.whatsapp}</span>
                      </a>
                    </div>
                  )}
                  {selectedCustomer.address && (
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-slate-400 shrink-0">{language === "ta" ? "முகவரி" : "Address"}</span>
                      <span className="text-slate-700 dark:text-slate-300 text-right">
                        {selectedCustomer.address}, {selectedCustomer.city || ""}
                      </span>
                    </div>
                  )}
                  {selectedCustomer.occupation && (
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">{language === "ta" ? "தொழில்" : "Occupation"}</span>
                      <span className="text-slate-700 dark:text-slate-300 font-medium">
                        {selectedCustomer.occupation}
                      </span>
                    </div>
                  )}
                </div>

                {/* Loans Summary */}
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                    {language === "ta" ? "கடன் விவரங்கள்" : "Loan History"} ({(selectedCustomer.loans || []).length})
                  </h4>

                  {(selectedCustomer.loans || []).length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400 bg-slate-50 dark:bg-slate-800/30 rounded-xl">
                      {language === "ta" ? "கடன்கள் எதுவும் இல்லை" : "No active or closed loans"}
                    </div>
                  ) : (
                    (selectedCustomer.loans || []).map((loan) => (
                      <div
                        key={loan.id}
                        className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-100 dark:border-slate-700 space-y-1.5 text-xs"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-indigo-600 dark:text-indigo-400">
                            {loan.loanNo}
                          </span>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              loan.status === "ACTIVE"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : loan.status === "OVERDUE"
                                ? "bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {loan.status}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px]">
                          <div>
                            <span className="text-slate-400 block">அசல் (Principal)</span>
                            <span className="font-bold text-slate-900 dark:text-white">
                              ₹{loan.principalAmount?.toLocaleString("en-IN")}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-400 block">நிலுவை (Outstanding)</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">
                              ₹{loan.principalOutstanding?.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {language === "ta" ? "புதிய வாடிக்கையாளர் பதிவு" : "Register Customer"}
              </h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "வாடிக்கையாளர் பெயர் *" : "Customer Name *"}
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Murugan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "தொலைபேசி எண் *" : "Mobile Number *"}
                </label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  WhatsApp (Optional)
                </label>
                <input
                  type="tel"
                  placeholder="e.g. 9876543210"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === "ta" ? "ஊர் / நகரம்" : "City / Town"}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Madurai"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {language === "ta" ? "தொழில்" : "Occupation"}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Merchant"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "முகவரி" : "Address"}
                </label>
                <input
                  type="text"
                  placeholder="Door No, Street name"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === "ta" ? "பரிந்துரைத்தவர்" : "Reference Person"}
                </label>
                <input
                  type="text"
                  placeholder="Referral name & phone"
                  value={referencePerson}
                  onChange={(e) => setReferencePerson(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="w-1/2 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-400 tap-active"
                >
                  {language === "ta" ? "ரத்து" : "Cancel"}
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  className="w-1/2 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-bold shadow-md hover:bg-indigo-500 tap-active disabled:opacity-50"
                >
                  {formLoading ? "சேமிக்கிறது..." : language === "ta" ? "சேமி" : "Save"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
