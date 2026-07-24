import { useEffect, useRef, useState } from "react";
import { ReadingMode } from "../prefs";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  busy: boolean;
  isNarrow: boolean;
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
  isNarrow,
  readingMode,
  onReadingMode,
  onSyncAll,
  onOpenAiSettings,
  onOpenDisplaySettings,
}: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!moreOpen) return;
    function onDoc(e: MouseEvent) {
      if (!moreRef.current?.contains(e.target as Node)) setMoreOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [moreOpen]);

  const modeSeg = (
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
  );

  const desktopActions = (
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
  );

  const narrowMore = (
    <div className="topbar-more" ref={moreRef}>
      <button
        type="button"
        className="ghost topbar-more-trigger"
        aria-expanded={moreOpen}
        aria-haspopup="menu"
        title="更多"
        onClick={() => setMoreOpen((v) => !v)}
      >
        ⋯
      </button>
      {moreOpen ? (
        <div className="topbar-more-menu" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenDisplaySettings();
              setMoreOpen(false);
            }}
          >
            显示设置
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={busy}
            onClick={() => {
              onOpenAiSettings();
              setMoreOpen(false);
            }}
          >
            AI 设置
          </button>
          <button
            type="button"
            role="menuitem"
            className="primary"
            disabled={busy}
            onClick={() => {
              onSyncAll();
              setMoreOpen(false);
            }}
          >
            同步全部
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <header className={`topbar ${isNarrow ? "topbar--narrow" : ""}`}>
      <div className="topbar-row topbar-row--brand">
        <div className="brand">
          <div className="brand-mark" aria-hidden />
          <div className="brand-text">
            <strong>{isNarrow ? "Mercury" : "Mercury Web"}</strong>
            {!isNarrow ? <span>本地 RSS</span> : null}
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
      </div>

      <div className="topbar-row topbar-row--tools">
        {modeSeg}
        {isNarrow ? narrowMore : desktopActions}
      </div>
    </header>
  );
}
