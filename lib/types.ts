// Shared domain types for the SCM dashboard.

export type Role = "Admin" | "User";
export type UserStatus = "Active" | "Inactive";

export interface SessionUser {
  username: string;
  role: Role;
}

export interface AppUser {
  id: string;
  username: string;
  role: Role;
  status: UserStatus;
}

// --- Raw rows as stored in / returned from the Google Sheet -----------------

export interface RawSku {
  name: string;
  category: string;
  po: number;
  safety: number;
  daily_demand: number;
  tipe_stock: string;
  target_simpan: number;
}

export interface RawWeeklyRow {
  sku_name: string;
  week: number; // 1-5
  forecast: number;
  realization: number;
}

export interface RawBatch {
  sku_name: string;
  batch_id: string;
  date: string; // ISO yyyy-mm-dd
  qty_in: number;
  qty_used: number;
  sisa: number;
}

// --- Computed shapes (server-derived, mirrors old recalculateAll()) ---------

export type SkuStatus = "Optimal" | "Shortage" | "Excess";
export type AgingStatus = "Sehat" | "Waspada" | "Kritis" | "-";
export type AgingClass = "pill-cukup" | "pill-over" | "pill-kurang" | "pill-neutral";
export type AgingBucket = "0-30 hari" | "31-60 hari" | "61-90 hari" | "91+ hari" | "-";

export interface ComputedBatch extends RawBatch {}

export interface ComputedSku extends RawSku {
  batches: ComputedBatch[];
  f_trend: number[]; // length 5
  r_trend: number[]; // length 5
  stock: number;
  oldest_batch_date: string | null;
  active_batches: number;
  aging: number;
  kategori_aging: AgingBucket;
  selisih_target: number;
  status_aging: AgingStatus;
  aging_class: AgingClass;
  coverage: number;
  status: SkuStatus;
  severityScore: number;
}

export interface CategoryAggregate {
  forecast: number[]; // length 5
  realisasi: number[]; // length 5
}

export interface Kpis {
  totalForecast: number;
  totalRealization: number;
  accuracyPct: number;
  alertCount: number;
  avgAgingDays: number;
  skusPastTarget: number;
  totalActiveBatches: number;
}

export interface ComputedData {
  skus: ComputedSku[];
  categories: Record<string, CategoryAggregate>;
  kpis: Kpis;
}

// --- CSV import row shapes ---------------------------------------------------

export interface WeeklyImportRow {
  skuName: string;
  category: string;
  week: number;
  forecast: number;
  realization: number;
}

export interface StockImportRow {
  skuName: string;
  category: string;
  dailyDemand: number;
  stock: number;
  po: number;
  safety: number;
}

export interface AgingImportRow {
  skuName: string;
  category: string;
  incomingDate: string;
  qtyIn: number;
  qtyUsed: number;
  sisa: number;
  tipeStock: string;
  targetSimpan: number;
}
