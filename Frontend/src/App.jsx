import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Bot,
  Calendar,
  CheckCircle2,
  ChevronRight,
  FileSearch,
  FileText,
  LayoutDashboard,
  Loader2,
  LogIn,
  LogOut,
  MessageSquareText,
  PieChart as PieChartIcon,
  Receipt,
  Send,
  Sparkles,
  Trash2,
  TrendingUp,
  Upload,
  UserPlus,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

const STORAGE_KEY = "invoiceAnalyzerUser";
const COLORS = ["#0891b2", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0f766e", "#9333ea"];

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function getErrorMessage(data, fallback) {
  return data?.errors?.[0]?.msg || data?.message || data?.error || fallback;
}

function formatCurrency(value, currency = "INR") {
  const normalizedCurrency = currency || "INR";

  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: normalizedCurrency,
      maximumFractionDigits: 2,
    }).format(Number(value) || 0);
  } catch {
    return `${normalizedCurrency} ${(Number(value) || 0).toFixed(2)}`;
  }
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function buildFileUrl(fileUrl) {
  if (!fileUrl) return "";
  const apiOrigin = API_BASE_URL.replace(/\/api\/?$/, "");
  const normalizedPath = fileUrl.replace(/\\/g, "/").replace(/^.*uploads\//, "uploads/");
  return `${apiOrigin}/${normalizedPath}`;
}

export default function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "", otp: "" });
  const [user, setUser] = useState(getStoredUser);
  const [invoices, setInvoices] = useState([]);
  const [summary, setSummary] = useState([]);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [extractFile, setExtractFile] = useState(null);
  const [extractResult, setExtractResult] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([
    {
      role: "assistant",
      text: "Ask about your invoice categories, totals, or spending decisions.",
    },
  ]);
  const [notice, setNotice] = useState({ type: "", text: "" });
  const [loading, setLoading] = useState({
    auth: false,
    dashboard: false,
    upload: false,
    extract: false,
    chat: false,
    delete: "",
  });

  const [dashboardCurrency, setDashboardCurrency] = useState("INR");
  const [exchangeRates, setExchangeRates] = useState(null);

  useEffect(() => {
    fetch("https://api.exchangerate-api.com/v4/latest/USD")
      .then((res) => res.json())
      .then((data) => setExchangeRates(data.rates))
      .catch(() => console.error("Failed to load exchange rates"));
  }, []);

  const convertCurrency = useCallback(
    (amount, fromCurrency, toCurrency) => {
      if (!exchangeRates || !fromCurrency || !toCurrency) return amount;
      const fromRate = exchangeRates[fromCurrency.toUpperCase()] || 1;
      const toRate = exchangeRates[toCurrency.toUpperCase()] || 1;
      return (amount / fromRate) * toRate;
    },
    [exchangeRates]
  );

  const authHeaders = useMemo(
    () => (user?.token ? { Authorization: `Bearer ${user.token}` } : {}),
    [user]
  );

  const displayCurrency = dashboardCurrency;

  const normalizedInvoices = useMemo(() => {
    return invoices.map((inv) => ({
      ...inv,
      convertedAmount: convertCurrency(Number(inv.amount) || 0, inv.currency || "INR", displayCurrency),
    }));
  }, [invoices, convertCurrency, displayCurrency]);

  const chartData = useMemo(() => {
    if (summary.length) {
      return summary.map((item) => ({
        name: item._id || "Other",
        value: convertCurrency(Number(item.total) || 0, item.currency || "INR", displayCurrency),
        count: item.count || 0,
      }));
    }

    const grouped = normalizedInvoices.reduce((acc, invoice) => {
      const category = invoice.category || "Other";
      acc[category] = (acc[category] || 0) + invoice.convertedAmount;
      return acc;
    }, {});

    return Object.entries(grouped).map(([name, value]) => ({ name, value }));
  }, [normalizedInvoices, summary, convertCurrency, displayCurrency]);

  const totalExpense = normalizedInvoices.reduce((sum, invoice) => sum + invoice.convertedAmount, 0);
  const averageExpense = normalizedInvoices.length ? totalExpense / normalizedInvoices.length : 0;
  const topCategory = chartData.length
    ? chartData.reduce((top, item) => (item.value > top.value ? item : top), chartData[0])
    : null;

  const showNotice = useCallback((type, text) => {
    setNotice({ type, text });
  }, []);

  const loadDashboard = useCallback(async () => {
    if (!user?.token) return;

    setLoading((current) => ({ ...current, dashboard: true }));
    try {
      const [invoiceResponse, summaryResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/invoices`, { headers: authHeaders }),
        fetch(`${API_BASE_URL}/summary`, { headers: authHeaders }),
      ]);

      const invoiceData = await invoiceResponse.json();
      if (!invoiceResponse.ok) {
        throw new Error(getErrorMessage(invoiceData, "Unable to load invoices"));
      }

      const nextInvoices = invoiceData.invoices || [];
      setInvoices(nextInvoices);
      setSelectedInvoice((current) => {
        if (!current) return nextInvoices[0] || null;
        return nextInvoices.find((invoice) => invoice._id === current._id) || nextInvoices[0] || null;
      });

      if (summaryResponse.ok) {
        const summaryData = await summaryResponse.json();
        setSummary(summaryData.summary || []);
      }
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading((current) => ({ ...current, dashboard: false }));
    }
  }, [authHeaders, showNotice, user?.token]);

  useEffect(() => {
    // Initial dashboard sync is intentionally triggered when the authenticated user changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDashboard();
  }, [loadDashboard]);

  async function handleAuth(event) {
    event.preventDefault();
    setLoading((current) => ({ ...current, auth: true }));
    showNotice("", "");

    try {
      let endpoint = "";
      let payload = {};

      if (authMode === "register") {
        endpoint = "register";
        payload = authForm;
      } else if (authMode === "login") {
        endpoint = "login";
        payload = { email: authForm.email, password: authForm.password };
      } else if (authMode === "otp_request") {
        endpoint = "request-otp";
        payload = { email: authForm.email };
      } else if (authMode === "otp_verify") {
        endpoint = "login-with-otp";
        payload = { email: authForm.email, otp: authForm.otp };
      }

      const response = await fetch(`${API_BASE_URL}/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Authentication failed"));
      }

      if (authMode === "otp_request") {
        showNotice("success", data.message || "Code sent.");
        setAuthMode("otp_verify");
      } else {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        setUser(data);
        showNotice("success", authMode === "register" ? "Account created." : "Logged in.");
      }
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading((current) => ({ ...current, auth: false }));
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    if (!selectedFile) {
      showNotice("error", "Choose a PDF, JPG, JPEG, or PNG invoice first.");
      return;
    }

    setLoading((current) => ({ ...current, upload: true }));
    showNotice("", "");

    try {
      const formData = new FormData();
      formData.append("invoice", selectedFile);

      const response = await fetch(`${API_BASE_URL}/invoices/upload`, {
        method: "POST",
        headers: authHeaders,
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Invoice upload failed"));
      }

      setInvoices((current) => [data.invoice, ...current]);
      setSelectedInvoice(data.invoice);
      setSelectedFile(null);
      event.currentTarget.reset();
      showNotice("success", data.message || "Invoice analyzed and saved.");
      loadDashboard();
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading((current) => ({ ...current, upload: false }));
    }
  }

  async function handleExtract(event) {
    event.preventDefault();
    if (!extractFile) {
      showNotice("error", "Choose a file to extract without saving.");
      return;
    }

    setLoading((current) => ({ ...current, extract: true }));
    setExtractResult(null);
    showNotice("", "");

    try {
      const formData = new FormData();
      formData.append("invoice", extractFile);

      const response = await fetch(`${API_BASE_URL}/ai/extract`, {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Invoice extraction failed"));
      }

      setExtractResult(data.data);
      setExtractFile(null);
      event.currentTarget.reset();
      showNotice("success", "Financial analysis completed without saving to history.");
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading((current) => ({ ...current, extract: false }));
    }
  }

  async function openInvoice(invoice) {
    setSelectedInvoice(invoice);

    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoice._id}`, {
        headers: authHeaders,
      });
      const data = await response.json();

      if (response.ok && data.invoice) {
        setSelectedInvoice(data.invoice);
      }
    } catch {
      setSelectedInvoice(invoice);
    }
  }

  async function deleteInvoice(invoiceId) {
    if (!window.confirm("Delete this invoice forever?")) return;
    setLoading((current) => ({ ...current, delete: invoiceId }));
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/${invoiceId}`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to delete");
      
      setInvoices((current) => current.filter((inv) => inv._id !== invoiceId));
      if (selectedInvoice?._id === invoiceId) {
        setSelectedInvoice(null);
      }
      showNotice("success", "Invoice deleted.");
      loadDashboard();
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading((current) => ({ ...current, delete: "" }));
    }
  }

  const clearHistory = useCallback(async () => {
    if (!window.confirm("Are you sure you want to permanently delete all your invoices and clear the chat history?")) return;
    setLoading(current => ({ ...current, delete: "all" }));
    try {
      const response = await fetch(`${API_BASE_URL}/invoices/clear`, {
        method: "DELETE",
        headers: authHeaders,
      });
      if (!response.ok) throw new Error("Failed to clear history");
      setInvoices([]);
      setSummary([]);
      setSelectedInvoice(null);
      setChatMessages([{ role: "assistant", text: "Ask about your invoice categories, totals, or spending decisions." }]);
      showNotice("success", "History completely cleared.");
    } catch (error) {
      showNotice("error", error.message);
    } finally {
      setLoading(current => ({ ...current, delete: "all" }));
      setLoading(current => ({ ...current, delete: "" }));
    }
  }, [authHeaders, showNotice]);

  async function handleChat(event) {
    event.preventDefault();
    const question = chatInput.trim();
    if (!question) return;

    const nextMessages = [...chatMessages, { role: "user", text: question }];
    setChatMessages(nextMessages);
    setChatInput("");
    setLoading((current) => ({ ...current, chat: true }));

    const summaryText = chartData.map(c => `${c.name}: ${formatCurrency(c.value, displayCurrency)}`).join("\n");
    
    // Only send the 10 most recent invoices to prevent AI token quota limits
    const detailedInvoices = invoices.slice(0, 10).map(inv => {
      return `- ${inv.merchant} | ${formatCurrency(inv.amount, inv.currency)} | ${inv.category} | ${formatDate(inv.date)}`;
    }).join("\n");

    const invoiceSummary = `
Category Summary:
${summaryText}

Total Expense: ${formatCurrency(totalExpense, displayCurrency)}

Saved Invoices:
${detailedInvoices || "No invoices available."}
    `.trim();

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, invoiceSummary }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(getErrorMessage(data, "Chat request failed"));
      }

      setChatMessages([...nextMessages, { role: "assistant", text: data.reply }]);
    } catch (error) {
      setChatMessages([...nextMessages, { role: "assistant", text: error.message }]);
    } finally {
      setLoading((current) => ({ ...current, chat: false }));
    }
  }

  const logout = useCallback((reason = "") => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
    setInvoices([]);
    setSummary([]);
    setSelectedInvoice(null);
    setAuthForm({ name: "", email: "", password: "", otp: "" });
    if (reason) {
      showNotice("error", reason);
    } else {
      showNotice("", "");
    }
  }, [showNotice]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && user?.token) {
        logout("You were automatically logged out for security after switching tabs.");
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [user?.token, logout]);

  if (!user?.token) {
    return (
      <main className="min-h-screen bg-zinc-100 text-zinc-950">
        <div className="grid min-h-screen lg:grid-cols-[1fr_440px]">
          <section className="hidden bg-zinc-950 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="flex items-center gap-3 text-cyan-300">
                <Receipt className="h-7 w-7" />
                <span className="text-lg font-semibold">SyntaxSquad AI Invoice Analyzer</span>
              </div>
              <div className="mt-24 max-w-3xl">
                <h1 className="text-6xl font-semibold leading-tight tracking-normal">
                  Extract, review, and understand invoices from one workspace.
                </h1>
                <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-300">
                  Built around your Express controllers for authentication, invoice upload,
                  direct extraction, summaries, and financial chat.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-sm text-zinc-300">
              <AuthFeature icon={Upload} label="AI upload" />
              <AuthFeature icon={PieChartIcon} label="Expense summary" />
              <AuthFeature icon={Bot} label="Finance chat" />
            </div>
          </section>

          <section className="flex items-center justify-center p-5">
            <form
              onSubmit={handleAuth}
              className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">
                    {authMode === "register" ? "Create account" : authMode.startsWith("otp") ? "Login with Code" : "Welcome back"}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {authMode === "register" ? "Register to save analyzed invoices." : authMode === "otp_verify" ? "Check your email for the 6-digit code." : "Login to your invoice dashboard."}
                  </p>
                </div>
                {authMode === "register" ? (
                  <UserPlus className="h-8 w-8 text-cyan-700" />
                ) : (
                  <LogIn className="h-8 w-8 text-cyan-700" />
                )}
              </div>

              <div className="mt-6 space-y-4">
                {authMode === "register" && (
                  <TextField
                    label="Name"
                    value={authForm.name}
                    onChange={(value) => setAuthForm((current) => ({ ...current, name: value }))}
                    autoComplete="name"
                  />
                )}
                {authMode !== "otp_verify" && (
                  <TextField
                    label="Email"
                    type="email"
                    value={authForm.email}
                    onChange={(value) => setAuthForm((current) => ({ ...current, email: value }))}
                    autoComplete="email"
                  />
                )}
                {(authMode === "login" || authMode === "register") && (
                  <TextField
                    label="Password"
                    type="password"
                    value={authForm.password}
                    onChange={(value) => setAuthForm((current) => ({ ...current, password: value }))}
                    autoComplete={authMode === "register" ? "new-password" : "current-password"}
                    minLength={6}
                  />
                )}
                {authMode === "otp_verify" && (
                  <TextField
                    label="6-Digit Login Code"
                    type="text"
                    value={authForm.otp || ""}
                    onChange={(value) => setAuthForm((current) => ({ ...current, otp: value }))}
                    autoComplete="one-time-code"
                    maxLength={6}
                  />
                )}
              </div>

              <Notice notice={notice} className="mt-5" />

              <button
                type="submit"
                disabled={loading.auth}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-md bg-cyan-700 px-4 font-semibold text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading.auth && <Loader2 className="h-4 w-4 animate-spin" />}
                {authMode === "register" ? "Create account" : authMode === "otp_request" ? "Send Code" : authMode === "otp_verify" ? "Verify & Login" : "Login"}
              </button>

              <div className="mt-4 flex flex-col gap-2">
                {(authMode === "login" || authMode === "register") && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode((current) => (current === "register" ? "login" : "register"));
                      showNotice("", "");
                    }}
                    className="w-full text-sm font-medium text-cyan-800 hover:text-cyan-950"
                  >
                    {authMode === "register" ? "Already have an account? Login" : "Need an account? Register"}
                  </button>
                )}
                {authMode === "login" && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("otp_request");
                      showNotice("", "");
                    }}
                    className="w-full text-sm font-medium text-cyan-800 hover:text-cyan-950"
                  >
                    Forgot password? Login with code
                  </button>
                )}
                {(authMode === "otp_request" || authMode === "otp_verify") && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("login");
                      showNotice("", "");
                    }}
                    className="w-full text-sm font-medium text-cyan-800 hover:text-cyan-950"
                  >
                    Back to password login
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 text-zinc-950">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-950 text-cyan-300">
              <LayoutDashboard className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold">Invoice Analyzer</h1>
              <p className="text-sm text-zinc-500">{user.name || user.email}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={dashboardCurrency}
              onChange={(e) => setDashboardCurrency(e.target.value)}
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
              <option value="AUD">AUD ($)</option>
            </select>
            <StatusBadge loading={loading.dashboard || !exchangeRates} />
            <button
              type="button"
              onClick={clearHistory}
              disabled={loading.delete === "all"}
              className="flex h-10 items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50"
            >
              {loading.delete === "all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              Clear Data
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex h-10 items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-medium transition hover:bg-zinc-50"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-6">
        <Notice notice={notice} className="mb-5" />

        <section className="grid gap-4 md:grid-cols-3">
          <MetricCard
            icon={Receipt}
            label="Invoices"
            value={invoices.length}
            detail="Saved from authenticated uploads"
          />
          <MetricCard
            icon={PieChartIcon}
            label="Total expense"
            value={formatCurrency(totalExpense, displayCurrency)}
            detail={`${formatCurrency(averageExpense, displayCurrency)} average`}
          />
          <MetricCard
            icon={Sparkles}
            label="Top category"
            value={topCategory?.name || "None"}
            detail={topCategory ? formatCurrency(topCategory.value, displayCurrency) : "Upload to analyze"}
          />
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="space-y-6">
            <div className="grid gap-6 xl:grid-cols-2">
              <UploadPanel
                title="Save Invoice"
                description="Analyze the invoice and save the structured record to your dashboard."
                icon={Upload}
                file={selectedFile}
                onFile={setSelectedFile}
                onSubmit={handleUpload}
                loading={loading.upload}
                buttonText="Analyze and save"
              />
              <UploadPanel
                title="Quick Extract"
                description="Run AI extraction with financial analysis without adding it to history."
                icon={FileSearch}
                file={extractFile}
                onFile={setExtractFile}
                onSubmit={handleExtract}
                loading={loading.extract}
                buttonText="Extract only"
              />
            </div>

            {extractResult && <ExtractResult data={extractResult} />}

            <InvoiceDetail invoice={selectedInvoice} onDelete={deleteInvoice} deletingId={loading.delete} />

            <AnalyticsPanel chartData={chartData} currency={displayCurrency} />
          </div>

          <aside className="space-y-6">
            <HistoryPanel
              invoices={normalizedInvoices}
              selectedId={selectedInvoice?._id}
              currency={displayCurrency}
              onOpen={openInvoice}
            />
            <ChatPanel
              messages={chatMessages}
              input={chatInput}
              onInput={setChatInput}
              onSubmit={handleChat}
              loading={loading.chat}
            />
          </aside>
        </section>
      </div>
    </main>
  );
}

