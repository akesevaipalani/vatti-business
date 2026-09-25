import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  UserPlus,
  Phone,
  ChevronRight,
  RefreshCw,
  X,
  FileText,
  MapPin,
  Briefcase,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Customer } from "../types";

export const CustomersScreen: React.FC = () => {
  const { language, isOnline } = useAuth();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");

  // Customer Detail Sheet
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  // Add Customer Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [formName, setFormName] = useState("");
  const [formMobile, setFormMobile] = useState("");
  const [formWhatsapp, setFormWhatsapp] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formOccupation, setFormOccupation] = useState("");
  const [formReference, setFormReference] = useState("");

  const fetchCustomers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await api.getCustomers(search.trim() || undefined);
      setCustomers(res.customers || []);
    } catch (err) {
      console.error("Failed to load customers:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleOpenDetail = async (customerId: string) => {
    setLoadingCustomer(true);
    try {
      const res = await api.getCustomer(customerId);
      setSelectedCustomer(res.customer);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to load customer");
    } finally {
      setLoadingCustomer(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formMobile.trim()) {
      alert(language === "ta" ? "பெயர் மற்றும் அலைபேசி எண் தேவை" : "Name and mobile number are required");
      return;
    }

    setSavingCustomer(true);
    try {
      await api.createCustomer({
        name: formName.trim(),
        mobile: formMobile.trim(),
        whatsapp: formWhatsapp.trim() || undefined,
        address: formAddress.trim() || undefined,
        city: formCity.trim() || undefined,
        occupation: formOccupation.trim() || undefined,
        referencePerson: formReference.trim() || undefined,
      });

      setShowAddModal(false);
      // Reset form
      setFormName("");
      setFormMobile("");
      setFormWhatsapp("");
      setFormAddress("");
      setFormCity("");
      setFormOccupation("");
      setFormReference("");

      fetchCustomers(true);
      alert(language === "ta" ? "வாடிக்கையாளர் வெற்றிகரமாக சேர்க்கப்பட்டார்!" : "Customer added successfully!");
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSavingCustomer(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 pt-4 pb-3 sticky top-0 z-30 space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">
              {language === "ta" ? "வாடிக்கையாளர்கள்" : "Customers Directory"}
            </h1>
            <p className="text-xs text-slate-500">
              {language === "ta" ? "வாடிக்கையாளர் தொடர்பு மற்றும் கடன் விபரம்" : "Contacts & outstanding balances"}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => fetchCustomers(true)}
              disabled={refreshing}
              className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 tap-active disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!isOnline}
              className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-3 rounded-xl text-xs shadow-md shadow-indigo-600/20 tap-active disabled:opacity-50"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>{language === "ta" ? "புதியவர்" : "Add"}</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={language === "ta" ? "பெயர், அலைபேசி, குறியீடு..." : "Search by name, phone, code..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 pl-9 pr-3 text-xs text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
          />
        </div>
      </div>

      {/* List */}
      <div className="p-4 space-y-3">
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs space-y-2">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
            <p>{language === "ta" ? "வாடிக்கையாளர் பட்டியல் ஏற்றப்படுகிறது..." : "Loading customers..."}</p>
          </div>
        ) : customers.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800 p-6 space-y-2">
            <Users className="w-8 h-8 text-slate-300 mx-auto" />
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-400">
              {language === "ta" ? "வாடிக்கையாளர்கள் எதுவும் கிடைக்கவில்லை" : "No customers found"}
            </p>
          </div>
        ) : (
          customers.map((c) => (
            <div
              key={c.id}
              onClick={() => handleOpenDetail(c.id)}
              className="bg-white dark:bg-slate-900 rounded-2xl p-4 shadow-sm border border-slate-100 dark:border-slate-800 space-y-2.5 cursor-pointer tap-active"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">
                      {c.name}
                    </h3>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 font-mono px-1.5 py-0.5 rounded font-medium">
                      {c.customerCode}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    <a
                      href={`tel:${c.mobile}`}
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-indigo-600 font-medium hover:underline"
                    >
                      <Phone className="w-3 h-3" />
                      <span>{c.mobile}</span>
                    </a>
                    {c.city && <span>• {c.city}</span>}
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400">
                    {language === "ta" ? "நிலுவை" : "Outstanding"}
                  </span>
                  <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">
                    ₹{(c.totalOutstanding || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-800">
                <span>
                  {c.activeLoansCount || 0} {language === "ta" ? "செயலில் உள்ள கடன்கள்" : "active loans"}
                </span>
                <span className="text-indigo-600 font-semibold flex items-center gap-0.5">
                  {language === "ta" ? "விவரங்கள்" : "View"} <ChevronRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Customer Detail Sheet */}
      {selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[88vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                  {selectedCustomer.customerCode}
                </span>
                <h3 className="font-bold text-slate-900 dark:text-white text-base mt-1">
                  {selectedCustomer.name}
                </h3>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl p-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                <Phone className="w-3.5 h-3.5 text-slate-400" />
                <span className="font-semibold">{selectedCustomer.mobile}</span>
                {selectedCustomer.whatsapp && (
                  <span className="text-emerald-600 text-[11px]">(WA: {selectedCustomer.whatsapp})</span>
                )}
              </div>
              {selectedCustomer.address && (
                <div className="flex items-start gap-2 text-slate-600 dark:text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                  <span>
                    {selectedCustomer.address} {selectedCustomer.city && `, ${selectedCustomer.city}`}
                  </span>
                </div>
              )}
              {selectedCustomer.occupation && (
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                  <Briefcase className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedCustomer.occupation}</span>
                </div>
              )}
            </div>

            {/* Loan History */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {language === "ta" ? "கடன் வரலாறு" : "Loan History"} ({selectedCustomer.loans?.length || 0})
              </h4>
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {selectedCustomer.loans?.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">
                    {language === "ta" ? "இந்த வாடிக்கையாளருக்கு கடன்கள் எதுவும் இல்லை" : "No loans associated"}
                  </p>
                ) : (
                  selectedCustomer.loans?.map((loan) => (
                    <div
                      key={loan.id}
                      className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-700/60 flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {loan.loanNo}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {loan.status}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          ₹{loan.principalAmount.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] text-amber-600 font-semibold">
                          ₹{(loan.principalOutstanding + loan.interestOutstanding).toLocaleString("en-IN")} due
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-100 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-white text-base">
                  {language === "ta" ? "புதிய வாடிக்கையாளர் பதிவு" : "Register New Customer"}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "ta" ? "வாடிக்கையாளர் தகவல்களை உள்ளிடவும்" : "Enter customer details"}
                </p>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === "ta" ? "வாடிக்கையாளர் பெயர் *" : "Customer Name *"}
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {language === "ta" ? "அலைபேசி எண் *" : "Mobile Number *"}
                  </label>
                  <input
                    type="tel"
                    required
                    value={formMobile}
                    onChange={(e) => setFormMobile(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    WhatsApp
                  </label>
                  <input
                    type="tel"
                    value={formWhatsapp}
                    onChange={(e) => setFormWhatsapp(e.target.value)}
                    placeholder="9876543210"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === "ta" ? "முகவரி" : "Address"}
                </label>
                <input
                  type="text"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="123, Bazaar Street"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {language === "ta" ? "ஊர் / நகரம்" : "City / Town"}
                  </label>
                  <input
                    type="text"
                    value={formCity}
                    onChange={(e) => setFormCity(e.target.value)}
                    placeholder="Chennai"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    {language === "ta" ? "தொழில்" : "Occupation"}
                  </label>
                  <input
                    type="text"
                    value={formOccupation}
                    onChange={(e) => setFormOccupation(e.target.value)}
                    placeholder="Merchant"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {language === "ta" ? "அறிமுக நபர்" : "Reference Person"}
                </label>
                <input
                  type="text"
                  value={formReference}
                  onChange={(e) => setFormReference(e.target.value)}
                  placeholder="Friend / Relative"
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs shadow-lg shadow-indigo-600/30 tap-active disabled:opacity-50"
                >
                  {savingCustomer ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mx-auto" />
                  ) : (
                    <span>{language === "ta" ? "வாடிக்கையாளரை சேமி" : "Save Customer"}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
