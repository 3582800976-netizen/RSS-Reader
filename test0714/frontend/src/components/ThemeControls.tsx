import { ThemeMode } from "../prefs";

type Props = {
  theme: ThemeMode;
  onThemeChange: (t: ThemeMode) => void;
};

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: "dark", label: "深色" },
  { key: "light", label: "浅色" },
  { key: "sepia", label: "怀旧" },
  { key: "github", label: "GitHub" },
];

export default function ThemeControls({ theme, onThemeChange }: Props) {
  return (
    <div className="theme-controls">
      {THEMES.map((t) => (
        <button
          key={t.key}
          type="button"
          className={`theme-btn ${theme === t.key ? "active" : ""}`}
          title={t.label}
          onClick={() => onThemeChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