function AuthFeature({ icon: Icon, label }) {
  return (
    <div className="rounded-md border border-white/15 p-4">
      <Icon className="h-5 w-5 text-cyan-300" />
      <div className="mt-3 font-medium">{label}</div>
    </div>
  );
}

function TextField({ label, value, onChange, type = "text", ...props }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-zinc-700">{label}</span>
      <input
        {...props}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required
        className="mt-2 h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none transition focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
      />
    </label>
  );
}

function Notice({ notice, className = "" }) {
  if (!notice.text) return null;

  const isError = notice.type === "error";
  const Icon = isError ? AlertCircle : CheckCircle2;

  return (
    <div
      className={`${className} flex items-start gap-3 rounded-md border px-4 py-3 text-sm ${isError
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-emerald-200 bg-emerald-50 text-emerald-800"
        }`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{notice.text}</span>
    </div>
  );
}

function StatusBadge({ loading }) {
  return (
    <div className="flex h-10 items-center gap-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-600">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
      {loading ? "Syncing" : "Connected"}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, detail }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-500">{label}</span>
        <Icon className="h-5 w-5 text-cyan-700" />
      </div>
      <div className="mt-4 min-h-9 break-words text-2xl font-semibold">{value}</div>
      <p className="mt-2 text-sm text-zinc-500">{detail}</p>
    </div>
  );
}

