import { useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { api, Entry, TranslationParagraph } from "../api";
import MarkdownBody from "./MarkdownBody";
import {
  formatDate,
  loadTranslateLanguage,
  ReadingMode,
  saveTranslateLanguage,
  TRANSLATE_LANGUAGES,
} from "../prefs";

type Props = {
  entry: Entry | null;
  mode: ReadingMode;
  busy: boolean;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onStatus?: (msg: string) => void;
};

function WebFrame({ url }: { url: string }) {
  return (
    <div className="web-frame-wrap">
      <iframe
        className="web-frame"
        src={url}
        title="原文网页"
        sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
      />
      <div className="web-frame-hint">
        若页面空白（部分站点禁止嵌入），请
        <a href={url} target="_blank" rel="noreferrer">
          在新窗口打开
        </a>
      </div>
    </div>
  );
}

function ReaderBody({ entry }: { entry: Entry }) {
  const html = useMemo(() => {
    if (!entry.summary) return "";
    return DOMPurify.sanitize(entry.summary);
  }, [entry.summary]);

  if (!html) {
    return <p className="muted">该条目无摘要正文，请切换到「网页」或打开原文。</p>;
  }
  return <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />;
}

function renderMarkdown(text: string): string {
  const html = marked.parse(text, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html);
}

function SummaryBody({ text, streaming }: { text: string; streaming: boolean }) {
  const html = useMemo(() => (text ? renderMarkdown(text) : ""), [text]);
  if (!text) {
    return <>{streaming ? "…" : "点击上方「摘要」或「重新生成」。"}</>;
  }
  return <div className="summary-md" dangerouslySetInnerHTML={{ __html: html }} />;
}

function BilingualBody({
  paragraphs,
  busy,
  onRetry,
}: {
  paragraphs: TranslationParagraph[];
  busy: boolean;
  onRetry: (p: TranslationParagraph) => void;
}) {
  return (
    <div className="bilingual">
      {paragraphs.map((p) => (
        <div className="bilingual-row" key={p.paragraph_index}>
          <div className="bilingual-orig">{p.original_text}</div>
          <div className={`bilingual-trans ${p.status === "failed" ? "failed" : ""}`}>
            {p.status === "failed" ? (
              <div className="retry-wrap">
                <span>本段翻译失败</span>
                <button type="button" className="ghost" disabled={busy} onClick={() => onRetry(p)}>
                  重试
                </button>
              </div>
            ) : (
              p.translated_text
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReaderPane({
  entry,
  mode,
  busy,
  onToggleStar,
  onToggleRead,
  onStatus,
}: Props) {
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryStreaming, setSummaryStreaming] = useState(false);
  const [detailLevel, setDetailLevel] = useState<"concise" | "detailed">("concise");
  const [bilingual, setBilingual] = useState(false);
  const [paragraphs, setParagraphs] = useState<TranslationParagraph[]>([]);
  const [translatedLang, setTranslatedLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string>(() => loadTranslateLanguage());
  const [aiBusy, setAiBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSummaryText("");
    setSummaryOpen(false);
    setSummaryStreaming(false);
    setBilingual(false);
    setParagraphs([]);
    setTranslatedLang(null);
    if (!entry) return;
    api
      .getCachedSummary(entry.id)
      .then((s) => {
        if (s?.summary_text) setSummaryText(s.summary_text);
      })
      .catch(() => undefined);
    api
      .getTranslation(entry.id)
      .then((t) => {
        if (t?.paragraphs?.length) {
          setParagraphs(t.paragraphs);
          if (t.target_language) {
            setTranslatedLang(t.target_language);
            setTargetLang(t.target_language);
          }
        }
      })
      .catch(() => undefined);
    api.getReadingPrefs()
      .then((prefs) => { if (prefs.split_ratio) setSplitRatio(prefs.split_ratio); })
      .catch(() => undefined);
  }, [entry?.id]);

  if (!entry) {
    return (
      <section className="pane detail">
        <div className="pane-head">阅读</div>
        <div className="empty-detail">
          <p>选择一篇文章开始阅读</p>
        </div>
      </section>
    );
  }

  async function runSummary(force = false) {
    setSummaryOpen(true);
    setSummaryStreaming(true);
    setSummaryText("");
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      await api.streamSummary(
        {
          entry_id: entry.id,
          detail_level: detailLevel,
          force,
        },
        {
          onDelta: (t) => setSummaryText((prev) => prev + t),
          onDone: () => onStatus?.("摘要完成"),
          onError: (err) => onStatus?.(err),
        },
        ac.signal
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onStatus?.(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setSummaryStreaming(false);
    }
  }

  async function runTranslate(force = false, language = targetLang) {
    setAiBusy(true);
    onStatus?.(`正在翻译为 ${language}…`);
    try {
      const needForce = force || (!!translatedLang && translatedLang !== language);
      const t = await api.translateEntry({
        entry_id: entry.id,
        target_language: language,
        force: needForce || force,
      });
      setParagraphs(t.paragraphs);
      setTranslatedLang(t.target_language || language);
      setBilingual(true);
      const failed = t.paragraphs.filter((p) => p.status === "failed").length;
      onStatus?.(
        failed
          ? `翻译完成（${language}），${failed} 段失败可重试`
          : `翻译完成（${language}）：${t.paragraphs.length} 段`
      );
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  async function retryParagraph(p: TranslationParagraph) {
    setAiBusy(true);
    try {
      const updated = await api.retryTranslation({
        entry_id: entry.id,
        paragraph_index: p.paragraph_index,
        original_text: p.original_text || undefined,
        target_language: targetLang,
      });
      setParagraphs((prev) =>
        prev.map((x) => (x.paragraph_index === updated.paragraph_index ? updated : x))
      );
      onStatus?.(`第 ${p.paragraph_index + 1} 段重试成功`);
    } catch (e) {
      onStatus?.(e instanceof Error ? e.message : String(e));
    } finally {
      setAiBusy(false);
    }
  }

  function onSplitMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setDragging(true);
    const startX = e.clientX;
    const startRatio = splitRatio;
    function onMove(ev: MouseEvent) {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = ev.clientX - startX;
      const newRatio = Math.min(0.85, Math.max(0.15, startRatio + dx / rect.width));
      setSplitRatio(newRatio);
    }
    function onUp() {
      setDragging(false);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setSplitRatio((r) => { api.saveReadingPrefs({ split_ratio: r }).catch(() => undefined); return r; });
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  const locked = busy || aiBusy || summaryStreaming;
  const langChanged = !!paragraphs.length && !!translatedLang && translatedLang !== targetLang;

  return (
    <section className="pane detail">
      <div className="pane-head row">
        <span>阅读</span>
        <div className="detail-actions">
          <button
            type="button"
            className="ghost"
            disabled={locked}
            onClick={() => runSummary(false)}
          >
            摘要
          </button>
          <select
            className="ai-lang"
            title="翻译目标语言"
            disabled={locked}
            value={targetLang}
            onChange={(e) => {
              const lang = e.target.value;
              setTargetLang(lang);
              saveTranslateLanguage(lang);
            }}
          >
            {TRANSLATE_LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`ghost ${bilingual ? "active-ai" : ""}`}
            disabled={locked}
            onClick={() => {
              if (bilingual) {
                setBilingual(false);
                return;
              }
              if (paragraphs.length && !langChanged) {
                setBilingual(true);
                return;
              }
              runTranslate(langChanged, targetLang);
            }}
          >
            {bilingual ? "清除翻译" : "翻译对照"}
          </button>
          {paragraphs.length || bilingual ? (
            <button
              type="button"
              className="ghost"
              disabled={locked}
              title="按当前目标语言重新生成翻译"
              onClick={() => runTranslate(true, targetLang)}
            >
              重新翻译
            </button>
          ) : null}
          <button
            type="button"
            className={`ghost ${entry.is_starred ? "star-on" : ""}`}
            disabled={busy}
            onClick={onToggleStar}
          >
            {entry.is_starred ? "★ 已收藏" : "☆ 收藏"}
          </button>
          <button type="button" className="ghost" disabled={busy} onClick={onToggleRead}>
            {entry.is_read ? "标为未读" : "标为已读"}
          </button>
          {entry.url ? (
            <a className="ghost link" href={entry.url} target="_blank" rel="noreferrer">
              打开原文
            </a>
          ) : null}
        </div>
      </div>

      {mode === "web" && entry.url ? (
        <WebFrame url={entry.url} />
      ) : mode === "dual" && entry.url ? (
        <div className={`dual ${dragging ? "dragging" : ""}`} ref={containerRef}>
          <article className="article" style={{ flex: `0 0 ${splitRatio * 100}%` }}>
            <h1>{entry.title}</h1>
            <div className="article-meta">
              <span>{entry.feed_title}</span>
              {entry.author ? <span>{entry.author}</span> : null}
              <span>{formatDate(entry.published_at)}</span>
            </div>
            {bilingual && paragraphs.length ? (
              <BilingualBody paragraphs={paragraphs} busy={locked} onRetry={retryParagraph} />
            ) : (
              <MarkdownBody entryId={entry.id} />
            )}
          </article>
          <div className="split-resizer" onMouseDown={onSplitMouseDown} />
          <div className="web-frame-wrap" style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}>
            <iframe
              className="web-frame"
              src={entry.url}
              title="原文网页"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            <div className="web-frame-hint">
              若页面空白（部分站点禁止嵌入），请
              <a href={entry.url} target="_blank" rel="noreferrer">在新窗口打开</a>
            </div>
          </div>
        </div>
      ) : (
        <article className="article">
          <h1>{entry.title}</h1>
          <div className="article-meta">
            <span>{entry.feed_title}</span>
            {entry.author ? <span>{entry.author}</span> : null}
            <span>{formatDate(entry.published_at)}</span>
          </div>
          {mode === "web" && !entry.url ? (
            <p className="muted">该条目没有原文链接。</p>
          ) : bilingual && paragraphs.length ? (
            <BilingualBody paragraphs={paragraphs} busy={locked} onRetry={retryParagraph} />
          ) : (
            <MarkdownBody entryId={entry.id} />
          )}
        </article>
      )}

      <div className={`summary-dock ${summaryOpen ? "open" : ""}`}>
        <button
          type="button"
          className="summary-toggle"
          onClick={() => setSummaryOpen((v) => !v)}
        >
          摘要 {summaryOpen ? "▾" : "▴"}
        </button>
        {summaryOpen ? (
          <div className="summary-panel">
            <div className="summary-toolbar">
              <select
                value={detailLevel}
                disabled={locked}
                onChange={(e) => setDetailLevel(e.target.value as "concise" | "detailed")}
              >
                <option value="concise">简洁</option>
                <option value="detailed">详细</option>
              </select>
              <button type="button" className="primary" disabled={locked} onClick={() => runSummary(true)}>
                {summaryStreaming ? "生成中…" : "重新生成"}
              </button>
            </div>
            <div className="summary-body">
              <SummaryBody text={summaryText} streaming={summaryStreaming} />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
