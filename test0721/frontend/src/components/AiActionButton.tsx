import { useState, useRef } from "react";

type Props = {
  label: string;
  lang: string;
  languages: { value: string; label: string }[];
  disabled?: boolean;
  /** 为 false 时不显示悬停语言菜单（如「清除翻译」） */
  enableMenu?: boolean;
  onRun: (lang: string) => void;
  onLangChange: (lang: string) => void;
};

export default function AiActionButton({
  label,
  lang,
  languages,
  disabled,
  enableMenu = true,
  onRun,
  onLangChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function handleEnter() {
    if (!enableMenu || disabled) return;
    setOpen(true);
  }

  function handleLeave(e: React.MouseEvent) {
    if (!enableMenu) return;
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`ai-action ${open ? "open" : ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className="ghost"
        disabled={disabled}
        onClick={() => onRun(lang)}
      >
        {label}
      </button>

      {enableMenu ? (
        <div className="ai-action-menu" role="menu">
          {languages.map((l) => (
            <button
              key={l.value}
              type="button"
              role="menuitem"
              className={`ai-action-menu-item ${lang === l.value ? "active" : ""}`}
              onClick={() => {
                onLangChange(l.value);
                onRun(l.value);
                setOpen(false);
              }}
            >
              <span>{l.label}</span>
              {lang === l.value ? <span>✓</span> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
