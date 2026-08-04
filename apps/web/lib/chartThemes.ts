// Chart theme tokens per UI theme. Categorical palettes are CVD-validated
// (fixed hue order, never cycled) against each theme's card surface.

export type ThemeName = "theme-default" | "theme-dark" | "theme-emerald";

export interface ThemeColors {
  primary: string;
  secondary: string;
  orange: string;
  red: string;
  green: string;
  palette: string[];
  aging: string[]; // status ramp for aging buckets: fresh → critical
  textColor: string; // axis ticks & legend labels
  gridColor: string;
  labelBg: string;
  bgBody: string;
  surface: string; // card background the charts sit on
  tooltipBg: string;
  tooltipText: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  "theme-default": {
    primary: "#1E3A8A",
    secondary: "#0EA5E9",
    orange: "#F59E0B",
    red: "#EF4444",
    green: "#10B981",
    palette: ["#2563EB", "#EA580C", "#0D9488", "#B45309", "#DB2777", "#15803D", "#4F46E5", "#DC2626"],
    aging: ["#10B981", "#0EA5E9", "#F59E0B", "#EF4444"],
    textColor: "#64748B",
    gridColor: "#EDF1F7",
    labelBg: "rgba(255, 255, 255, 0.88)",
    bgBody: "#F4F6FB",
    surface: "#FFFFFF",
    tooltipBg: "rgba(15, 23, 42, 0.92)",
    tooltipText: "#F8FAFC",
  },
  "theme-dark": {
    primary: "#3B82F6",
    secondary: "#38BDF8",
    orange: "#FBBF24",
    red: "#F87171",
    green: "#34D399",
    palette: ["#3B82F6", "#EA580C", "#0D9488", "#D97706", "#EC4899", "#16A34A", "#6366F1", "#EF4444"],
    aging: ["#34D399", "#38BDF8", "#FBBF24", "#F87171"],
    textColor: "#94A3B8",
    gridColor: "#26324A",
    labelBg: "rgba(19, 28, 46, 0.9)",
    bgBody: "#0B1220",
    surface: "#131C2E",
    tooltipBg: "rgba(2, 6, 23, 0.94)",
    tooltipText: "#E2E8F0",
  },
  "theme-emerald": {
    primary: "#065F46",
    secondary: "#10B981",
    orange: "#F59E0B",
    red: "#EF4444",
    green: "#059669",
    palette: ["#059669", "#2563EB", "#EA580C", "#0D9488", "#B45309", "#DB2777", "#4F46E5", "#DC2626"],
    aging: ["#10B981", "#0EA5E9", "#F59E0B", "#EF4444"],
    textColor: "#64748B",
    gridColor: "#E3EFE9",
    labelBg: "rgba(255, 255, 255, 0.88)",
    bgBody: "#F4F6FB",
    surface: "#FFFFFF",
    tooltipBg: "rgba(6, 44, 34, 0.92)",
    tooltipText: "#ECFDF5",
  },
};

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function formatSkuChartLabel(name: string): string {
  const s = name.replace(/SAFF & Co\. Extrait de Parfum - |ROOM POTION |Deo Potion |Hand Dew /gi, "");
  return s.length > 15 ? s.substring(0, 15) + ".." : s;
}
