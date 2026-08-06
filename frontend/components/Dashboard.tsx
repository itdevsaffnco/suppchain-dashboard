"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DashboardData,
  EnrichedSku,
  Sku,
  Batch,
  AppUser,
  enrichAll,
  computeKpis,
  seedData,
} from "@/lib/dashboard";
import { themes, ThemeName, formatSkuChartLabel, hexToRgba } from "@/lib/chartThemes";
import { translate, Lang } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n/en";
import { ComboChart, GroupedBarChart, SimpleBarChart, DoughnutChart } from "./charts";
import LiveWallpaper from "./LiveWallpaper";

type Session = { username: string; role: "Admin" | "User" };
type TabId = "dashboard" | "weekly" | "health" | "aging" | "settings" | "accounts";

const THEME_OPTIONS: { value: ThemeName; labelKey: keyof Dict; swatch: string }[] = [
  { value: "theme-default", labelKey: "theme_blue", swatch: "linear-gradient(135deg,#1E3A8A,#0EA5E9)" },
  { value: "theme-dark", labelKey: "theme_dark", swatch: "linear-gradient(135deg,#0B1220,#3B82F6)" },
  { value: "theme-emerald", labelKey: "theme_emerald", swatch: "linear-gradient(135deg,#065F46,#10B981)" },
];
type Toast = { id: number; msg: string; type: "success" | "error" | "warning" };

const WEEKS = [0, 1, 2, 3, 4];

