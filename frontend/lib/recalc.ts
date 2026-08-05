// Exact port of the original recalculateAll() (index.html:1268-1335).
// Runs server-side in GET /api/data so every client always renders pre-computed data.

import {
  RawSku,
  RawWeeklyRow,
  RawBatch,
  ComputedSku,
  ComputedData,
  CategoryAggregate,
  AgingBucket,
  AgingStatus,
  AgingClass,
  SkuStatus,
} from "./types";

const WEEKS = 5;

function weekFor(weekly: RawWeeklyRow[], skuName: string, field: "forecast" | "realization"): number[] {
  const arr = [0, 0, 0, 0, 0];
  for (const row of weekly) {
    if (row.sku_name === skuName && row.week >= 1 && row.week <= WEEKS) {
      arr[row.week - 1] = row[field] || 0;
    }
  }
  return arr;
}

function computeSku(raw: RawSku, weekly: RawWeeklyRow[], batches: RawBatch[]): ComputedSku {
  const skuBatches = batches
    .filter((b) => b.sku_name === raw.name)
    .slice()
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let stock = 0;
  let oldestDate: Date | null = null;
  let activeBatches = 0;
  for (const b of skuBatches) {
    if (b.sisa > 0) {
      stock += b.sisa;
      activeBatches++;
      if (!oldestDate) oldestDate = new Date(b.date);
    }
  }

  const aging = oldestDate ? Math.ceil((Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

  let kategoriAging: AgingBucket;
  if (stock === 0) kategoriAging = "-";
  else if (aging <= 30) kategoriAging = "0-30 hari";
  else if (aging <= 60) kategoriAging = "31-60 hari";
  else if (aging <= 90) kategoriAging = "61-90 hari";
  else kategoriAging = "91+ hari";

  const targetSimpan = raw.target_simpan || 30;
  const selisihTarget = aging - targetSimpan;

  let statusAging: AgingStatus;
  let agingClass: AgingClass;
  if (stock === 0) {
    statusAging = "-";
    agingClass = "pill-neutral";
  } else if (selisihTarget <= 0) {
    statusAging = "Sehat";
    agingClass = "pill-cukup";
  } else if (selisihTarget <= 30) {
    statusAging = "Waspada";
    agingClass = "pill-over";
  } else {
    statusAging = "Kritis";
    agingClass = "pill-kurang";
  }

  const fTrend = weekFor(weekly, raw.name, "forecast");
  const rTrend = weekFor(weekly, raw.name, "realization");

  const totalInventory = stock + raw.po;
  const coverage = raw.daily_demand > 0 ? parseFloat((totalInventory / raw.daily_demand).toFixed(1)) : 0;

  let status: SkuStatus;
  let severityScore: number;
  if (totalInventory < raw.safety) {
    status = "Shortage";
    severityScore = raw.safety - totalInventory;
  } else if (selisihTarget > 0) {
    status = "Excess";
    severityScore = selisihTarget;
  } else {
    status = "Optimal";
    severityScore = 0;
  }

  return {
    ...raw,
    target_simpan: targetSimpan,
    batches: skuBatches,
    f_trend: fTrend,
    r_trend: rTrend,
    stock,
    oldest_batch_date: oldestDate ? oldestDate.toISOString().split("T")[0] : null,
    active_batches: activeBatches,
    aging,
    kategori_aging: kategoriAging,
    selisih_target: selisihTarget,
    status_aging: statusAging,
    aging_class: agingClass,
    coverage,
    status,
    severityScore,
  };
}

export function computeAll(rawSkus: RawSku[], weekly: RawWeeklyRow[], batches: RawBatch[]): ComputedData {
  const skus = rawSkus.map((s) => computeSku(s, weekly, batches));

  const categories: Record<string, CategoryAggregate> = {};
  let totalForecast = 0;
  let totalRealization = 0;
  let alertCount = 0;
  let totalAgingDays = 0;
  let activeSkusForAging = 0;
  let skusPastTarget = 0;
  let totalActiveBatches = 0;

  for (const sku of skus) {
    if (!categories[sku.category]) {
      categories[sku.category] = { forecast: [0, 0, 0, 0, 0], realisasi: [0, 0, 0, 0, 0] };
    }
    for (let i = 0; i < WEEKS; i++) {
      categories[sku.category].forecast[i] += sku.f_trend[i];
      categories[sku.category].realisasi[i] += sku.r_trend[i];
      totalForecast += sku.f_trend[i];
      totalRealization += sku.r_trend[i];
    }

    if (sku.aging > 0) {
      totalAgingDays += sku.aging;
      activeSkusForAging++;
    }
    if (sku.selisih_target > 0 && sku.stock > 0) skusPastTarget++;
    totalActiveBatches += sku.active_batches;

    if (sku.status === "Shortage" || sku.status === "Excess") alertCount++;
  }

  const kpis = {
    totalForecast,
    totalRealization,
    accuracyPct: totalForecast > 0 ? parseFloat(((totalRealization / totalForecast) * 100).toFixed(1)) : 0,
    alertCount,
    avgAgingDays: activeSkusForAging > 0 ? Math.round(totalAgingDays / activeSkusForAging) : 0,
    skusPastTarget,
    totalActiveBatches,
  };

  return { skus, categories, kpis };
}
