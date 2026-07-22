// Ported verbatim from index.html (themes object, hexToRgba, formatSkuChartLabel).

export type ThemeName = "theme-default" | "theme-dark" | "theme-emerald";

export interface ThemeColors {
  primary: string;
  secondary: string;
  orange: string;
  red: string;
  green: string;
  palette: string[];
  textColor: string;
  gridColor: string;
  labelBg: string;
  bgBody: string;
}

export const themes: Record<ThemeName, ThemeColors> = {
  "theme-default": {
    primary: "#1E3A8A",
    secondary: "#0EA5E9",
    orange: "#F59E0B",
    red: "#EF4444",
    green: "#10B981",
    palette: ["#1E3A8A", "#0EA5E9", "#F59E0B", "#10B981", "#EF4444", "#8B5CF6", "#F43F5E", "#14B8A6"],
    textColor: "#64748B",
    gridColor: "#F1F5F9",
    labelBg: "rgba(255, 255, 255, 0.85)",
    bgBody: "#F1F5F9",
  },
  "theme-dark": {
    primary: "#3B82F6",
    secondary: "#38BDF8",
    orange: "#FBBF24",
    red: "#F87171",
    green: "#34D399",
    palette: ["#3B82F6", "#38BDF8", "#FBBF24", "#34D399", "#F87171", "#A78BFA", "#FB7185", "#2DD4BF"],
    textColor: "#94A3B8",
    gridColor: "#334155",
    labelBg: "rgba(30, 41, 59, 0.85)",
    bgBody: "#0F172A",
  },
  "theme-emerald": {
    primary: "#064E3B",
    secondary: "#10B981",
    orange: "#F59E0B",
    red: "#EF4444",
    green: "#059669",
    palette: ["#064E3B", "#10B981", "#047857", "#34D399", "#A7F3D0", "#F59E0B", "#EF4444", "#3B82F6"],
    textColor: "#10B981",
    gridColor: "#D1FAE5",
    labelBg: "rgba(240, 253, 244, 0.9)",
    bgBody: "#F1F5F9",
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
