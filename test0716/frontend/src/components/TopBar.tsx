import { ReadingMode } from "../prefs";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  busy: boolean;
  readingMode: ReadingMode;
  onReadingMode: (m: ReadingMode) => void;
  onSyncAll: () => void;
  onOpenAiSettings: () => void;
  onOpenDisplaySettings: () => void;
};

export default function TopBar({
  search,
  onSearchChange,
  busy,
  readingMode,
  onReadingMode,
  onSyncAll,
  onOpenAiSettings,
  onOpenDisplaySettings,
}: Props) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark" aria-hidden />
        <div className="brand-text">
          <strong>Mercury Web</strong>
          <span>本地 RSS</span>
        </div>
      </div>

      <div className="search-wrap">
        <svg className="search-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          className="search-input"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="搜索文章…"
          disabled={busy}
        />
      </div>

      <div className="seg" role="group" aria-label="阅读模式">
        {(
          [
            ["reader", "阅读"],
            ["web", "网页"],
            ["dual", "双栏"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={readingMode === id ? "active" : ""}
            onClick={() => onReadingMode(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="top-actions">
        <button
          type="button"
          className="ghost"
          onClick={onOpenDisplaySettings}
          title="显示设置"
        >
          显示设置
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={onOpenAiSettings}>
          AI 设置
        </button>
        <button type="button" className="primary" disabled={busy} onClick={onSyncAll}>
          同步全部
        </button>
      </div>
    </header>
  );
}