function UploadPanel({ title, description, icon: Icon, file, onFile, onSubmit, loading, buttonText }) {
  return (
    <form onSubmit={onSubmit} className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-50 text-cyan-800">
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
        </div>
      </div>

      <label className="mt-5 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-center transition hover:border-cyan-700 hover:bg-cyan-50">
        <FileText className="h-8 w-8 text-zinc-500" />
        <span className="mt-3 max-w-full break-words text-sm font-medium">
          {file?.name || "Choose PDF, JPG, JPEG, or PNG"}
        </span>
        <span className="mt-1 text-xs text-zinc-500">Maximum file size is 5MB</span>
        <input
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(event) => onFile(event.target.files?.[0] || null)}
          className="hidden"
        />
      </label>

      <button
        type="submit"
        disabled={loading}
        className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
        {buttonText}
      </button>
    </form>
  );
}

function ExtractResult({ data }) {
  const analysis = data.finance_analysis;

  return (
    <section className="rounded-lg border border-cyan-200 bg-cyan-50 p-5">
      <div className="flex items-center gap-2">
        <FileSearch className="h-5 w-5 text-cyan-800" />
        <h2 className="text-lg font-semibold text-cyan-950">Quick Extract Result</h2>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <DataLine label="Invoice number" value={data.invoice_number} />
        <DataLine label="Invoice date" value={data.invoice_date} />
        <DataLine label="Customer" value={data.customer_name} />
        <DataLine label="Seller" value={data.seller_name} />
        <DataLine label="Total amount" value={formatNumber(data.total_amount)} />
        <DataLine label="Category" value={data.category || analysis?.category} />
      </div>
      {analysis && <FinancialAnalysis analysis={analysis} />}
    </section>
  );
}

