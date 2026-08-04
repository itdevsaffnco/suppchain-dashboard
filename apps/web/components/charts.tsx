"use client";

import { useMemo } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
  type ChartOptions,
  type ChartData,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { Chart } from "react-chartjs-2";
import { hexToRgba, type ThemeColors } from "@/lib/chartThemes";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  LineElement,
  LineController,
  PointElement,
  ArcElement,
  DoughnutController,
  Tooltip,
  Legend,
  ChartDataLabels
);

// Canvas can't resolve CSS variables, so read the computed body font
// (next/font registers hashed family names) to keep charts on Special Gothic.
if (typeof window !== "undefined") {
  ChartJS.defaults.font.family = getComputedStyle(document.body).fontFamily;
  ChartJS.defaults.font.weight = 500;
}

const numberFmt = (v: number) => v.toLocaleString();

const varianceFooter = (items: { dataset: { label?: string }; raw: unknown }[]) => {
  let f = 0;
  let r = 0;
  items.forEach((item) => {
    if (item.dataset.label?.includes("Forecast")) f = item.raw as number;
    if (item.dataset.label?.includes("Realization")) r = item.raw as number;
  });
  if (f > 0 && r > 0) {
    const g = r - f;
    const p = f > 0 ? ((g / f) * 100).toFixed(1) : "0";
    const s = g > 0 ? "+" : "";
    return `Variance: ${s}${g.toLocaleString()} Qty (${s}${p}%)`;
  }
  return "";
};

/* Theme-aware axis ticks — font color follows the active theme. */
function baseScales(theme: ThemeColors) {
  return {
    x: { grid: { display: false }, ticks: { color: theme.textColor }, border: { color: theme.gridColor } },
    y: { beginAtZero: true, grid: { color: theme.gridColor }, ticks: { color: theme.textColor }, border: { display: false } },
  };
}

/* Shared themed tooltip styling. */
function themedTooltip(theme: ThemeColors) {
  return {
    backgroundColor: theme.tooltipBg,
    titleColor: theme.tooltipText,
    bodyColor: theme.tooltipText,
    footerColor: theme.tooltipText,
    padding: 12,
    cornerRadius: 10,
    boxPadding: 4,
    usePointStyle: true,
  };
}

/* Shared themed legend — labels colored by theme, round swatches. */
function themedLegend(theme: ThemeColors, position: "top" | "bottom" = "top") {
  return {
    display: true,
    position,
    labels: { color: theme.textColor, usePointStyle: true, pointStyle: "circle" as const, boxWidth: 8, boxHeight: 8, padding: 14 },
  };
}

interface ComboProps {
  labels: string[];
  forecast: number[];
  realization: number[];
  lineColor: string;
  theme: ThemeColors;
  hideZeroLabels?: boolean;
}

/** Forecast (bars) vs Realization (line) — the analysis charts. */
export function ComboChart({ labels, forecast, realization, lineColor, theme, hideZeroLabels }: ComboProps) {
  const data = useMemo<ChartData>(
    () => ({
      labels,
      datasets: [
        {
          type: "bar" as const,
          label: "Forecast",
          data: forecast,
          // Tinted with the chart's accent so forecast reads colorful yet subordinate
          backgroundColor: hexToRgba(lineColor, 0.16),
          hoverBackgroundColor: hexToRgba(lineColor, 0.28),
          borderRadius: 6,
          maxBarThickness: 52,
          order: 2,
          datalabels: { display: false },
        },
        {
          type: "line" as const,
          label: "Realization",
          data: realization,
          borderColor: lineColor,
          backgroundColor: lineColor,
          borderWidth: 2.5,
          tension: 0.4,
          pointRadius: 4,
          pointHoverRadius: 6,
          pointBackgroundColor: theme.surface,
          pointBorderWidth: 2,
          order: 1,
          datalabels: {
            display: true,
            align: "top" as const,
            anchor: "end" as const,
            offset: 6,
            backgroundColor: theme.labelBg,
            borderRadius: 4,
            color: lineColor,
            font: { weight: 600 as const, size: 10 },
            formatter: (v: number) => (hideZeroLabels ? (v > 0 ? numberFmt(v) : "") : numberFmt(v)),
          },
        },
      ],
    }),
    [labels, forecast, realization, lineColor, theme, hideZeroLabels]
  );

  const options = useMemo<ChartOptions>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      color: theme.textColor,
      layout: { padding: { top: 20 } },
      plugins: {
        legend: { display: false },
        datalabels: { display: false },
        tooltip: {
          mode: "index",
          intersect: false,
          ...themedTooltip(theme),
          callbacks: { footer: varianceFooter as never },
        },
      },
      scales: baseScales(theme),
    }),
    [theme]
  );

  return <Chart type="bar" data={data} options={options} />;
}

