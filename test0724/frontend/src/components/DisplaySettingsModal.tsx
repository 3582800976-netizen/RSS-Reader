import { FontSize, ThemeMode } from "../prefs";

type Props = {
  open: boolean;
  theme: ThemeMode;
  fontSize: FontSize;
  markReadDelay: number;
  onClose: () => void;
  onThemeChange: (theme: ThemeMode) => void;
  onFontCycle: () => void;
  onMarkReadDelayChange: (seconds: number) => void;
};

const THEME_OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "dark", label: "深色" },
  { value: "light", label: "浅色" },
  { value: "sepia", label: "怀旧" },
  { value: "github", label: "GitHub" },
];

const FONT_OPTIONS: { value: FontSize; label: string }[] = [
  { value: "S", label: "小" },
  { value: "M", label: "中" },
  { value: "L", label: "大" },
];

export default function DisplaySettingsModal({
  open,
  theme,
  fontSize,
  markReadDelay,
  onClose,
  onThemeChange,
  onFontCycle,
  onMarkReadDelayChange,
}: Props) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="显示设置"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>显示设置</h2>
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>

        <section className="modal-section">
          <h3>字号</h3>
          <div className="display-settings-options">
            {FONT_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`display-option-btn ${fontSize === opt.value ? "active" : ""}`}
                onClick={() => {
                  const currentIdx = FONT_OPTIONS.findIndex((o) => o.value === fontSize);
                  const targetIdx = FONT_OPTIONS.findIndex((o) => o.value === opt.value);
                  const steps = (targetIdx - currentIdx + FONT_OPTIONS.length) % FONT_OPTIONS.length;
                  for (let i = 0; i < steps; i++) {
                    onFontCycle();
                  }
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="modal-section">
          <h3>主题</h3>
          <div className="display-settings-options">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`display-option-btn ${theme === opt.value ? "active" : ""}`}
                onClick={() => onThemeChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        <section className="modal-section">
          <h3>已读设置</h3>
          <div
            className={`mark-read-delay-row ${markReadDelay === 0 ? "mark-read-delay--instant" : ""}`}
          >
            <input
              type="range"
              className="mark-read-delay-slider"
              min={0}
              max={10}
              step={1}
              value={markReadDelay}
              aria-label="标记已读延迟（秒）"
              onChange={(e) => onMarkReadDelayChange(Number(e.target.value))}
            />
            <span className="mark-read-delay-value">
              {markReadDelay === 0 ? "立即" : `${markReadDelay} 秒`}
            </span>
          </div>
          <div className="mark-read-delay-hint-slot" aria-live="polite">
            <p
              className={`mark-read-delay-hint ${markReadDelay !== 0 ? "mark-read-delay-hint--hidden" : ""}`}
            >
              点击后立即标记为已读
            </p>
            <p
              className={`mark-read-delay-hint ${markReadDelay === 0 ? "mark-read-delay-hint--hidden" : ""}`}
            >
              {markReadDelay === 0
                ? "阅读未满 10 秒就切换文章时，不会标记为已读"
                : `阅读未满 ${markReadDelay} 秒就切换文章时，不会标记为已读`}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
