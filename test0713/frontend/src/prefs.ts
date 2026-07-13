export type ThemeMode = "dark" | "light";
export type FontSize = "S" | "M" | "L";
export type ReadingMode = "reader" | "web" | "dual";
export type ListView = "all" | "unread" | "starred";

const THEME_KEY = "rss-theme";
const FONT_KEY = "rss-font";
const MODE_KEY = "rss-reading-mode";

export function loadTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY);
  return v === "light" ? "light" : "dark";
}

export function saveTheme(theme: ThemeMode) {
  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute("data-theme", theme);
}

export function loadFontSize(): FontSize {
  const v = localStorage.getItem(FONT_KEY);
  return v === "S" || v === "L" ? v : "M";
}

export function saveFontSize(size: FontSize) {
  localStorage.setItem(FONT_KEY, size);
  document.documentElement.setAttribute("data-font", size);
}

export function loadReadingMode(): ReadingMode {
  const v = localStorage.getItem(MODE_KEY);
  return v === "web" || v === "dual" ? v : "reader";
}

export function saveReadingMode(mode: ReadingMode) {
  localStorage.setItem(MODE_KEY, mode);
}

export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "从未";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "刚刚";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;
  return new Date(iso).toLocaleString();
}

export function formatDate(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