function FinancialAnalysis({ analysis }) {
  const decision = String(analysis.decision || "BUY").toUpperCase();
  const decisionClass =
    decision === "AVOID"
      ? "border-red-200 bg-red-50 text-red-800"
      : decision === "CAUTION"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <div className="mt-4 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-900">
            <TrendingUp className="h-4 w-4 text-cyan-700" />
            Financial analysis
          </div>
          <p className="mt-2 text-sm leading-6 text-zinc-600">
            {analysis.reason || "Normal spending"}
          </p>
        </div>
        <span className={`inline-flex w-fit rounded-md border px-3 py-1 text-sm font-semibold ${decisionClass}`}>
          {decision}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <DataLine label="Finance category" value={analysis.category || "Others"} />
        <DataLine label="Past matches" value={analysis.past_transactions ?? 0} />
        <DataLine
          label="Category spend"
          value={formatNumber(analysis.total_spent_in_category)}
        />
        <DataLine
          label="Amount checked"
          value={formatNumber(analysis.total_amount_numeric)}
        />
      </div>
    </div>
  );
}

function InvoiceDetail({ invoice, onDelete, deletingId }) {
  if (!invoice) {
    return (
      <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <Receipt className="mx-auto h-10 w-10 text-zinc-400" />
        <h2 className="mt-4 text-lg font-semibold">No invoice selected</h2>
        <p className="mt-2 text-sm text-zinc-500">Upload or choose an invoice to review extracted data.</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-zinc-200 p-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm font-medium text-zinc-500">Selected invoice</p>
          <h2 className="mt-1 break-words text-2xl font-semibold">{invoice.merchant || "Unknown Merchant"}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(invoice.date)}
            </span>
            <span className="rounded-md bg-zinc-100 px-2 py-1">{invoice.category || "Other"}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-sm text-zinc-500">Amount</div>
            <div className="text-2xl font-semibold">{formatCurrency(invoice.amount, invoice.currency)}</div>
          </div>
          <button
            type="button"
            onClick={() => onDelete(invoice._id)}
            disabled={deletingId === invoice._id}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-red-200 text-red-700 transition hover:bg-red-50 disabled:opacity-60"
            aria-label="Delete invoice"
            title="Delete invoice"
          >
            {deletingId === invoice._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="grid gap-5 p-5 lg:grid-cols-[1fr_280px]">
        <div>
          <h3 className="font-semibold">Line items</h3>
          <div className="mt-3 overflow-hidden rounded-md border border-zinc-200">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500">
                <tr>
                  <th className="w-[42%] px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {invoice.items?.length ? (
                  invoice.items.map((item, index) => (
                    <tr key={`${item.name}-${index}`} className="border-t border-zinc-200">
                      <td className="break-words px-3 py-3">{item.name || "Invoice item"}</td>
                      <td className="px-3 py-3">{item.quantity || 1}</td>
                      <td className="px-3 py-3">{formatCurrency(item.unitPrice || item.price, invoice.currency)}</td>
                      <td className="px-3 py-3 text-right">{formatCurrency(item.total, invoice.currency)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="px-3 py-6 text-center text-zinc-500">
                      No line items were extracted.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3">
          <DataLine label="Tax" value={formatCurrency(invoice.tax, invoice.currency)} />
          <DataLine label="Currency" value={invoice.currency || "INR"} />
          <DataLine label="Created" value={formatDate(invoice.createdAt)} />
          {invoice.fileUrl && (
            <a
              href={buildFileUrl(invoice.fileUrl)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between rounded-md border border-zinc-200 px-3 py-3 text-sm font-medium text-cyan-800 transition hover:bg-cyan-50"
            >
              View uploaded file
              <ChevronRight className="h-4 w-4" />
            </a>
          )}
          <div className="rounded-md bg-zinc-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-cyan-700" />
              AI insight
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              {invoice.aiInsight || "No recommendation returned for this invoice."}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function AnalyticsPanel({ chartData, currency }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <PieChartIcon className="h-5 w-5 text-cyan-700" />
        <h2 className="text-lg font-semibold">Expense Summary</h2>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="h-72 rounded-md border border-zinc-200 p-3">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={92} label>
                  {chartData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(value, currency)} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
        <div className="h-72 rounded-md border border-zinc-200 p-3">
          {chartData.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} fill="#0891b2" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart />
          )}
        </div>
      </div>
    </section>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-zinc-500">
      No invoice data yet.
    </div>
  );
}

function HistoryPanel({ invoices, selectedId, currency, onOpen }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">History</h2>
        <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-600">{invoices.length} records</span>
      </div>
      <div className="mt-4 max-h-[480px] space-y-2 overflow-auto pr-1">
        {invoices.length ? (
          invoices.map((invoice) => (
            <button
              key={invoice._id}
              type="button"
              onClick={() => onOpen(invoice)}
              className={`w-full rounded-md border p-3 text-left transition ${selectedId === invoice._id
                  ? "border-cyan-700 bg-cyan-50"
                  : "border-zinc-200 bg-white hover:bg-zinc-50"
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-medium">{invoice.merchant || "Unknown Merchant"}</div>
                  <div className="mt-1 text-xs text-zinc-500">{invoice.category || "Other"}</div>
                </div>
                <div className="shrink-0 text-sm font-semibold">
                  {formatCurrency(invoice.convertedAmount ?? invoice.amount, currency)}
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-md border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
            Saved invoices will appear here.
          </div>
        )}
      </div>
    </section>
  );
}

function ChatPanel({ messages, input, onInput, onSubmit, loading }) {
  return (
    <section className="flex h-[520px] flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-5 w-5 text-cyan-700" />
        <h2 className="text-lg font-semibold">Financial AI Assistant</h2>
      </div>
      <div className="mt-4 flex-1 space-y-3 overflow-auto pr-1">
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={`max-w-[88%] rounded-md px-3 py-2 text-sm leading-6 ${message.role === "user"
                ? "ml-auto bg-cyan-700 text-white"
                : "bg-zinc-100 text-zinc-700"
              }`}
          >
            {message.text}
          </div>
        ))}
        {loading && (
          <div className="flex max-w-[88%] items-center gap-2 rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Thinking
          </div>
        )}
      </div>
      <form onSubmit={onSubmit} className="mt-4 flex gap-2">
        <input
          value={input}
          onChange={(event) => onInput(event.target.value)}
          placeholder="Ask a finance question"
          disabled={loading}
          className="h-10 min-w-0 flex-1 rounded-md border border-zinc-300 px-3 text-sm outline-none focus:border-cyan-700 focus:ring-2 focus:ring-cyan-700/15"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          className="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-700 text-white transition hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-60"
          aria-label="Send question"
          title="Send question"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </section>
  );
}

function DataLine({ label, value }) {
  return (
    <div className="rounded-md border border-zinc-200 bg-white px-3 py-3">
      <div className="text-xs font-medium uppercase tracking-normal text-zinc-500">{label}</div>
      <div className="mt-1 min-h-5 break-words text-sm font-semibold text-zinc-900">
        {value || value === 0 ? value : "-"}
      </div>
    </div>
  );
}