interface GroupedBarProps {
  labels: string[];
  series: { label: string; data: number[]; color: string }[];
  theme: ThemeColors;
}

/** Stock level vs safety stock — grouped bars. */
export function GroupedBarChart({ labels, series, theme }: GroupedBarProps) {
  const data = useMemo<ChartData>(
    () => ({
      labels,
      datasets: series.map((s) => ({
        type: "bar" as const,
        label: s.label,
        data: s.data,
        backgroundColor: s.color,
        hoverBackgroundColor: s.color,
        borderRadius: 4,
        maxBarThickness: 28,
        datalabels: { display: false },
      })),
    }),
    [labels, series]
  );

  const options = useMemo<ChartOptions>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      color: theme.textColor,
      plugins: { legend: themedLegend(theme), datalabels: { display: false }, tooltip: themedTooltip(theme) },
      scales: baseScales(theme),
    }),
    [theme]
  );

  return <Chart type="bar" data={data} options={options} />;
}

interface SimpleBarProps {
  labels: string[];
  data: number[];
  colors: string[];
  theme: ThemeColors;
}

/** Category aging distribution — single series, color per bucket. */
export function SimpleBarChart({ labels, data, colors, theme }: SimpleBarProps) {
  const chartData = useMemo<ChartData>(
    () => ({
      labels,
      datasets: [
        {
          type: "bar" as const,
          label: "Jumlah SKU",
          data,
          backgroundColor: colors,
          borderRadius: 6,
          maxBarThickness: 64,
          datalabels: { display: false },
        },
      ],
    }),
    [labels, data, colors]
  );

  const options = useMemo<ChartOptions>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      color: theme.textColor,
      plugins: { legend: { display: false }, datalabels: { display: false }, tooltip: themedTooltip(theme) },
      scales: {
        x: { grid: { display: false }, ticks: { color: theme.textColor }, border: { color: theme.gridColor } },
        y: { beginAtZero: true, ticks: { precision: 0, color: theme.textColor }, grid: { color: theme.gridColor }, border: { display: false } },
      },
    }),
    [theme]
  );

  return <Chart type="bar" data={chartData} options={options} />;
}

interface DoughnutProps {
  labels: string[];
  data: number[];
  colors: string[];
  theme: ThemeColors;
}

/** Stock type composition — doughnut. */
export function DoughnutChart({ labels, data, colors, theme }: DoughnutProps) {
  const chartData = useMemo<ChartData>(
    () => ({
      labels,
      // 2px surface-colored border = spacer gap between slices
      datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: theme.surface, hoverOffset: 6 }],
    }),
    [labels, data, colors, theme]
  );

  const options = useMemo<ChartOptions>(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      cutout: "65%",
      color: theme.textColor,
      plugins: {
        legend: themedLegend(theme, "bottom"),
        tooltip: themedTooltip(theme),
        datalabels: {
          display: true,
          color: "#FFFFFF",
          font: { weight: 600, size: 11 },
          formatter: (v: number) => (v > 0 ? numberFmt(v) : ""),
        },
      },
    }),
    [theme]
  );

  return <Chart type="doughnut" data={chartData} options={options} />;
}
