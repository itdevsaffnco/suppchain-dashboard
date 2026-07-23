// Client-safe dashboard domain: seed data + the recalculateAll() port.
// No node-only imports here so it can run in both the browser and route handlers.

export type SkuStatus = "Optimal" | "Shortage" | "Excess";
export type AgingStatus = "Sehat" | "Waspada" | "Kritis" | "-";
export type AgingClass = "pill-cukup" | "pill-over" | "pill-kurang" | "pill-neutral";
export type AgingBucket = "0-30 hari" | "31-60 hari" | "61-90 hari" | "91+ hari" | "-";

export interface Batch {
  id: string;
  date: string; // yyyy-mm-dd
  qty_in: number;
  qty_used: number;
  sisa: number;
}

export interface Sku {
  name: string;
  cat: string;
  f_trend: number[]; // length 5
  r_trend: number[]; // length 5
  po: number;
  safety: number;
  daily_demand: number;
  tipe_stock: string;
  target_simpan: number;
  batches: Batch[];
}

export interface EnrichedSku extends Sku {
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
  forecast: number[];
  realisasi: number[];
}

export interface AppUser {
  id: number;
  username: string;
  email: string;
  role: "Admin" | "User";
  status: "Active" | "Inactive";
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

export interface DashboardData {
  skus: Sku[];
  categories: Record<string, CategoryAggregate>;
  users: AppUser[];
}

// ---------------------------------------------------------------------------
// recalculateAll() port — pure, derives every computed field from raw sku data.
// ---------------------------------------------------------------------------

const DAY = 1000 * 60 * 60 * 24;

export function enrichSku(raw: Sku, now = Date.now()): EnrichedSku {
  const batches = raw.batches
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let stock = 0;
  let oldest: Date | null = null;
  let activeBatches = 0;
  for (const b of batches) {
    if (b.sisa > 0) {
      stock += b.sisa;
      activeBatches++;
      if (!oldest) oldest = new Date(b.date);
    }
  }

  const aging = oldest ? Math.ceil((now - oldest.getTime()) / DAY) : 0;

  let kategori_aging: AgingBucket;
  if (stock === 0) kategori_aging = "-";
  else if (aging <= 30) kategori_aging = "0-30 hari";
  else if (aging <= 60) kategori_aging = "31-60 hari";
  else if (aging <= 90) kategori_aging = "61-90 hari";
  else kategori_aging = "91+ hari";

  const target_simpan = raw.target_simpan || 30;
  const selisih_target = aging - target_simpan;

  let status_aging: AgingStatus;
  let aging_class: AgingClass;
  if (stock === 0) {
    status_aging = "-";
    aging_class = "pill-neutral";
  } else if (selisih_target <= 0) {
    status_aging = "Sehat";
    aging_class = "pill-cukup";
  } else if (selisih_target <= 30) {
    status_aging = "Waspada";
    aging_class = "pill-over";
  } else {
    status_aging = "Kritis";
    aging_class = "pill-kurang";
  }

  const totalInventory = stock + raw.po;
  const coverage =
    raw.daily_demand > 0 ? parseFloat((totalInventory / raw.daily_demand).toFixed(1)) : 0;

  let status: SkuStatus;
  let severityScore: number;
  if (totalInventory < raw.safety) {
    status = "Shortage";
    severityScore = raw.safety - totalInventory;
  } else if (selisih_target > 0) {
    status = "Excess";
    severityScore = selisih_target;
  } else {
    status = "Optimal";
    severityScore = 0;
  }

  return {
    ...raw,
    target_simpan,
    batches,
    stock,
    oldest_batch_date: oldest ? oldest.toISOString().split("T")[0] : null,
    active_batches: activeBatches,
    aging,
    kategori_aging,
    selisih_target,
    status_aging,
    aging_class,
    coverage,
    status,
    severityScore,
  };
}

export function computeKpis(skus: EnrichedSku[]): Kpis {
  let totalForecast = 0;
  let totalRealization = 0;
  let alertCount = 0;
  let totalAgingDays = 0;
  let activeSkusForAging = 0;
  let skusPastTarget = 0;
  let totalActiveBatches = 0;

  for (const s of skus) {
    for (let i = 0; i < 5; i++) {
      totalForecast += s.f_trend[i] || 0;
      totalRealization += s.r_trend[i] || 0;
    }
    if (s.aging > 0) {
      totalAgingDays += s.aging;
      activeSkusForAging++;
    }
    if (s.selisih_target > 0 && s.stock > 0) skusPastTarget++;
    totalActiveBatches += s.active_batches;
    if (s.status === "Shortage" || s.status === "Excess") alertCount++;
  }

  return {
    totalForecast,
    totalRealization,
    accuracyPct:
      totalForecast > 0
        ? parseFloat(((totalRealization / totalForecast) * 100).toFixed(1))
        : 0,
    alertCount,
    avgAgingDays: activeSkusForAging > 0 ? Math.round(totalAgingDays / activeSkusForAging) : 0,
    skusPastTarget,
    totalActiveBatches,
  };
}

export function enrichAll(skus: Sku[], now = Date.now()): EnrichedSku[] {
  return skus.map((s) => enrichSku(s, now));
}

// ---------------------------------------------------------------------------
// Seed data (ported from the original index.html standalone dashboard).
// ---------------------------------------------------------------------------

export const SEED_USERS: AppUser[] = [
  { id: 1001, username: "admin_sc", email: "admin@saffnco.com", role: "Admin", status: "Active" },
  { id: 1002, username: "staff_wh", email: "staff.wh@saffnco.com", role: "User", status: "Active" },
];

export const SEED_CATEGORIES: Record<string, CategoryAggregate> = {
  FULLSIZE: { forecast: [32000, 31000, 31200, 32000, 32519], realisasi: [36808, 0, 0, 0, 0] },
  "TRAVEL SIZE": { forecast: [15000, 14000, 14200, 14000, 11195], realisasi: [21016, 0, 0, 0, 0] },
  CLOUDMIST: { forecast: [4000, 4100, 3900, 3500, 2925], realisasi: [7589, 0, 0, 0, 0] },
  "MINI CLOUDMIST": { forecast: [1500, 1600, 1500, 1400, 1564], realisasi: [1512, 0, 0, 0, 0] },
  "PERSONAL CARE": { forecast: [1800, 1700, 1500, 1500, 1456], realisasi: [467, 0, 0, 0, 0] },
  "HOME FRAGRANCE": { forecast: [400, 420, 410, 400, 346], realisasi: [379, 0, 0, 0, 0] },
  "HAND DEW": { forecast: [500, 600, 500, 600, 481], realisasi: [631, 0, 0, 0, 0] },
  "DEO POTION": { forecast: [600, 700, 600, 600, 640], realisasi: [1216, 0, 0, 0, 0] },
};

export const SEED_SKUS: Sku[] = [
  { name: "SAFF & Co. Extrait de Parfum - TROUPE", cat: "FULLSIZE", f_trend: [800, 788, 797, 828, 837], r_trend: [679, 596, 717, 717, 773], po: 50, safety: 196, daily_demand: 7.9, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-04-27", qty_in: 260, qty_used: 200, sisa: 60 }, { id: "B2", date: "2026-05-28", qty_in: 199, qty_used: 105, sisa: 94 }, { id: "B3", date: "2026-07-01", qty_in: 104, qty_used: 12, sisa: 92 }] },
  { name: "SAFF & Co. Extrait de Parfum - LOUI", cat: "FULLSIZE", f_trend: [306, 298, 322, 316, 313], r_trend: [173, 292, 282, 259, 324], po: 0, safety: 250, daily_demand: 41.9, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-03-11", qty_in: 111, qty_used: 61, sisa: 50 }, { id: "B2", date: "2026-04-13", qty_in: 65, qty_used: 59, sisa: 6 }, { id: "B3", date: "2026-04-26", qty_in: 292, qty_used: 62, sisa: 230 }] },
  { name: "SAFF & Co. Extrait de Parfum - COCO", cat: "FULLSIZE", f_trend: [135, 132, 133, 137, 139], r_trend: [108, 85, 81, 83, 127], po: 321, safety: 122, daily_demand: 37.8, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-03-14", qty_in: 299, qty_used: 183, sisa: 116 }, { id: "B2", date: "2026-04-20", qty_in: 269, qty_used: 45, sisa: 224 }] },
  { name: "SAFF & Co. Extrait de Parfum - OMNIA", cat: "FULLSIZE", f_trend: [100, 110, 120, 130, 140], r_trend: [90, 95, 110, 120, 135], po: 0, safety: 150, daily_demand: 25.5, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-04-15", qty_in: 80, qty_used: 63, sisa: 17 }, { id: "B2", date: "2026-05-18", qty_in: 120, qty_used: 35, sisa: 85 }, { id: "B3", date: "2026-06-20", qty_in: 100, qty_used: 22, sisa: 78 }] },
  { name: "SAFF & Co. Extrait de Parfum - CHNO", cat: "FULLSIZE", f_trend: [80, 90, 100, 110, 120], r_trend: [70, 80, 95, 100, 110], po: 0, safety: 100, daily_demand: 15.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-03-17", qty_in: 200, qty_used: 170, sisa: 30 }, { id: "B2", date: "2026-04-25", qty_in: 150, qty_used: 115, sisa: 35 }] },
  { name: "SAFF & Co. TRAVEL SIZE - TROUPE", cat: "TRAVEL SIZE", f_trend: [1500, 1600, 1700, 1800, 1604], r_trend: [1100, 1200, 1300, 1400, 241], po: 100, safety: 500, daily_demand: 80.0, tipe_stock: "New Launch", target_simpan: 60, batches: [{ id: "B1", date: "2026-05-09", qty_in: 3000, qty_used: 1200, sisa: 1800 }, { id: "B2", date: "2026-06-15", qty_in: 2500, qty_used: 500, sisa: 2000 }, { id: "B3", date: "2026-07-02", qty_in: 2270, qty_used: 0, sisa: 2270 }] },
  { name: "SAFF & Co. TRAVEL SIZE - LOUI", cat: "TRAVEL SIZE", f_trend: [1200, 1300, 1400, 1500, 5674], r_trend: [1000, 1100, 1200, 1300, 2054], po: 0, safety: 400, daily_demand: 70.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-03-11", qty_in: 500, qty_used: 300, sisa: 200 }, { id: "B2", date: "2026-04-15", qty_in: 600, qty_used: 400, sisa: 200 }, { id: "B3", date: "2026-05-20", qty_in: 1000, qty_used: 79, sisa: 921 }] },
  { name: "SAFF & Co. TRAVEL SIZE - COCO", cat: "TRAVEL SIZE", f_trend: [1000, 1100, 1200, 1300, 2731], r_trend: [900, 1000, 1100, 1200, 353], po: 0, safety: 350, daily_demand: 60.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-03-14", qty_in: 2000, qty_used: 800, sisa: 1200 }, { id: "B2", date: "2026-04-20", qty_in: 2500, qty_used: 80, sisa: 2420 }] },
  { name: "SAFF & Co. CLOUD MIST - Annabel Lee", cat: "CLOUDMIST", f_trend: [150, 160, 170, 180, 190], r_trend: [120, 130, 140, 150, 160], po: 0, safety: 100, daily_demand: 12.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-04-20", qty_in: 100, qty_used: 60, sisa: 40 }, { id: "B2", date: "2026-05-25", qty_in: 150, qty_used: 45, sisa: 105 }] },
  { name: "SAFF & Co. CLOUD MIST - Remedia Amoris", cat: "CLOUDMIST", f_trend: [180, 190, 200, 210, 220], r_trend: [140, 150, 160, 170, 180], po: 0, safety: 120, daily_demand: 15.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-04-25", qty_in: 100, qty_used: 80, sisa: 20 }, { id: "B2", date: "2026-05-30", qty_in: 150, qty_used: 60, sisa: 90 }, { id: "B3", date: "2026-06-15", qty_in: 136, qty_used: 0, sisa: 136 }] },
  { name: "MINI SAFF & CO. CLOUD MIST - ANNABEL LEE", cat: "MINI CLOUDMIST", f_trend: [241, 250, 239, 260, 244], r_trend: [209, 140, 190, 294, 203], po: 0, safety: 800, daily_demand: 46, tipe_stock: "Buffer/Reserve (MOQ)", target_simpan: 240, batches: [{ id: "B1", date: "2026-03-28", qty_in: 500, qty_used: 203, sisa: 297 }] },
  { name: "SAFF & CO. BODY POTION SANCTUM ON THE BEACH", cat: "PERSONAL CARE", f_trend: [110, 115, 125, 130, 120], r_trend: [85, 99, 104, 115, 110], po: 100, safety: 180, daily_demand: 15.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "B1", date: "2026-04-06", qty_in: 150, qty_used: 73, sisa: 77 }] },
  { name: "SAFF & CO. SHOWER POTION ODE TO OSTARA", cat: "PERSONAL CARE", f_trend: [310, 320, 290, 340, 315], r_trend: [290, 315, 275, 330, 310], po: 0, safety: 100, daily_demand: 28.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "S1", date: "2026-04-23", qty_in: 337, qty_used: 0, sisa: 337 }] },
  { name: "ROOM POTION SACRO BOSCO", cat: "HOME FRAGRANCE", f_trend: [241, 250, 239, 260, 244], r_trend: [209, 140, 190, 294, 203], po: 0, safety: 83, daily_demand: 46, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "R1", date: "2026-03-19", qty_in: 295, qty_used: 107, sisa: 188 }] },
  { name: "FABRIC POTION PETALI DI SETA", cat: "HOME FRAGRANCE", f_trend: [100, 120, 110, 130, 115], r_trend: [80, 95, 90, 110, 100], po: 0, safety: 120, daily_demand: 18.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "F1", date: "2026-03-31", qty_in: 51, qty_used: 29, sisa: 22 }, { id: "F2", date: "2026-05-07", qty_in: 144, qty_used: 58, sisa: 86 }] },
  { name: "Hand Dew My Annabel Lee", cat: "HAND DEW", f_trend: [200, 220, 210, 230, 225], r_trend: [150, 180, 175, 190, 185], po: 0, safety: 150, daily_demand: 20.0, tipe_stock: "Reguler", target_simpan: 30, batches: [{ id: "H1", date: "2026-04-17", qty_in: 250, qty_used: 81, sisa: 169 }] },
];

export function seedData(): DashboardData {
  // Deep clone so in-memory mutations never corrupt the module-level seed.
  return JSON.parse(
    JSON.stringify({ skus: SEED_SKUS, categories: SEED_CATEGORIES, users: SEED_USERS })
  ) as DashboardData;
}
