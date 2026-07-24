import { useEffect, useRef, useState } from "react";

type Props = {
  label: string;
  lang: string;
  languages: { value: string; label: string }[];
  disabled?: boolean;
  /** 为 false 时不显示悬停语言菜单（如「清除翻译」） */
  enableMenu?: boolean;
  menuTrigger?: "hover" | "click";
  onRun: (lang: string) => void;
  onLangChange: (lang: string) => void;
};

export default function AiActionButton({
  label,
  lang,
  languages,
  disabled,
  enableMenu = true,
  menuTrigger = "hover",
  onRun,
  onLangChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (menuTrigger !== "click" || !open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuTrigger, open]);

  function handleEnter() {
    if (menuTrigger !== "hover" || !enableMenu || disabled) return;
    setOpen(true);
  }

  function handleLeave(e: React.MouseEvent) {
    if (menuTrigger !== "hover" || !enableMenu) return;
    const next = e.relatedTarget as Node | null;
    if (next && rootRef.current?.contains(next)) return;
    setOpen(false);
  }

  return (
    <div
      ref={rootRef}
      className={`ai-action ${menuTrigger === "click" ? "ai-action--click" : ""} ${open ? "open" : ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        className="ghost ai-action-main"
        disabled={disabled}
        onClick={() => onRun(lang)}
      >
        {label}
      </button>

      {enableMenu && menuTrigger === "click" ? (
        <button
          type="button"
          className="ghost ai-action-chevron"
          disabled={disabled}
          aria-label={`${label}：选择语言`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          ▾
        </button>
      ) : null}

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