function downloadCSV(csv: string, fileName: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function parseCSVRow(str: string): string[] {
  const arr: string[] = [];
  let quote = false;
  let col = "";
  for (let i = 0; i < str.length; i++) {
    const cc = str[i];
    const nc = str[i + 1];
    if (cc === '"' && quote && nc === '"') { col += cc; i++; continue; }
    if (cc === '"') { quote = !quote; continue; }
    if (cc === "," && !quote) { arr.push(col.trim().replace(/^"|"$/g, "")); col = ""; continue; }
    col += cc;
  }
  arr.push(col.trim().replace(/^"|"$/g, ""));
  return arr;
}

const sum = (arr: number[]) => arr.reduce((a, b) => a + b, 0);
const nf = (v: number) => v.toLocaleString();

export default function Dashboard({ initialSession }: { initialSession: Session | null }) {
  const [session, setSession] = useState<Session | null>(initialSession);
  const [data, setData] = useState<DashboardData | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [theme, setTheme] = useState<ThemeName>("theme-default");
  const [tab, setTab] = useState<TabId>("dashboard");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  const t = useCallback((key: keyof Dict) => translate(lang, key), [lang]);
  const themeObj = themes[theme];

  // --- data loading -------------------------------------------------------
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    fetch("/api/data")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: DashboardData) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setData(seedData()); });
    return () => { cancelled = true; };
  }, [session]);

  // --- theme on body ------------------------------------------------------
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  const enriched: EnrichedSku[] = useMemo(
    () => (data ? enrichAll(data.skus) : []),
    [data]
  );
  const kpis = useMemo(() => computeKpis(enriched), [enriched]);
  const categoryNames = useMemo(() => (data ? Object.keys(data.categories) : []), [data]);

  // --- toasts / confirm ---------------------------------------------------
  const showToast = useCallback((msg: string, type: Toast["type"] = "success") => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 4000);
  }, []);

  const [confirmState, setConfirmState] = useState<{ open: boolean; title: string; message: string }>({
    open: false, title: "", message: "",
  });
  const confirmResolver = useRef<((v: boolean) => void) | null>(null);
  const showConfirm = useCallback((message: string, title: string) => {
    setConfirmState({ open: true, title, message });
    return new Promise<boolean>((resolve) => { confirmResolver.current = resolve; });
  }, []);
  const closeConfirm = (result: boolean) => {
    setConfirmState((s) => ({ ...s, open: false }));
    confirmResolver.current?.(result);
    confirmResolver.current = null;
  };

  // --- raw data mutation helper ------------------------------------------
  const updateSkus = useCallback((fn: (skus: Sku[]) => Sku[]) => {
    setData((prev) => (prev ? { ...prev, skus: fn(prev.skus) } : prev));
  }, []);

  // --- login / logout -----------------------------------------------------
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const username = (form.elements.namedItem("username") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    setLoggingIn(true);
    setLoginError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const json = await res.json();
      if (!res.ok) { setLoginError(t((json.error as keyof Dict) || "login_error")); return; }
      setSession({ username: json.username, role: json.role });
      setTab("dashboard");
    } catch {
      setLoginError(t("login_error"));
    } finally {
      setLoggingIn(false);
    }
  };

  // --- forgot password ----------------------------------------------------
  const [loginView, setLoginView] = useState<"login" | "forgot">("login");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");
  const [devResetUrl, setDevResetUrl] = useState(""); // demo-mode link when SMTP is not configured
  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = (e.currentTarget.elements.namedItem("forgot_email") as HTMLInputElement).value;
    setForgotSending(true);
    setForgotError("");
    try {
      const res = await fetch("/api/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok) { setForgotError(t((json.error as keyof Dict) || "reset_email_failed")); return; }
      setForgotSent(true);
      if (json.devResetUrl) setDevResetUrl(json.devResetUrl);
    } catch {
      setForgotError(t("reset_email_failed"));
    } finally {
      setForgotSending(false);
    }
  };
  const backToLogin = () => {
    setLoginView("login");
    setForgotSent(false);
    setForgotError("");
    setDevResetUrl("");
  };

  const handleLogout = async () => {
    const ok = await showConfirm("Are you sure you want to log out of the SCM System?", "Logout Session");
    if (!ok) return;
    await fetch("/api/logout", { method: "POST" });
    setSession(null);
    setData(null);
    setTab("dashboard");
  };

  const isAdmin = session?.role === "Admin";

  const [changingPw, setChangingPw] = useState(false);
  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const current = (form.elements.namedItem("current") as HTMLInputElement).value;
    const next = (form.elements.namedItem("next") as HTMLInputElement).value;
    const confirm = (form.elements.namedItem("confirm") as HTMLInputElement).value;
    if (next.length < 6) { showToast(t("password_too_short"), "error"); return; }
    if (next !== confirm) { showToast(t("password_mismatch"), "error"); return; }
    setChangingPw(true);
    try {
      const res = await fetch("/api/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      const json = await res.json();
      if (!res.ok) { showToast(t((json.error as keyof Dict) || "login_error"), "error"); return; }
      form.reset();
      showToast(t("password_updated"), "success");
    } catch {
      showToast(t("login_error"), "error");
    } finally {
      setChangingPw(false);
    }
  };

  // --- table filters / search --------------------------------------------
  const [weeklyCat, setWeeklyCat] = useState("ALL");
  const [weeklySearch, setWeeklySearch] = useState("");
  const [healthCat, setHealthCat] = useState("ALL");
  const [healthStatus, setHealthStatus] = useState("ALL");
  const [agingCat, setAgingCat] = useState("ALL");
  const [agingStatus, setAgingStatus] = useState("ALL");
  const [agingSearch, setAgingSearch] = useState("");
  const [openFilter, setOpenFilter] = useState<string | null>(null);

  useEffect(() => {
    const close = () => setOpenFilter(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, []);
  const toggleFilter = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenFilter((cur) => (cur === id ? null : id));
  };

  // --- analysis view selectors -------------------------------------------
  const [catValue, setCatValue] = useState("ALL");
  const [skuValue, setSkuValue] = useState("ALL");
  const [globalDate, setGlobalDate] = useState(() => new Date().toISOString().split("T")[0]);

  // --- modals -------------------------------------------------------------
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editUserData, setEditUserData] = useState<AppUser | null>(null);
  const [skuView, setSkuView] = useState<EnrichedSku | null>(null);
  const [batchSku, setBatchSku] = useState<string | null>(null);

  // ======================================================================
  // Derived chart datasets (mirror updateCategoryView / updateSkuView / ...)
  // ======================================================================
  const catTrends = useMemo(() => {
    let f = [0, 0, 0, 0, 0];
    let r = [0, 0, 0, 0, 0];
    if (catValue === "ALL") {
      enriched.forEach((s) => WEEKS.forEach((i) => { f[i] += s.f_trend[i] || 0; r[i] += s.r_trend[i] || 0; }));
    } else if (data?.categories[catValue]) {
      f = data.categories[catValue].forecast.slice(0, 5);
      r = data.categories[catValue].realisasi.slice(0, 5);
    }
    return { f, r };
  }, [catValue, enriched, data]);

  const skusInScope = useMemo(
    () => (catValue === "ALL" ? enriched : enriched.filter((s) => s.cat === catValue)),
    [catValue, enriched]
  );

  const breakdown = useMemo(() => {
    const labels = skusInScope.map((s) => formatSkuChartLabel(s.name));
    const forecast = skusInScope.map((s) => sum(s.f_trend.slice(0, 5)));
    const realization = skusInScope.map((s) => sum(s.r_trend.slice(0, 5)));
    return { labels, forecast, realization };
  }, [skusInScope]);

  const skuTrends = useMemo(() => {
    let f = [0, 0, 0, 0, 0];
    let r = [0, 0, 0, 0, 0];
    if (skuValue === "ALL") {
      skusInScope.forEach((s) => WEEKS.forEach((i) => { f[i] += s.f_trend[i] || 0; r[i] += s.r_trend[i] || 0; }));
    } else {
      const s = enriched.find((x) => x.name === skuValue);
      if (s) { f = s.f_trend.slice(0, 5); r = s.r_trend.slice(0, 5); }
    }
    return { f, r };
  }, [skuValue, skusInScope, enriched]);

  const agingBuckets = useMemo(() => {
    let a30 = 0, a60 = 0, a90 = 0, a90p = 0;
    enriched.forEach((s) => {
      if (s.stock > 0) {
        if (s.kategori_aging === "0-30 hari") a30++;
        else if (s.kategori_aging === "31-60 hari") a60++;
        else if (s.kategori_aging === "61-90 hari") a90++;
        else if (s.kategori_aging === "91+ hari") a90p++;
      }
    });
    return [a30, a60, a90, a90p];
  }, [enriched]);

  const tipeComposition = useMemo(() => {
    const counts: Record<string, number> = {};
    enriched.forEach((s) => { const k = s.tipe_stock || "Reguler"; counts[k] = (counts[k] || 0) + 1; });
    return { labels: Object.keys(counts), data: Object.values(counts) };
  }, [enriched]);

  const summary = useMemo(() => {
    const shortage = enriched.filter((s) => s.status === "Shortage").sort((a, b) => a.coverage - b.coverage).slice(0, 3);
    const overstock = enriched.filter((s) => s.status_aging === "Kritis" || s.status_aging === "Waspada").sort((a, b) => b.selisih_target - a.selisih_target).slice(0, 3);
    return { shortage, overstock };
  }, [enriched]);

  // ======================================================================
  // Mutations
  // ======================================================================
  const deleteSku = async (name: string) => {
    const ok = await showConfirm(`CRITICAL: Are you sure you want to permanently delete SKU "${name}"? All weekly entries and FIFO batch records will be lost.`, "Delete SKU Master");
    if (!ok) return;
    updateSkus((skus) => skus.filter((s) => s.name !== name));
    showToast("SKU master record deleted successfully.", "warning");
  };

  const deleteWeekly = async (name: string, weekIdx: number) => {
    const ok = await showConfirm(`Are you sure you want to clear W${weekIdx + 1} forecast and realization values for "${name}"?`, "Clear Weekly Entry");
    if (!ok) return;
    updateSkus((skus) => skus.map((s) => {
      if (s.name !== name) return s;
      const f = s.f_trend.slice(); const r = s.r_trend.slice();
      f[weekIdx] = 0; r[weekIdx] = 0;
      return { ...s, f_trend: f, r_trend: r };
    }));
    showToast("Weekly data values cleared.", "warning");
  };

  const addBatch = (name: string, batch: Batch) => {
    updateSkus((skus) => skus.map((s) => (s.name === name ? { ...s, batches: [...s.batches, batch] } : s)));
  };
  const deleteBatch = async (name: string, batchId: string) => {
    const ok = await showConfirm("Are you sure you want to delete this specific batch? This will affect FIFO aging.", "Delete Batch");
    if (!ok) return;
    updateSkus((skus) => skus.map((s) => (s.name === name ? { ...s, batches: s.batches.filter((b) => b.id !== batchId) } : s)));
    showToast("Batch removed.", "warning");
  };

  // User management is server-backed so email login & password reset stay in
  // sync with the accounts created here.
  const addUser = async (u: { username: string; email: string; role: AppUser["role"]; password: string }): Promise<boolean> => {
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(u),
      });
      const json = await res.json();
      if (!res.ok) { showToast(t((json.error as keyof Dict) || "missing_fields"), "error"); return false; }
      setData((prev) => prev ? { ...prev, users: [...prev.users, json.user as AppUser] } : prev);
      showToast("New user account created successfully!", "success");
      return true;
    } catch {
      showToast(t("missing_fields"), "error");
      return false;
    }
  };
  const deleteUser = async (id: number, username: string) => {
    const ok = await showConfirm(`Are you sure you want to permanently delete account '${username}'?`, "Delete User");
    if (!ok) return;
    try {
      const res = await fetch(`/api/users?id=${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) { showToast(t((json.error as keyof Dict) || "user_not_found"), "error"); return; }
      setData((prev) => prev ? { ...prev, users: prev.users.filter((u) => u.id !== id) } : prev);
      showToast("User account deleted.", "warning");
    } catch {
      showToast(t("user_not_found"), "error");
    }
  };
  const updateUser = async (u: { id: number; username: string; email: string; role: AppUser["role"]; password?: string }): Promise<boolean> => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(u),
      });
      const json = await res.json();
      if (!res.ok) { showToast(t((json.error as keyof Dict) || "missing_fields"), "error"); return false; }
      setData((prev) => prev ? { ...prev, users: prev.users.map((usr) => usr.id === u.id ? json.user as AppUser : usr) } : prev);
      showToast(t("user_updated"), "success");
      return true;
    } catch {
      showToast(t("missing_fields"), "error");
      return false;
    }
  };

  // --- CSV import ---------------------------------------------------------
  const importWeekly = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = String(evt.target?.result || "").split("\n");
      if (lines.length < 2) return showToast("Error: Invalid CSV format.", "error");
      setData((prev) => {
        if (!prev) return prev;
        const skus = prev.skus.map((s) => ({ ...s, f_trend: s.f_trend.slice(), r_trend: s.r_trend.slice() }));
        const cats = { ...prev.categories };
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const c = parseCSVRow(lines[i]); if (c.length < 5) continue;
          const week = parseInt(c[2]); if (week < 1 || week > 5) continue;
          let sku = skus.find((s) => s.name === c[0]);
          if (!sku) {
            sku = { name: c[0], cat: c[1] || "UNCATEGORIZED", f_trend: [0,0,0,0,0], r_trend: [0,0,0,0,0], po: 0, safety: 0, daily_demand: 1, tipe_stock: "Reguler", target_simpan: 30, batches: [] };
            skus.push(sku);
            if (!cats[sku.cat]) cats[sku.cat] = { forecast: [0,0,0,0,0], realisasi: [0,0,0,0,0] };
          }
          sku.f_trend[week - 1] = parseInt(c[3]) || 0;
          sku.r_trend[week - 1] = parseInt(c[4]) || 0;
          count++;
        }
        showToast(`Import Successful: Processed and updated ${count} weekly records.`, "success");
        return { ...prev, skus, categories: cats };
      });
    };
    reader.readAsText(file);
  };

  const importStock = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = String(evt.target?.result || "").split("\n");
      if (lines.length < 2) return showToast("Error: Invalid CSV format.", "error");
      setData((prev) => {
        if (!prev) return prev;
        const skus = prev.skus.map((s) => ({ ...s, batches: s.batches.slice() }));
        const cats = { ...prev.categories };
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const c = parseCSVRow(lines[i]); if (c.length < 6) continue;
          const demand = parseFloat(c[2]) || 1, stock = parseInt(c[3]) || 0, po = parseInt(c[4]) || 0, safety = parseInt(c[5]) || 0;
          let sku = skus.find((s) => s.name === c[0]);
          if (!sku) {
            sku = { name: c[0], cat: c[1] || "UNCATEGORIZED", f_trend: [0,0,0,0,0], r_trend: [0,0,0,0,0], po, safety, daily_demand: demand, tipe_stock: "Reguler", target_simpan: 30, batches: [] };
            skus.push(sku);
            if (!cats[sku.cat]) cats[sku.cat] = { forecast: [0,0,0,0,0], realisasi: [0,0,0,0,0] };
          }
          sku.cat = c[1] || sku.cat; sku.daily_demand = demand; sku.po = po; sku.safety = safety;
          if (stock > 0 && sku.batches.length === 0) {
            sku.batches = [{ id: "B_INIT_" + Date.now(), date: new Date().toISOString().split("T")[0], qty_in: stock, qty_used: 0, sisa: stock }];
          }
          count++;
        }
        showToast(`Import Successful: Processed and updated parameters for ${count} SKUs.`, "success");
        return { ...prev, skus, categories: cats };
      });
    };
    reader.readAsText(file);
  };

  const importAging = (file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const lines = String(evt.target?.result || "").split("\n");
      if (lines.length < 2) return showToast("Error: Invalid CSV format.", "error");
      setData((prev) => {
        if (!prev) return prev;
        const skus = prev.skus.map((s) => ({ ...s, batches: s.batches.slice() }));
        const cats = { ...prev.categories };
        const cleared: Record<string, boolean> = {};
        let count = 0;
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          const c = parseCSVRow(lines[i]); if (c.length < 8) continue;
          const qtyIn = parseInt(c[3]) || 0, qtyUsed = parseInt(c[4]) || 0, sisa = parseInt(c[5]) || 0;
          let sku = skus.find((s) => s.name === c[0]);
          if (!sku) {
            sku = { name: c[0], cat: c[1] || "UNCATEGORIZED", f_trend: [0,0,0,0,0], r_trend: [0,0,0,0,0], po: 0, safety: 0, daily_demand: 1, tipe_stock: "Reguler", target_simpan: 30, batches: [] };
            skus.push(sku);
            if (!cats[sku.cat]) cats[sku.cat] = { forecast: [0,0,0,0,0], realisasi: [0,0,0,0,0] };
          }
          sku.tipe_stock = c[6] || "Reguler"; sku.target_simpan = parseInt(c[7]) || 30;
          if (!cleared[c[0]]) { sku.batches = []; cleared[c[0]] = true; }
          if (c[2] && qtyIn > 0) sku.batches.push({ id: "B_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7), date: c[2], qty_in: qtyIn, qty_used: qtyUsed, sisa });
          count++;
        }
        showToast(`Import Successful: Loaded ${count} batch records.`, "success");
        return { ...prev, skus, categories: cats };
      });
    };
    reader.readAsText(file);
  };

  // --- CSV export ---------------------------------------------------------
  const exportWeekly = () => {
    let csv = "SKU Name,Category,Week Num (1-5),Forecast Qty,Realization Qty\n";
    enriched.forEach((s) => WEEKS.forEach((i) => { csv += `"${s.name}","${s.cat}",${i + 1},${s.f_trend[i]},${s.r_trend[i]}\n`; }));
    downloadCSV(csv, "Export_Weekly_Data.csv");
  };
  const exportStock = () => {
    let csv = "SKU Name,Category,Avg Daily Demand,Existing Stock,Incoming PO,Safety Stock\n";
    enriched.forEach((s) => { csv += `"${s.name}","${s.cat}",${s.daily_demand},${s.stock},${s.po},${s.safety}\n`; });
    downloadCSV(csv, "Export_Stock_Health.csv");
  };
  const exportAging = () => {
    let csv = "SKU Name,Category,Incoming Date,Incoming Qty,Used Qty,Sisa,Stock Type,Storage Target\n";
    enriched.forEach((s) => {
      if (s.batches.length) s.batches.forEach((b) => { csv += `"${s.name}","${s.cat}","${b.date}",${b.qty_in},${b.qty_used},${b.sisa},"${s.tipe_stock || "Reguler"}",${s.target_simpan || 30}\n`; });
      else csv += `"${s.name}","${s.cat}","",0,0,0,"${s.tipe_stock || "Reguler"}",${s.target_simpan || 30}\n`;
    });
    downloadCSV(csv, "Export_Aging_FIFO.csv");
  };

  // hidden file inputs
  const weeklyFileRef = useRef<HTMLInputElement>(null);
  const stockFileRef = useRef<HTMLInputElement>(null);
  const agingFileRef = useRef<HTMLInputElement>(null);

  // ======================================================================
  // Small render helpers
  // ======================================================================
  const pctBadge = (tR: number, tF: number) => {
    const pct = tF > 0 ? ((tR / tF) * 100).toFixed(1) : "0";
    const cls = Number(pct) < 80 ? "danger" : Number(pct) < 95 ? "warning" : "";
    return (
      <div className={`percentage-badge ${cls}`}>
        <i className={`ph-bold ph-trend-${Number(pct) >= 100 ? "up" : "down"}`} /> {pct}%
      </div>
    );
  };

  const WeeklyGrid = ({ f, r }: { f: number[]; r: number[] }) => (
    <div className="weekly-grid">
      {WEEKS.map((i) => {
        const gap = r[i] - f[i];
        const gapPct = f[i] > 0 ? ((gap / f[i]) * 100).toFixed(1) : "0";
        return (
          <div className="weekly-col" key={i}>
            <div className="weekly-title">W{i + 1}</div>
            <div className="weekly-row"><span>F</span><span>{nf(f[i])}</span></div>
            <div className="weekly-row"><span>R</span><span>{nf(r[i])}</span></div>
            <div className={`weekly-gap ${gap >= 0 ? "bg-positive" : "bg-negative"}`}>{gap > 0 ? "+" : ""}{gapPct}%</div>
          </div>
        );
      })}
    </div>
  );

  const FilterDropdown = ({ id, options, current, onPick }: { id: string; options: { label: string; value: string }[]; current: string; onPick: (v: string) => void }) => (
    <div className={`filter-dropdown ${openFilter === id ? "show" : ""}`}>
      {options.map((o) => (
        <div key={o.value} className="filter-option" onClick={(e) => { e.stopPropagation(); onPick(o.value); setOpenFilter(null); }}>{o.label}</div>
      ))}
    </div>
  );

  const catFilterOptions = useMemo(
    () => [{ label: t("all_categories"), value: "ALL" }, ...categoryNames.map((c) => ({ label: c, value: c }))],
    [categoryNames, t]
  );

  // ---- Pagination (applies to every data page, not the dashboard) ----
  const [ROWS_PER_PAGE, setRowsPerPage] = useState(12);
  useEffect(() => {
    const calc = () => {
      // Estimasi: tinggi viewport dikurangi header/filter/pagination (~300px), dibagi tinggi baris (~44px)
      const rows = Math.max(5, Math.floor((window.innerHeight - 300) / 44));
      setRowsPerPage(rows);
    };
    calc();
    window.addEventListener("resize", calc);
    return () => window.removeEventListener("resize", calc);
  }, []);
  const [weeklyPage, setWeeklyPage] = useState(1);
  const [healthPage, setHealthPage] = useState(1);
  const [agingPage, setAgingPage] = useState(1);

  const weeklyItems = useMemo(() => {
    const term = weeklySearch.toLowerCase();
    const items: { sku: EnrichedSku; w: number }[] = [];
    enriched.forEach((sku) => {
      if ((weeklyCat !== "ALL" && sku.cat !== weeklyCat) || (!sku.name.toLowerCase().includes(term) && !sku.cat.toLowerCase().includes(term))) return;
      WEEKS.forEach((w) => {
        if (sku.f_trend[w] === 0 && sku.r_trend[w] === 0) return;
        items.push({ sku, w });
      });
    });
    return items;
  }, [enriched, weeklySearch, weeklyCat]);

  const healthItems = useMemo(
    () => enriched.filter((s) => (healthCat === "ALL" || s.cat === healthCat) && (healthStatus === "ALL" || s.status === healthStatus)),
    [enriched, healthCat, healthStatus]
  );

  const agingItems = useMemo(() => {
    const term = agingSearch.toLowerCase();
    return enriched.filter(
      (s) => !((agingCat !== "ALL" && s.cat !== agingCat) || (agingStatus !== "ALL" && s.status_aging !== agingStatus) || (!s.name.toLowerCase().includes(term) && !s.cat.toLowerCase().includes(term)))
    );
  }, [enriched, agingSearch, agingCat, agingStatus]);

  // Reset to the first page whenever a filter/search narrows the list
  useEffect(() => setWeeklyPage(1), [weeklySearch, weeklyCat]);
  useEffect(() => setHealthPage(1), [healthCat, healthStatus]);
  useEffect(() => setAgingPage(1), [agingSearch, agingCat, agingStatus]);

  const DateBadge = () => (
    <div className="date-badge" style={{ padding: "6px 14px" }}>
      <i className="ph-fill ph-calendar-blank" style={{ color: "var(--brand-primary)", fontSize: "1.1rem" }} />
      <input type="date" className="header-date-picker" value={globalDate} onChange={(e) => setGlobalDate(e.target.value)} />
    </div>
  );

  // Clamp each page to its valid range and slice the visible rows
  const weeklyTotalPages = Math.max(1, Math.ceil(weeklyItems.length / ROWS_PER_PAGE));
  const weeklyPageSafe = Math.min(weeklyPage, weeklyTotalPages);
  const weeklyStart = (weeklyPageSafe - 1) * ROWS_PER_PAGE;
  const weeklyPaged = weeklyItems.slice(weeklyStart, weeklyStart + ROWS_PER_PAGE);

  const healthTotalPages = Math.max(1, Math.ceil(healthItems.length / ROWS_PER_PAGE));
  const healthPageSafe = Math.min(healthPage, healthTotalPages);
  const healthStart = (healthPageSafe - 1) * ROWS_PER_PAGE;
  const healthPaged = healthItems.slice(healthStart, healthStart + ROWS_PER_PAGE);

  const agingTotalPages = Math.max(1, Math.ceil(agingItems.length / ROWS_PER_PAGE));
  const agingPageSafe = Math.min(agingPage, agingTotalPages);
  const agingStart = (agingPageSafe - 1) * ROWS_PER_PAGE;
  const agingPaged = agingItems.slice(agingStart, agingStart + ROWS_PER_PAGE);

  // ======================================================================
  // Render
  // ======================================================================
  return (
    <>
      {/* Live wallpaper — subtle network behind the dashboard content */}
      {session && <LiveWallpaper variant="subtle" />}

      {/* Toasts */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast-msg ${toast.type}`}>
            <i className={`ph-fill ph-${toast.type === "success" ? "check-circle" : toast.type === "error" ? "x-circle" : "warning"}`} />
            {toast.msg}
          </div>
        ))}
      </div>

      {/* Confirm modal */}
      <div className={`modal-overlay ${confirmState.open ? "show" : ""}`}>
        <div className="modal-content" style={{ maxWidth: 400, textAlign: "center" }}>
          <div className="modal-header" style={{ justifyContent: "center", borderBottom: "none", marginBottom: 8 }}>
            <div className="modal-title" style={{ fontSize: "1.25rem" }}>{confirmState.title}</div>
          </div>
          <p style={{ color: "var(--text-muted)", marginBottom: 24, fontWeight: "var(--fw-medium)", fontSize: "0.95rem" }}>{confirmState.message}</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", width: "100%" }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => closeConfirm(false)}>{t("cancel")}</button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => closeConfirm(true)}>{t("proceed")}</button>
          </div>
        </div>
      </div>

      {/* Login overlay */}
      {!session && (
        <div className="login-overlay">
          <LiveWallpaper variant="hero" />
          <div className="login-box">
            {loginView === "login" ? (
              <>
                <i className="ph-fill ph-compass" style={{ fontSize: "3rem", color: "var(--brand-primary)", marginBottom: 16 }} />
                <h2>{t("login_title")}</h2>
                <p>{t("login_desc")}</p>
                <form onSubmit={handleLogin}>
                  <input name="username" type="text" className="login-input" placeholder={t("username_or_email_label")} required />
                  <input name="password" type="password" className="login-input" placeholder={t("password_label")} required />
                  {loginError && <p style={{ color: "var(--brand-red)", marginBottom: 12, fontSize: "0.85rem" }}>{loginError}</p>}
                  <button type="submit" className="login-btn" disabled={loggingIn}>{loggingIn ? "…" : t("secure_login")}</button>
                </form>
                <button type="button" className="login-link" onClick={() => setLoginView("forgot")}>{t("forgot_password")}</button>
              </>
            ) : (
              <>
                <i className="ph-fill ph-envelope-simple" style={{ fontSize: "3rem", color: "var(--brand-primary)", marginBottom: 16 }} />
                <h2>{t("forgot_title")}</h2>
                <p>{t("forgot_desc")}</p>
                {forgotSent ? (
                  <div>
                    <p style={{ color: "var(--brand-green)", fontSize: "0.85rem", marginBottom: 16 }}>
                      <i className="ph-fill ph-check-circle" /> {t("reset_sent")}
                    </p>
                    {devResetUrl && (
                      <p style={{ fontSize: "0.75rem", marginBottom: 16, wordBreak: "break-all" }}>
                        <span style={{ color: "var(--text-muted)" }}>Demo mode (SMTP not configured): </span>
                        <a href={devResetUrl} style={{ color: "var(--brand-primary)" }}>Open reset link</a>
                      </p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword}>
                    <input name="forgot_email" type="email" className="login-input" placeholder={t("email_label")} required autoFocus />
                    {forgotError && <p style={{ color: "var(--brand-red)", marginBottom: 12, fontSize: "0.85rem" }}>{forgotError}</p>}
                    <button type="submit" className="login-btn" disabled={forgotSending}>{forgotSending ? "…" : t("send_reset_link")}</button>
                  </form>
                )}
                <button type="button" className="login-link" onClick={backToLogin}><i className="ph ph-arrow-left" /> {t("back_to_login")}</button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Sidebar */}
      <div className="sidebar">
        <div className="brand"><i className="ph-fill ph-compass" /> <span className="side-label">Supply Chain Dashboard</span></div>
        <div className="nav-section-label">{t("menu_label")}</div>
        <div className={`nav-item ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}><i className="ph ph-chart-line" /> <span>{t("nav_dashboard")}</span></div>
        <div className={`nav-item ${tab === "weekly" ? "active" : ""}`} onClick={() => setTab("weekly")}><i className="ph ph-calendar" /> <span>{t("nav_weekly")}</span></div>
        <div className={`nav-item ${tab === "health" ? "active" : ""}`} onClick={() => setTab("health")}><i className="ph ph-shield-check" /> <span>{t("nav_health")}</span></div>
        <div className={`nav-item ${tab === "aging" ? "active" : ""}`} onClick={() => setTab("aging")}><i className="ph ph-hourglass" /> <span>{t("nav_aging")}</span></div>
        <div className="nav-section-label">{t("general_label")}</div>
        <div className={`nav-item ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}><i className="ph ph-gear-six" /> <span>{t("nav_settings")}</span></div>
        {isAdmin && <div className={`nav-item ${tab === "accounts" ? "active" : ""}`} onClick={() => setTab("accounts")}><i className="ph ph-users-three" /> <span>{t("nav_accounts")}</span></div>}

        <div className="sidebar-footer">
          <div className="user-info-box">
            <i className="ph-fill ph-user-circle" />
            <div className="user-info-text">
              <span className="user-info-name">{session?.username || "Guest"}</span>
              <span className="user-info-role">{session ? (isAdmin ? t("role_admin") : t("role_user")) : "Not Logged In"}</span>
            </div>
          </div>
          {session && <button className="logout-btn" onClick={handleLogout}><i className="ph ph-sign-out" /> <span className="side-label">{t("logout")}</span></button>}
        </div>
      </div>

      {/* Main */}
      <div className="main-wrapper">
        <input ref={weeklyFileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) importWeekly(e.target.files[0]); e.target.value = ""; }} />
        <input ref={stockFileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) importStock(e.target.files[0]); e.target.value = ""; }} />
        <input ref={agingFileRef} type="file" accept=".csv" style={{ display: "none" }} onChange={(e) => { if (e.target.files?.[0]) importAging(e.target.files[0]); e.target.value = ""; }} />

        {/* ================= DASHBOARD ================= */}
        <div className={`tab-content ${tab === "dashboard" ? "active" : ""}`}>
          <div className="header">
            <div><h1>{t("dash_title")}</h1><p>{t("dash_desc")}</p></div>
            <DateBadge />
          </div>

          <div className="kpi-wrapper">
            <div className="kpi-card"><div className="kpi-label">{t("total_forecast")}</div><div className="kpi-value">{nf(kpis.totalForecast)}</div></div>
            <div className="kpi-card"><div className="kpi-label">{t("total_realization")}</div><div className="kpi-value">{nf(kpis.totalRealization)}</div></div>
            <div className="kpi-card">
              <div className="kpi-label">{t("accuracy")}</div><div className="kpi-value">{kpis.accuracyPct}%</div>
              <div className="kpi-sub" style={{ color: "var(--brand-green)" }}><i className="ph-bold ph-check-circle" /> {t("based_actual")}</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">{t("sku_attention")}</div><div className="kpi-value" style={{ color: "var(--brand-red)" }}>{kpis.alertCount}</div>
              <div className="kpi-sub" style={{ color: "var(--brand-red)" }}><i className="ph-bold ph-warning-circle" /> {t("risk_stockout")}</div>
            </div>
          </div>

          <div className="analysis-grid">
            {/* Category */}
            <div className="analysis-card">
              <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, border: "none" }}>
                <div className="analysis-title"><i className="ph-fill ph-stack" style={{ color: "var(--brand-orange)" }} /> <span>{t("cat_analysis")}</span></div>
                <select className="modern-select" value={catValue} onChange={(e) => { setCatValue(e.target.value); setSkuValue("ALL"); }}>
                  <option value="ALL">{t("all_categories")} (GLOBAL)</option>
                  {categoryNames.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="highlight-row">
                <div className="dyn-val-group"><span className="dyn-label">{t("real_vs_fct")}</span><span className="dyn-val">{nf(sum(catTrends.r))} / {nf(sum(catTrends.f))}</span></div>
                {pctBadge(sum(catTrends.r), sum(catTrends.f))}
              </div>
              <WeeklyGrid f={catTrends.f} r={catTrends.r} />
              <div className="chart-wrapper"><ComboChart labels={["W1","W2","W3","W4","W5"]} forecast={catTrends.f} realization={catTrends.r} lineColor={themeObj.secondary} theme={themeObj} /></div>
            </div>

            {/* Breakdown by SKU */}
            <div className="analysis-card">
              <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, border: "none" }}>
                <div className="analysis-title"><i className="ph-fill ph-chart-line" style={{ color: "var(--brand-primary)" }} /> <span>{t("realization_breakdown")}</span></div>
              </div>
              <div className="highlight-row" style={{ marginTop: 8 }}>
                <div className="dyn-val-group"><span className="dyn-label">{t("real_vs_fct")}</span><span className="dyn-val">{nf(sum(breakdown.realization))} / {nf(sum(breakdown.forecast))}</span></div>
                {pctBadge(sum(breakdown.realization), sum(breakdown.forecast))}
              </div>
              <div className="chart-wrapper-scroll" style={{ marginTop: 12, marginBottom: 4 }}>
                <div className="dynamic-chart-wrapper" style={{ minWidth: breakdown.labels.length > 5 ? breakdown.labels.length * 90 : undefined }}>
                  <ComboChart labels={breakdown.labels} forecast={breakdown.forecast} realization={breakdown.realization} lineColor={themeObj.primary} theme={themeObj} hideZeroLabels />
                </div>
              </div>
            </div>

            {/* Specific SKU */}
            <div className="card analysis-card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ marginBottom: 0, paddingBottom: 0, border: "none" }}>
                <div className="analysis-title"><i className="ph-fill ph-tag" style={{ color: "var(--brand-primary)" }} /> <span>{t("sku_specific")}</span></div>
                <select className="modern-select" value={skuValue} onChange={(e) => setSkuValue(e.target.value)}>
                  <option value="ALL">{t("all_status").replace("Status", "SKUs")}</option>
                  {skusInScope.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div className="highlight-row" style={{ marginTop: 16 }}>
                <div className="dyn-val-group"><span className="dyn-label">{t("real_vs_fct")}</span><span className="dyn-val">{nf(sum(skuTrends.r))} / {nf(sum(skuTrends.f))}</span></div>
                {pctBadge(sum(skuTrends.r), sum(skuTrends.f))}
              </div>
              <WeeklyGrid f={skuTrends.f} r={skuTrends.r} />
              <div className="chart-wrapper"><ComboChart labels={["W1","W2","W3","W4","W5"]} forecast={skuTrends.f} realization={skuTrends.r} lineColor={themeObj.orange} theme={themeObj} /></div>
            </div>
          </div>

          <div className="card-header" style={{ marginTop: 32, marginBottom: 16, borderBottom: "2px solid var(--border-color)", paddingBottom: 8 }}>
            <span style={{ fontSize: "1.1rem", fontWeight: "var(--fw-strong)", display: "flex", alignItems: "center", gap: 8, color: "var(--brand-primary)" }}><i className="ph-bold ph-chart-bar" /> <span>{t("aging_analytics")}</span></span>
          </div>
          <div className="extra-charts-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
            <div className="card">
              <div className="card-header" style={{ marginBottom: 12, fontSize: "1rem" }}><i className="ph-fill ph-clock" /> <span>{t("cat_aging_dist")}</span></div>
              <div style={{ height: 250, position: "relative" }}><SimpleBarChart labels={["0-30 hari","31-60 hari","61-90 hari","91+ hari"]} data={agingBuckets} colors={themeObj.aging} theme={themeObj} /></div>
            </div>
            <div className="card">
              <div className="card-header" style={{ marginBottom: 12, fontSize: "1rem" }}><i className="ph-fill ph-shield" /> <span>{t("stock_vs_safety")}</span></div>
              <div style={{ height: 250, position: "relative" }}>
                <GroupedBarChart labels={enriched.map((s) => formatSkuChartLabel(s.name))} series={[{ label: "Sisa Stock", data: enriched.map((s) => s.stock), color: themeObj.secondary }, { label: "Safety Stock", data: enriched.map((s) => s.safety), color: hexToRgba(themeObj.red, 0.65) }]} theme={themeObj} />
              </div>
            </div>
            <div className="card">
              <div className="card-header" style={{ marginBottom: 12, fontSize: "1rem" }}><i className="ph-fill ph-tag-chevron" /> <span>{t("stock_type_comp")}</span></div>
              <div style={{ height: 250, position: "relative" }}><DoughnutChart labels={tipeComposition.labels} data={tipeComposition.data} colors={themeObj.palette.slice(0, tipeComposition.labels.length)} theme={themeObj} /></div>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-panel danger">
              <div className="card-header" style={{ marginBottom: 12, paddingBottom: 12 }}><span style={{ color: "var(--brand-red)", fontWeight: "var(--fw-strong)" }}><i className="ph-fill ph-warning-octagon" /> <span>{t("top_shortage")}</span></span></div>
              <ul className="summary-list">
                {summary.shortage.length ? summary.shortage.map((s) => (
                  <li className="summary-item" key={s.name}>
                    <div><div className="summary-item-name">{s.name}</div><div className="summary-item-desc">{t("deficit_msg")} {nf(Math.abs(s.severityScore))} {t("pcs_from_safety")}</div></div>
                    <div className="summary-item-val" style={{ color: "var(--brand-red)" }}>{s.coverage} {t("days_cov")}</div>
                  </li>
                )) : <li className="summary-item"><div className="summary-item-desc">{t("no_critical")}</div></li>}
              </ul>
            </div>
            <div className="summary-panel warning">
              <div className="card-header" style={{ marginBottom: 12, paddingBottom: 12 }}><span style={{ color: "var(--brand-orange)", fontWeight: "var(--fw-strong)" }}><i className="ph-fill ph-archive-box" /> <span>{t("top_overstock")}</span></span></div>
              <ul className="summary-list">
                {summary.overstock.length ? summary.overstock.map((s) => (
                  <li className="summary-item" key={s.name}>
                    <div><div className="summary-item-name">{s.name}</div><div className="summary-item-desc">{t("aging_cat_txt")} {s.kategori_aging} ({t("target_txt")} {s.target_simpan} {t("days")})</div></div>
                    <div className="summary-item-val" style={{ color: "var(--brand-orange)" }}>+{s.selisih_target} {t("days")}</div>
                  </li>
                )) : <li className="summary-item"><div className="summary-item-desc">{t("no_overstock")}</div></li>}
              </ul>
            </div>
          </div>
        </div>

        {/* ================= WEEKLY ================= */}
        <div className={`tab-content ${tab === "weekly" ? "active" : ""}`}>
          <div className="header"><div><h1>{t("weekly_data_title")}</h1><p>{t("weekly_data_desc")}</p></div><DateBadge /></div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "20px 24px", marginBottom: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="ph-fill ph-database" /> <span>{t("weekly_sku_db")}</span></span>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="search-box"><i className="ph ph-magnifying-glass" /><input type="text" placeholder="Search SKU..." value={weeklySearch} onChange={(e) => setWeeklySearch(e.target.value)} /></div>
                <button className="btn btn-outline" onClick={() => downloadCSV('SKU Name,Category,Week Num (1-5),Forecast Qty,Realization Qty\n"SAFF & Co. Extrait de Parfum - Sample","FULLSIZE",1,100,90\n', "Template_Weekly_Data.csv")}><i className="ph ph-file-csv" /> <span>{t("btn_template")}</span></button>
                <button className="btn btn-outline" onClick={() => weeklyFileRef.current?.click()}><i className="ph ph-upload-simple" /> <span>{t("btn_import")}</span></button>
                <button className="btn btn-primary" onClick={exportWeekly}><i className="ph ph-download-simple" /> <span>{t("btn_export")}</span></button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="modern-data-table">
                <thead><tr>
                  <th>{t("tbl_no")}</th><th>{t("tbl_sku")}</th>
                  <th className="filter-header" onClick={(e) => toggleFilter("weeklyCat", e)}><span>{t("tbl_category")}</span> <i className="ph-bold ph-caret-down" /><FilterDropdown id="weeklyCat" current={weeklyCat} onPick={setWeeklyCat} options={catFilterOptions} /></th>
                  <th>{t("tbl_week")}</th><th>{t("tbl_forecast_qty")}</th><th>{t("tbl_realization_qty")}</th><th>{t("tbl_action")}</th>
                </tr></thead>
                <tbody>
                  {weeklyPaged.map(({ sku, w }, i) => (
                    <tr key={sku.name + w}>
                      <td>{weeklyStart + i + 1}</td>
                      <td style={{ fontWeight: "var(--fw-bold)" }}><button className="clickable-sku" onClick={() => setSkuView(sku)}>{sku.name}</button></td>
                      <td><span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{sku.cat}</span></td>
                      <td><span className="week-badge">W{w + 1}</span></td>
                      <td className="qty-cell">{nf(sku.f_trend[w])}</td>
                      <td className="qty-cell" style={{ color: "var(--brand-primary)" }}>{nf(sku.r_trend[w])}</td>
                      <td><button className="btn-icon danger" onClick={() => deleteWeekly(sku.name, w)} title="Clear Weekly Data"><i className="ph ph-trash" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePager page={weeklyPageSafe} totalPages={weeklyTotalPages} total={weeklyItems.length} start={weeklyStart} count={weeklyPaged.length} onPage={setWeeklyPage} />
          </div>
        </div>

        {/* ================= HEALTH ================= */}
        <div className={`tab-content ${tab === "health" ? "active" : ""}`}>
          <div className="header"><div><h1>{t("health_title")}</h1><p>{t("health_desc")}</p></div><DateBadge /></div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: 20, marginBottom: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="ph-fill ph-database" /> <span>{t("inv_param_details")}</span></span>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button className="btn btn-outline" onClick={() => downloadCSV('SKU Name,Category,Avg Daily Demand,Existing Stock,Incoming PO,Safety Stock,Aging (Days)\n"SAFF & Co. Extrait de Parfum - Sample","FULLSIZE",50.5,500,100,200,15\n', "Template_Stock_Health.csv")}><i className="ph ph-file-csv" /> <span>{t("btn_template")}</span></button>
                <button className="btn btn-outline" onClick={() => stockFileRef.current?.click()}><i className="ph ph-upload-simple" /> <span>{t("btn_import")}</span></button>
                <button className="btn btn-primary" onClick={exportStock}><i className="ph ph-download-simple" /> <span>{t("btn_export")}</span></button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="modern-data-table" style={{ marginBottom: 0, minWidth: 900 }}>
                <thead><tr>
                  <th>{t("tbl_no")}</th>
                  <th>{t("tbl_list_sku")}</th>
                  <th className="filter-header" onClick={(e) => toggleFilter("healthCat", e)}><span>{t("tbl_category")}</span> <i className="ph-bold ph-caret-down" /><FilterDropdown id="healthCat" current={healthCat} onPick={setHealthCat} options={catFilterOptions} /></th>
                  <th>{t("tbl_exist_stock")}</th><th>{t("tbl_inc_po")}</th><th>{t("tbl_safety_stock")}</th><th>{t("tbl_coverage")}</th>
                  <th className="filter-header" onClick={(e) => toggleFilter("healthStatus", e)}><span>{t("tbl_stock_status")}</span> <i className="ph-bold ph-caret-down" /><FilterDropdown id="healthStatus" current={healthStatus} onPick={setHealthStatus} options={[{ label: t("all_status"), value: "ALL" }, { label: "Optimal", value: "Optimal" }, { label: "Shortage", value: "Shortage" }, { label: "Excess", value: "Excess" }]} /></th>
                  <th style={{ minWidth: 90 }}>{t("tbl_action")}</th>
                </tr></thead>
                <tbody>
                  {healthPaged.map((s, i) => {
                    const pill = s.status === "Shortage" ? "pill-kurang" : s.status === "Excess" ? "pill-over" : "pill-cukup";
                    return (
                      <tr key={s.name}>
                        <td>{healthStart + i + 1}</td>
                        <td style={{ fontWeight: "var(--fw-bold)" }}><button className="clickable-sku" onClick={() => setSkuView(s)}>{s.name}</button></td>
                        <td style={{ color: "var(--text-muted)" }}>{s.cat}</td>
                        <td>{nf(s.stock)}</td><td>{nf(s.po)}</td><td>{nf(s.safety)}</td><td>{s.coverage} {t("days")}</td>
                        <td><span className={`status-pill ${pill}`}>{s.status}</span></td>
                        <td><button className="btn-icon danger" onClick={() => deleteSku(s.name)} title="Delete SKU"><i className="ph ph-trash" /></button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePager page={healthPageSafe} totalPages={healthTotalPages} total={healthItems.length} start={healthStart} count={healthPaged.length} onPage={setHealthPage} />
          </div>
        </div>

        {/* ================= AGING ================= */}
        <div className={`tab-content ${tab === "aging" ? "active" : ""}`}>
          <div className="header"><div><h1>{t("aging_title")}</h1><p>{t("aging_desc")}</p></div><DateBadge /></div>
          <div className="kpi-wrapper">
            <div className="kpi-card"><div className="kpi-label">{t("avg_aging")}</div><div className="kpi-value">{kpis.avgAgingDays}</div></div>
            <div className="kpi-card"><div className="kpi-label">{t("sku_exceed_target")}</div><div className="kpi-value" style={{ color: "var(--brand-red)" }}>{kpis.skusPastTarget}</div></div>
            <div className="kpi-card"><div className="kpi-label">{t("tot_act_batches")}</div><div className="kpi-value">{kpis.totalActiveBatches}</div><div className="kpi-sub" style={{ color: "var(--brand-primary)" }}><i className="ph-bold ph-stack" /> {t("batch_rem_stock")}</div></div>
          </div>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="card-header" style={{ padding: "20px 24px", marginBottom: 0 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="ph-fill ph-clock-counter-clockwise" /> <span>{t("sku_aging_mon")}</span></span>
              <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                <div className="search-box"><i className="ph ph-magnifying-glass" /><input type="text" placeholder="Search SKU..." value={agingSearch} onChange={(e) => setAgingSearch(e.target.value)} /></div>
                <button className="btn btn-outline" onClick={() => downloadCSV('SKU Name,Category,Incoming Date,Incoming Qty,Used Qty,Sisa,Stock Type,Storage Target\n"SAFF & Co. Extrait de Parfum - Sample","FULLSIZE","2026-04-27",260,200,60,"Reguler",30\n', "Template_Aging_FIFO.csv")}><i className="ph ph-file-csv" /> <span>{t("btn_template")}</span></button>
                <button className="btn btn-outline" onClick={() => agingFileRef.current?.click()}><i className="ph ph-upload-simple" /> <span>{t("btn_import")}</span></button>
                <button className="btn btn-primary" onClick={exportAging}><i className="ph ph-download-simple" /> <span>{t("btn_export")}</span></button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="modern-data-table">
                <thead><tr>
                  <th>{t("tbl_no")}</th><th>{t("tbl_sku")}</th>
                  <th className="filter-header" onClick={(e) => toggleFilter("agingCat", e)}><span>{t("tbl_category")}</span> <i className="ph-bold ph-caret-down" /><FilterDropdown id="agingCat" current={agingCat} onPick={setAgingCat} options={catFilterOptions} /></th>
                  <th>{t("tbl_stock_type")}</th><th>{t("tbl_tot_rem_stock")}</th><th>{t("tbl_oldest_batch")}</th><th>{t("tbl_aging_days")}</th><th>{t("tbl_aging_cat")}</th><th>{t("tbl_storage_target")}</th>
                  <th className="filter-header" onClick={(e) => toggleFilter("agingStatus", e)}><span>{t("tbl_stat_vs_target")}</span> <i className="ph-bold ph-caret-down" /><FilterDropdown id="agingStatus" current={agingStatus} onPick={setAgingStatus} options={[{ label: t("all_status"), value: "ALL" }, { label: t("sehat"), value: "Sehat" }, { label: t("waspada"), value: "Waspada" }, { label: t("kritis"), value: "Kritis" }]} /></th>
                  <th>{t("tbl_variance")}</th><th>{t("tbl_action")}</th>
                </tr></thead>
                <tbody>
                  {agingPaged.map((s, i) => {
                    const dateStr = s.oldest_batch_date ? new Date(s.oldest_batch_date).toLocaleDateString("en-GB") : "-";
                    const sign = s.selisih_target > 0 ? "+" : "";
                    return (
                      <tr key={s.name}>
                        <td>{agingStart + i + 1}</td>
                        <td style={{ fontWeight: "var(--fw-bold)" }}><button className="clickable-sku" onClick={() => setSkuView(s)}>{s.name}</button></td>
                        <td><span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{s.cat}</span></td>
                        <td><span style={{ color: "var(--text-muted)", fontSize: "0.85rem" }}>{s.tipe_stock || "Reguler"}</span></td>
                        <td className="qty-cell">{nf(s.stock)}</td>
                        <td>{dateStr}</td>
                        <td style={{ fontWeight: "var(--fw-strong)" }}>{s.aging}</td>
                        <td><span className="week-badge">{s.kategori_aging}</span></td>
                        <td>{s.target_simpan}</td>
                        <td><span className={`status-pill ${s.aging_class}`}>{t(s.status_aging.toLowerCase() as keyof Dict)}</span></td>
                        <td style={{ color: s.selisih_target > 0 ? "var(--brand-red)" : "var(--brand-green)", fontWeight: "var(--fw-bold)" }}>{sign}{s.selisih_target}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn-outline" style={{ padding: "6px 12px", fontSize: "0.75rem", borderRadius: 8 }} onClick={() => setBatchSku(s.name)}><i className="ph ph-list-dashes" /> {t("view_batches")}</button>{" "}
                          <button className="btn-icon danger" onClick={() => deleteSku(s.name)} title="Delete SKU"><i className="ph ph-trash" /></button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <TablePager page={agingPageSafe} totalPages={agingTotalPages} total={agingItems.length} start={agingStart} count={agingPaged.length} onPage={setAgingPage} />
          </div>
        </div>

        {/* ================= SETTINGS ================= */}
        <div className={`tab-content ${tab === "settings" ? "active" : ""}`}>
          <div className="header"><div><h1>{t("settings_title")}</h1><p>{t("settings_desc")}</p></div></div>
          <div className="settings-stack">
            {/* Appearance */}
            <div className="card">
              <div className="setting-head"><h2><i className="ph-fill ph-palette" /> {t("appearance")}</h2><p>{t("appearance_desc")}</p></div>
              <div className="settings-divider" />
              <label className="field-label">{t("color_theme")}</label>
              <div className="theme-options">
                {THEME_OPTIONS.map((o) => (
                  <button key={o.value} type="button" className={`theme-option ${theme === o.value ? "active" : ""}`} onClick={() => setTheme(o.value)}>
                    <span className="theme-swatch" style={{ background: o.swatch }} />
                    <span className="theme-option-text"><span className="theme-option-name">{t(o.labelKey)}</span></span>
                    <i className="ph-bold ph-check-circle theme-option-check" />
                  </button>
                ))}
              </div>
              <div style={{ marginTop: 22 }}>
                <label className="field-label">{t("ui_lang")}</label>
                <div className="segmented">
                  <button type="button" className={`seg-btn ${lang === "en" ? "active" : ""}`} onClick={() => setLang("en")}>English</button>
                  <button type="button" className={`seg-btn ${lang === "id" ? "active" : ""}`} onClick={() => setLang("id")}>Bahasa Indonesia</button>
                </div>
              </div>
            </div>

            {/* Security */}
            <div className="card">
              <div className="setting-head"><h2><i className="ph-fill ph-lock-key" /> {t("security")}</h2><p>{t("security_desc")}</p></div>
              <div className="settings-divider" />
              <form onSubmit={handleChangePassword}>
                <div className="form-grid">
                  <div className="form-group full"><label className="form-label">{t("current_password")}</label><input name="current" type="password" className="form-input" required autoComplete="current-password" /></div>
                  <div className="form-group"><label className="form-label">{t("new_password")}</label><input name="next" type="password" className="form-input" required autoComplete="new-password" /></div>
                  <div className="form-group"><label className="form-label">{t("confirm_password")}</label><input name="confirm" type="password" className="form-input" required autoComplete="new-password" /></div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" disabled={changingPw}><i className="ph ph-check" /> {t("update_password")}</button>
                </div>
              </form>
            </div>

          </div>
        </div>

        {/* ================= ACCOUNTS ================= */}
        {isAdmin && (
          <div className={`tab-content ${tab === "accounts" ? "active" : ""}`}>
            <div className="header"><div><h1>{t("nav_accounts")}</h1><p>{t("user_management")}</p></div><DateBadge /></div>
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div className="card-header" style={{ padding: "20px 24px", marginBottom: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="ph-fill ph-users-three" /> <span>{t("user_management")}</span></span>
                <button className="btn btn-primary" onClick={() => setUserModalOpen(true)}><i className="ph ph-user-plus" /> <span>{t("create_new_user")}</span></button>
              </div>
              <div className="table-responsive">
                <table className="modern-data-table">
                  <thead><tr><th style={{ width: 50 }}>ID</th><th>Username</th><th>{t("email_label")}</th><th>Role</th><th>Status</th><th style={{ width: 100 }}>{t("tbl_action")}</th></tr></thead>
                  <tbody>
                    {data?.users.map((u) => (
                      <tr key={u.id}>
                        <td style={{ fontWeight: "var(--fw-bold)" }}>#{u.id}</td>
                        <td style={{ fontWeight: "var(--fw-bold)", color: "var(--brand-primary)" }}>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.role}</td>
                        <td><span className="status-pill pill-cukup">{u.status}</span></td>
                        <td>
                          {u.username === session?.username
                            ? <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>—</span>
                            : <div style={{ display: "flex", gap: 4 }}>
                                <button className="btn-icon" onClick={() => setEditUserData(u)} title="Edit Account"><i className="ph ph-pencil" /></button>
                                <button className="btn-icon danger" onClick={() => deleteUser(u.id, u.username)} title="Delete Account"><i className="ph ph-trash" /></button>
                              </div>
                          }
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ================= MODALS ================= */}
      {userModalOpen && (
        <div className="modal-overlay show">
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title">{t("create_new_user")}</div><button className="close-btn" onClick={() => setUserModalOpen(false)}><i className="ph ph-x" /></button></div>
            <form onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const ok = await addUser({ username: (f.elements.namedItem("u_username") as HTMLInputElement).value, email: (f.elements.namedItem("u_email") as HTMLInputElement).value, role: (f.elements.namedItem("u_role") as HTMLSelectElement).value as "Admin" | "User", password: (f.elements.namedItem("u_password") as HTMLInputElement).value }); if (ok) setUserModalOpen(false); }}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div className="form-group"><label className="form-label">Username</label><input name="u_username" className="form-input" required placeholder="Enter desired username" /></div>
                <div className="form-group"><label className="form-label">{t("email_label")}</label><input name="u_email" type="email" className="form-input" required placeholder="user@company.com" /></div>
                <div className="form-group"><label className="form-label">{t("temp_pass")}</label><input name="u_password" type="password" className="form-input" required minLength={6} placeholder="Assign a default password" /></div>
                <div className="form-group"><label className="form-label">{t("access_role")}</label><select name="u_role" className="form-input" defaultValue="User"><option value="User">{t("role_user")}</option><option value="Admin">{t("role_admin")}</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setUserModalOpen(false)}>{t("cancel")}</button><button type="submit" className="btn btn-primary"><i className="ph ph-floppy-disk" /> <span>{t("save_account")}</span></button></div>
            </form>
          </div>
        </div>
      )}

      {editUserData && (
        <div className="modal-overlay show">
          <div className="modal-content">
            <div className="modal-header"><div className="modal-title">{t("edit_user")}</div><button className="close-btn" onClick={() => setEditUserData(null)}><i className="ph ph-x" /></button></div>
            <form onSubmit={async (e) => { e.preventDefault(); const f = e.currentTarget; const pwd = (f.elements.namedItem("e_password") as HTMLInputElement).value; const ok = await updateUser({ id: editUserData.id, username: (f.elements.namedItem("e_username") as HTMLInputElement).value, email: (f.elements.namedItem("e_email") as HTMLInputElement).value, role: (f.elements.namedItem("e_role") as HTMLSelectElement).value as "Admin" | "User", ...(pwd ? { password: pwd } : {}) }); if (ok) setEditUserData(null); }}>
              <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                <div className="form-group"><label className="form-label">Username</label><input name="e_username" className="form-input" required defaultValue={editUserData.username} placeholder="Enter username" /></div>
                <div className="form-group"><label className="form-label">{t("email_label")}</label><input name="e_email" type="email" className="form-input" required defaultValue={editUserData.email} placeholder="user@company.com" /></div>
                <div className="form-group"><label className="form-label">{t("optional_new_password")}</label><input name="e_password" type="password" className="form-input" minLength={6} placeholder={t("leave_blank_keep")} /></div>
                <div className="form-group"><label className="form-label">{t("access_role")}</label><select name="e_role" className="form-input" defaultValue={editUserData.role}><option value="User">{t("role_user")}</option><option value="Admin">{t("role_admin")}</option></select></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setEditUserData(null)}>{t("cancel")}</button><button type="submit" className="btn btn-primary"><i className="ph ph-floppy-disk" /> <span>{t("update_account")}</span></button></div>
            </form>
          </div>
        </div>
      )}

      {skuView && <SkuViewModal sku={skuView} onClose={() => setSkuView(null)} t={t} />}

      {batchSku && data && (
        <BatchModal
          skuName={batchSku}
          batches={enriched.find((s) => s.name === batchSku)?.batches || []}
          onClose={() => setBatchSku(null)}
          onAdd={(b) => addBatch(batchSku, b)}
          onDelete={(id) => deleteBatch(batchSku, id)}
          onInvalid={() => showToast("Used quantity cannot exceed incoming quantity.", "error")}
          onAdded={() => showToast("New batch added successfully!", "success")}
          t={t}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// SKU detail modal
// ---------------------------------------------------------------------------
function TablePager({ page, totalPages, total, start, count, onPage }: { page: number; totalPages: number; total: number; start: number; count: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  // Build a compact window of page numbers with ellipses for large sets
  const nums: (number | "…")[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) nums.push(i);
  } else {
    const left = Math.max(2, page - 1);
    const right = Math.min(totalPages - 1, page + 1);
    nums.push(1);
    if (left > 2) nums.push("…");
    for (let i = left; i <= right; i++) nums.push(i);
    if (right < totalPages - 1) nums.push("…");
    nums.push(totalPages);
  }
  return (
    <div className="table-pager">
      <span className="pager-info">{start + 1}–{start + count} / {total}</span>
      <div className="pager-controls">
        <button className="pager-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page"><i className="ph-bold ph-caret-left" /></button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="pager-ellipsis">…</span>
          ) : (
            <button key={n} className={`pager-btn ${n === page ? "active" : ""}`} onClick={() => onPage(n)}>{n}</button>
          )
        )}
        <button className="pager-btn" disabled={page >= totalPages} onClick={() => onPage(page + 1)} aria-label="Next page"><i className="ph-bold ph-caret-right" /></button>
      </div>
    </div>
  );
}

function Row({ label, value, valueColor }: { label: string; value: React.ReactNode; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem", borderBottom: "1px solid var(--border-color)", paddingBottom: 4 }}>
      <span style={{ color: "var(--text-muted)", fontWeight: "var(--fw-semibold)" }}>{label}</span>
      <span style={{ fontWeight: "var(--fw-bold)", textAlign: "right", maxWidth: "60%", color: valueColor }}>{value}</span>
    </div>
  );
}

function SkuViewModal({ sku, onClose, t }: { sku: EnrichedSku; onClose: () => void; t: (k: keyof Dict) => string }) {
  const heading = (txt: string) => (
    <h3 style={{ fontSize: "0.95rem", fontWeight: "var(--fw-strong)", textTransform: "uppercase", color: "var(--brand-primary)", borderBottom: "1px solid var(--border-color)", paddingBottom: 6 }}>{txt}</h3>
  );
  return (
    <div className="modal-overlay show">
      <div className="modal-content" style={{ maxWidth: 750 }}>
        <div className="modal-header">
          <div className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}><i className="ph-fill ph-info" style={{ color: "var(--brand-primary)", fontSize: "1.5rem" }} /> <span>{t("sku_det_profile")}</span></div>
          <button className="close-btn" onClick={onClose}><i className="ph ph-x" /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {heading("SKU Specifications")}
            <Row label="Name:" value={sku.name} />
            <Row label="Category:" value={sku.cat} />
            <Row label="Stock Type:" value={sku.tipe_stock || "Reguler"} />
            <Row label="Daily Demand:" value={`${sku.daily_demand.toLocaleString()} Pcs/day`} />
            <Row label="Storage Target:" value={`${sku.target_simpan || 30} ${t("days")}`} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {heading("Inventory Metrics")}
            <Row label="Current Stock:" value={`${sku.stock.toLocaleString()} Pcs`} valueColor="var(--brand-primary)" />
            <Row label="Incoming PO:" value={`${sku.po.toLocaleString()} Pcs`} />
            <Row label="Safety Stock:" value={`${sku.safety.toLocaleString()} Pcs`} />
            <Row label="Stock Coverage:" value={`${sku.coverage} ${t("days")}`} valueColor={sku.coverage < 7 ? "var(--brand-red)" : "var(--brand-green)"} />
            <Row label="Aging Status:" value={`${sku.aging} ${t("days")} (${t(sku.status_aging.toLowerCase() as keyof Dict)})`} />
            <Row label="Standard Status:" value={<span className={`status-pill ${sku.aging_class}`}>{t(sku.status_aging.toLowerCase() as keyof Dict)}</span>} />
          </div>
        </div>
        <div>
          <h3 style={{ fontSize: "0.95rem", fontWeight: "var(--fw-strong)", textTransform: "uppercase", color: "var(--brand-primary)", borderBottom: "1px solid var(--border-color)", paddingBottom: 6, marginBottom: 12 }}>Weekly Realization vs Forecast Trend</h3>
          <table className="modern-data-table" style={{ minWidth: "100%", border: "1px solid var(--border-color)" }}>
            <thead><tr style={{ background: "var(--bg-body)" }}><th>Metric</th>{[1,2,3,4,5].map((w) => <th key={w}>W{w}</th>)}</tr></thead>
            <tbody>
              <tr><td style={{ fontWeight: "var(--fw-bold)" }}>Forecast Target</td>{sku.f_trend.slice(0,5).map((v, i) => <td key={i} style={{ fontFamily: "monospace" }}>{v.toLocaleString()}</td>)}</tr>
              <tr><td style={{ fontWeight: "var(--fw-bold)", color: "var(--brand-primary)" }}>Actual Realization</td>{sku.r_trend.slice(0,5).map((v, i) => <td key={i} style={{ color: "var(--brand-primary)", fontFamily: "monospace", fontWeight: "var(--fw-bold)" }}>{v.toLocaleString()}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <div className="modal-footer" style={{ marginTop: 24 }}><button className="btn btn-primary" onClick={onClose}>{t("close")}</button></div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batch (FIFO) modal
// ---------------------------------------------------------------------------
function BatchModal({ skuName, batches, onClose, onAdd, onDelete, onInvalid, onAdded, t }: {
  skuName: string;
  batches: Batch[];
  onClose: () => void;
  onAdd: (b: Batch) => void;
  onDelete: (id: string) => void;
  onInvalid: () => void;
  onAdded: () => void;
  t: (k: keyof Dict) => string;
}) {
  const sorted = batches.slice().sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return (
    <div className="modal-overlay show">
      <div className="modal-content" style={{ maxWidth: 700 }}>
        <div className="modal-header">
          <div className="modal-title"><i className="ph-fill ph-clock-counter-clockwise" style={{ color: "var(--brand-primary)" }} /> <span>{t("batch_fifo_details")}</span></div>
          <button className="close-btn" onClick={onClose}><i className="ph ph-x" /></button>
        </div>
        <div style={{ marginBottom: 16, fontWeight: "var(--fw-bold)", color: "var(--brand-primary)" }}>{skuName}</div>
        <form onSubmit={(e) => {
          e.preventDefault();
          const f = e.currentTarget;
          const date = (f.elements.namedItem("b_date") as HTMLInputElement).value;
          const qty_in = parseInt((f.elements.namedItem("b_qty_in") as HTMLInputElement).value) || 0;
          const qty_used = parseInt((f.elements.namedItem("b_qty_used") as HTMLInputElement).value) || 0;
          if (qty_used > qty_in) { onInvalid(); return; }
          onAdd({ id: "B_" + Date.now(), date, qty_in, qty_used, sisa: qty_in - qty_used });
          f.reset();
          onAdded();
        }} style={{ background: "var(--bg-body)", padding: 16, borderRadius: 12, marginBottom: 24, border: "1px solid var(--border-color)" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: "var(--fw-bold)", marginBottom: 12 }}><i className="ph ph-plus-circle" /> <span>{t("add_inc_batch")}</span></div>
          <div className="form-grid" style={{ marginBottom: 0 }}>
            <div className="form-group"><label className="form-label">{t("inc_date")}</label><input name="b_date" type="date" className="form-input" required /></div>
            <div className="form-group"><label className="form-label">{t("inc_qty")}</label><input name="b_qty_in" type="number" className="form-input" required min={1} /></div>
            <div className="form-group"><label className="form-label">{t("used_sold_qty")}</label><input name="b_qty_used" type="number" className="form-input" defaultValue={0} min={0} /></div>
            <div className="form-group" style={{ justifyContent: "flex-end" }}><button type="submit" className="btn btn-primary" style={{ width: "100%" }}>{t("add_batch")}</button></div>
          </div>
        </form>
        <div className="table-responsive" style={{ maxHeight: 300 }}>
          <table className="modern-data-table">
            <thead><tr><th>{t("inc_date")}</th><th>{t("qty_in")}</th><th>{t("qty_used")}</th><th>{t("rem_sisa")}</th><th>{t("tbl_action")}</th></tr></thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr><td colSpan={5} style={{ textAlign: "center" }}>No batches found for this SKU.</td></tr>
              ) : sorted.map((b) => (
                <tr key={b.id}>
                  <td>{b.date}</td>
                  <td>{b.qty_in.toLocaleString()}</td>
                  <td>{b.qty_used.toLocaleString()}</td>
                  <td style={{ ...(b.sisa === 0 ? { color: "var(--text-muted)", textDecoration: "line-through" } : { color: "var(--brand-primary)", fontWeight: "var(--fw-strong)" }) }}>{b.sisa.toLocaleString()}</td>
                  <td><button className="btn-icon danger" style={{ width: 24, height: 24 }} onClick={() => onDelete(b.id)} title="Delete Batch"><i className="ph ph-trash" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="modal-footer" style={{ marginTop: 16 }}><button className="btn btn-primary" onClick={onClose}>{t("close")}</button></div>
      </div>
    </div>
  );
}
