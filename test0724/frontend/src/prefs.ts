export type ThemeMode = "dark" | "light" | "sepia" | "github";
export type FontSize = "S" | "M" | "L";
export type ReadingMode = "reader" | "web" | "dual";
export type ListView = "all" | "unread" | "starred";

const THEME_KEY = "rss-theme";
const FONT_KEY = "rss-font";
const MODE_KEY = "rss-reading-mode";
const TRANSLATE_LANG_KEY = "rss-translate-lang";
const SUMMARY_LANG_KEY = "rss-summary-lang";
const MARK_READ_DELAY_KEY = "rss-mark-read-delay";

const MARK_READ_DELAY_MIN = 0;
const MARK_READ_DELAY_MAX = 10;

/** Shared options; summary & translation pick independently. */
export const AI_LANGUAGES: { value: string; label: string }[] = [
  { value: "Chinese", label: "中文" },
  { value: "English", label: "English" },
  { value: "Japanese", label: "日本語" },
  { value: "Korean", label: "한국어" },
  { value: "French", label: "Français" },
  { value: "German", label: "Deutsch" },
  { value: "Spanish", label: "Español" },
  { value: "Portuguese", label: "Português" },
  { value: "Russian", label: "Русский" },
  { value: "Arabic", label: "العربية" },
];

/** @deprecated use AI_LANGUAGES */
export const TRANSLATE_LANGUAGES = AI_LANGUAGES;

export function loadTranslateLanguage(): string {
  const v = localStorage.getItem(TRANSLATE_LANG_KEY);
  if (v && AI_LANGUAGES.some((x) => x.value === v)) return v;
  return "Chinese";
}

export function saveTranslateLanguage(lang: string) {
  localStorage.setItem(TRANSLATE_LANG_KEY, lang);
}

export function loadSummaryLanguage(): string {
  const v = localStorage.getItem(SUMMARY_LANG_KEY);
  if (v && AI_LANGUAGES.some((x) => x.value === v)) return v;
  return "Chinese";
}

export function saveSummaryLanguage(lang: string) {
  localStorage.setItem(SUMMARY_LANG_KEY, lang);
}

const VALID_THEMES: ThemeMode[] = ["dark", "light", "sepia", "github"];

export function loadTheme(): ThemeMode {
  const v = localStorage.getItem(THEME_KEY);
  return VALID_THEMES.includes(v as ThemeMode) ? (v as ThemeMode) : "dark";
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

export function loadMarkReadDelay(): number {
  const raw = localStorage.getItem(MARK_READ_DELAY_KEY);
  if (raw === null) return MARK_READ_DELAY_MIN;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return MARK_READ_DELAY_MIN;
  return Math.min(MARK_READ_DELAY_MAX, Math.max(MARK_READ_DELAY_MIN, n));
}

export function saveMarkReadDelay(sec: number) {
  const clamped = Math.min(
    MARK_READ_DELAY_MAX,
    Math.max(MARK_READ_DELAY_MIN, Math.round(sec)),
  );
  localStorage.setItem(MARK_READ_DELAY_KEY, String(clamped));
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
