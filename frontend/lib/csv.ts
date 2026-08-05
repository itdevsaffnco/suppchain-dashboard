// Ported verbatim from index.html: downloadCSV, parseCSVRow, and the three
// template/export/import helpers (client-side only).

import { ComputedSku } from "./types";

export function downloadCSV(csvContent: string, fileName: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.setAttribute("href", URL.createObjectURL(blob));
  link.setAttribute("download", fileName);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function parseCSVRow(str: string): string[] {
  const arr: string[] = [];
  let quote = false;
  let col = "";
  for (let i = 0; i < str.length; i++) {
    const cc = str[i];
    const nc = str[i + 1];
    if (cc === '"' && quote && nc === '"') {
      col += cc;
      i++;
      continue;
    }
    if (cc === '"') {
      quote = !quote;
      continue;
    }
    if (cc === "," && !quote) {
      arr.push(col.trim().replace(/^"|"$/g, ""));
      col = "";
      continue;
    }
    col += cc;
  }
  arr.push(col.trim().replace(/^"|"$/g, ""));
  return arr;
}

// --- Weekly ---------------------------------------------------------------

export function downloadWeeklyTemplate() {
  downloadCSV(
    'SKU Name,Category,Week Num (1-5),Forecast Qty,Realization Qty\n"SAFF & Co. Extrait de Parfum - Sample","FULLSIZE",1,100,90\n',
    "Template_Weekly_Data.csv"
  );
}

export function exportWeeklyData(skus: ComputedSku[]) {
  let csv = "SKU Name,Category,Week Num (1-5),Forecast Qty,Realization Qty\n";
  skus.forEach((s) => {
    for (let i = 0; i < 5; i++) {
      csv += `"${s.name}","${s.category}",${i + 1},${s.f_trend[i]},${s.r_trend[i]}\n`;
    }
  });
  downloadCSV(csv, "Export_Weekly_Data.csv");
}

export interface ParsedWeeklyRow {
  skuName: string;
  category: string;
  week: number;
  forecast: number;
  realization: number;
}

export function parseWeeklyCSV(text: string): ParsedWeeklyRow[] {
  const lines = text.split("\n");
  const rows: ParsedWeeklyRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i]);
    if (cols.length < 5) continue;
    const week = parseInt(cols[2]);
    if (week < 1 || week > 5) continue;
    rows.push({
      skuName: cols[0],
      category: cols[1] || "UNCATEGORIZED",
      week,
      forecast: parseInt(cols[3]) || 0,
      realization: parseInt(cols[4]) || 0,
    });
  }
  return rows;
}

// --- Stock Health -----------------------------------------------------------

export function downloadStockTemplate() {
  downloadCSV(
    'SKU Name,Category,Avg Daily Demand,Existing Stock,Incoming PO,Safety Stock,Aging (Days)\n"SAFF & Co. Extrait de Parfum - Sample","FULLSIZE",50.5,500,100,200,15\n',
    "Template_Stock_Health.csv"
  );
}

export function exportStockHealth(skus: ComputedSku[]) {
  let csv = "SKU Name,Category,Avg Daily Demand,Existing Stock,Incoming PO,Safety Stock\n";
  skus.forEach((s) => {
    csv += `"${s.name}","${s.category}",${s.daily_demand},${s.stock},${s.po},${s.safety}\n`;
  });
  downloadCSV(csv, "Export_Stock_Health.csv");
}

export interface ParsedStockRow {
  skuName: string;
  category: string;
  dailyDemand: number;
  stock: number;
  po: number;
  safety: number;
}

export function parseStockCSV(text: string): ParsedStockRow[] {
  const lines = text.split("\n");
  const rows: ParsedStockRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i]);
    if (cols.length < 6) continue;
    rows.push({
      skuName: cols[0],
      category: cols[1] || "UNCATEGORIZED",
      dailyDemand: parseFloat(cols[2]) || 1,
      stock: parseInt(cols[3]) || 0,
      po: parseInt(cols[4]) || 0,
      safety: parseInt(cols[5]) || 0,
    });
  }
  return rows;
}

// --- Aging / FIFO -------------------------------------------------------------

export function downloadAgingTemplate() {
  downloadCSV(
    'SKU Name,Category,Incoming Date,Incoming Qty,Used Qty,Sisa,Stock Type,Storage Target\n"SAFF & Co. Extrait de Parfum - Sample","FULLSIZE","2026-04-27",260,200,60,"Reguler",30\n',
    "Template_Aging_FIFO.csv"
  );
}

export function exportAgingData(skus: ComputedSku[]) {
  let csv = "SKU Name,Category,Incoming Date,Incoming Qty,Used Qty,Sisa,Stock Type,Storage Target\n";
  skus.forEach((s) => {
    if (s.batches && s.batches.length > 0) {
      s.batches.forEach((b) => {
        csv += `"${s.name}","${s.category}","${b.date}",${b.qty_in},${b.qty_used},${b.sisa},"${s.tipe_stock || "Reguler"}",${s.target_simpan || 30}\n`;
      });
    } else {
      csv += `"${s.name}","${s.category}","",0,0,0,"${s.tipe_stock || "Reguler"}",${s.target_simpan || 30}\n`;
    }
  });
  downloadCSV(csv, "Export_Aging_FIFO.csv");
}

export interface ParsedAgingRow {
  skuName: string;
  category: string;
  incomingDate: string;
  qtyIn: number;
  qtyUsed: number;
  sisa: number;
  tipeStock: string;
  targetSimpan: number;
}

export function parseAgingCSV(text: string): ParsedAgingRow[] {
  const lines = text.split("\n");
  const rows: ParsedAgingRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const cols = parseCSVRow(lines[i]);
    if (cols.length < 8) continue;
    rows.push({
      skuName: cols[0],
      category: cols[1] || "UNCATEGORIZED",
      incomingDate: cols[2],
      qtyIn: parseInt(cols[3]) || 0,
      qtyUsed: parseInt(cols[4]) || 0,
      sisa: parseInt(cols[5]) || 0,
      tipeStock: cols[6] || "Reguler",
      targetSimpan: parseInt(cols[7]) || 30,
    });
  }
  return rows;
}
