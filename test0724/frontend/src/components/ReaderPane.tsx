import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import { api, ChatMessage, Entry, TranslationParagraph } from "../api";
import AiActionButton from "./AiActionButton";
import ConfirmModal from "./ConfirmModal";
import MarkdownBody from "./MarkdownBody";
import PaneCollapseButton from "./PaneCollapseButton";
import {
  AI_LANGUAGES,
  formatDate,
  loadSummaryLanguage,
  loadTranslateLanguage,
  ReadingMode,
  saveSummaryLanguage,
  saveTranslateLanguage,
} from "../prefs";

type Props = {
  entry: Entry | null;
  mode: ReadingMode;
  busy: boolean;
  isNarrow?: boolean;
  showFocusToggle?: boolean;
  readerFocus?: boolean;
  onToggleReaderFocus?: () => void;
  onBack?: () => void;
  onToggleStar: () => void;
  onToggleRead: () => void;
  onStatus?: (msg: string) => void;
};

function ReaderHeadTitle({
  showFocusToggle,
  readerFocus,
  onToggleReaderFocus,
}: {
  showFocusToggle?: boolean;
  readerFocus?: boolean;
  onToggleReaderFocus?: () => void;
}) {
  return (
    <div className="pane-head-title-group">
      <span className="pane-head-label">阅读</span>
      {showFocusToggle ? (
        <PaneCollapseButton
          collapsed={readerFocus}
          collapseLabel="全屏阅读"
          expandLabel="恢复布局"
          onClick={onToggleReaderFocus}
        />
      ) : null}
    </div>
  );
}

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
    return (
      <p className="muted">该条目无摘要正文，请切换到「网页」或打开原文。</p>
    );
  }
  return (
    <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
  );
}

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

function newMsgId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function toApiMessages(messages: ChatMsg[]): ChatMessage[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

function renderMarkdown(text: string): string {
  const html = marked.parse(text, { breaks: true, gfm: true }) as string;
  return DOMPurify.sanitize(html);
}

const ASK_AI_BTN_W = 72;
const ASK_AI_BTN_H = 32;
const ASK_AI_GAP = 8;

function isNodeInArticle(node: Node | null): boolean {
  if (!node) return false;
  const el =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as Element)
      : node.parentElement;
  if (!el) return false;
  if (el.closest(".qa-dock")) return false;
  return !!el.closest(".article");
}

function computeAskAiPosition(range: Range): { x: number; y: number } {
  const rect = range.getBoundingClientRect();
  let x = rect.left + rect.width / 2 - ASK_AI_BTN_W / 2;
  let y = rect.top - ASK_AI_BTN_H - ASK_AI_GAP;
  x = Math.min(window.innerWidth - ASK_AI_BTN_W - 8, Math.max(8, x));
  if (y < 8) y = rect.bottom + ASK_AI_GAP;
  return { x, y };
}

function ChatBubble({
  msg,
  streaming,
}: {
  msg: ChatMsg;
  streaming?: boolean;
}) {
  const html = useMemo(
    () => (msg.role === "assistant" && msg.content ? renderMarkdown(msg.content) : ""),
    [msg.role, msg.content],
  );
  if (msg.role === "user") {
    return <div className="qa-bubble qa-bubble-user">{msg.content}</div>;
  }
  if (!msg.content) {
    return <div className="qa-bubble qa-bubble-assistant">{streaming ? "…" : ""}</div>;
  }
  return (
    <div
      className="qa-bubble qa-bubble-assistant qa-md"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
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
          <div
            className={`bilingual-trans ${p.status === "failed" ? "failed" : ""}`}
          >
            {p.status === "failed" ? (
              <div className="retry-wrap">
                <span>本段翻译失败</span>
                <button
                  type="button"
                  className="ghost"
                  disabled={busy}
                  onClick={() => onRetry(p)}
                >
                  重试
                </button>
              </div>
            ) : p.status === "pending" && !p.translated_text ? (
              "…"
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
  isNarrow = false,
  showFocusToggle = false,
  readerFocus = false,
  onToggleReaderFocus,
  onBack,
  onToggleStar,
  onToggleRead,
  onStatus,
}: Props) {
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [draft, setDraft] = useState("");
  const [summaryLang, setSummaryLang] = useState<string>(() =>
    loadSummaryLanguage(),
  );
  const [bilingual, setBilingual] = useState(false);
  const [paragraphs, setParagraphs] = useState<TranslationParagraph[]>([]);
  const [translatedLang, setTranslatedLang] = useState<string | null>(null);
  const [targetLang, setTargetLang] = useState<string>(() =>
    loadTranslateLanguage(),
  );
  const [aiBusy, setAiBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const translateAbortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [splitDragging, setSplitDragging] = useState(false);
  const [qaHeightPx, setQaHeightPx] = useState<number | null>(null);
  const [qaDragging, setQaDragging] = useState(false);
  const [askAi, setAskAi] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);
  const [confirmClearChat, setConfirmClearChat] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const detailRef = useRef<HTMLElement>(null);
  const splitStartXRef = useRef(0);
  const splitWidthRef = useRef(1);
  const qaStartYRef = useRef(0);
  const qaHeightRef = useRef(300);
  const qaMaxHeightRef = useRef(600);

  useEffect(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    translateAbortRef.current?.abort();
    translateAbortRef.current = null;
    setMessages([]);
    setDraft("");
    setChatOpen(false);
    setChatStreaming(false);
    setBilingual(false);
    setParagraphs([]);
    setTranslatedLang(null);
    setAiBusy(false);
    setAskAi(null);
    if (!entry) return;
    api
      .getChatHistory(entry.id)
      .then((h) => {
        setMessages(
          h.messages.map((m) => ({
            id: newMsgId(),
            role: m.role,
            content: m.content,
          })),
        );
      })
      .catch(() => setMessages([]));
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
    api
      .getReadingPrefs()
      .then((prefs) => {
        if (prefs.split_ratio) setSplitRatio(prefs.split_ratio);
      })
      .catch(() => undefined);
  }, [entry?.id]);

  useEffect(() => {
    if (!chatOpen) return;
    // 只在消息容器内滚动，避免 scrollIntoView 带动外层把输入栏顶出视口
    const end = chatEndRef.current;
    const scroller = end?.parentElement;
    if (scroller) {
      scroller.scrollTop = scroller.scrollHeight;
    }
  }, [messages, chatOpen, chatStreaming]);

  useEffect(() => {
    function onSelectionChange() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        setAskAi(null);
      }
    }
    document.addEventListener("selectionchange", onSelectionChange);
    return () =>
      document.removeEventListener("selectionchange", onSelectionChange);
  }, []);

  useEffect(() => {
    const el = detailRef.current;
    if (!el || !entry) return;

    function onMouseUp() {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return;

      const text = sel.toString().trim();
      if (!text) return;

      if (
        !isNodeInArticle(sel.anchorNode) ||
        !isNodeInArticle(sel.focusNode)
      ) {
        setAskAi(null);
        return;
      }

      const pos = computeAskAiPosition(sel.getRangeAt(0));
      setAskAi({ text, x: pos.x, y: pos.y });
    }

    el.addEventListener("mouseup", onMouseUp);
    return () => el.removeEventListener("mouseup", onMouseUp);
  }, [entry?.id, mode]);

  useEffect(() => {
    if (!splitDragging) return;

    let raf = 0;
    let pending = 0;

    function flush() {
      raf = 0;
      if (pending === 0) return;
      const delta = pending;
      pending = 0;
      const width = splitWidthRef.current || 1;
      setSplitRatio((r) =>
        Math.min(0.85, Math.max(0.15, r + delta / width)),
      );
    }

    function onMove(ev: MouseEvent) {
      const delta = ev.clientX - splitStartXRef.current;
      if (delta === 0) return;
      splitStartXRef.current = ev.clientX;
      pending += delta;
      if (!raf) raf = requestAnimationFrame(flush);
    }

    function onUp() {
      if (raf) {
        cancelAnimationFrame(raf);
        flush();
      }
      setSplitDragging(false);
      setSplitRatio((r) => {
        api.saveReadingPrefs({ split_ratio: r }).catch(() => undefined);
        return r;
      });
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.body.classList.add("is-col-resizing");

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.classList.remove("is-col-resizing");
    };
  }, [splitDragging]);

  useEffect(() => {
    if (!qaDragging) return;

    let raf = 0;
    let pending = 0;

    function flush() {
      raf = 0;
      if (pending === 0) return;
      const delta = pending;
      pending = 0;
      const next = Math.min(
        qaMaxHeightRef.current,
        Math.max(160, qaHeightRef.current - delta),
      );
      qaHeightRef.current = next;
      setQaHeightPx(next);
    }

    function onMove(ev: MouseEvent) {
      const delta = ev.clientY - qaStartYRef.current;
      if (delta === 0) return;
      qaStartYRef.current = ev.clientY;
      pending += delta;
      if (!raf) raf = requestAnimationFrame(flush);
    }

    function onUp() {
      if (raf) {
        cancelAnimationFrame(raf);
        flush();
      }
      setQaDragging(false);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    document.body.classList.add("is-row-resizing");

    return () => {
      if (raf) cancelAnimationFrame(raf);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.body.classList.remove("is-row-resizing");
    };
  }, [qaDragging]);

  if (!entry) {
    return (
      <section className="pane detail" ref={detailRef}>
        <div className="pane-head row">
          {onBack ? (
            <button type="button" className="back-btn" onClick={onBack}>
              ← 文章
            </button>
          ) : (
            <ReaderHeadTitle
              showFocusToggle={showFocusToggle}
              readerFocus={readerFocus}
              onToggleReaderFocus={onToggleReaderFocus}
            />
          )}
        </div>
        <div className="empty-detail">
          <p>选择一篇文章开始阅读</p>
        </div>
      </section>
    );
  }

  async function runChat(userText: string) {
    const text = userText.trim();
    if (!text || chatStreaming) return;

    setChatOpen(true);
    const userMsg: ChatMsg = { id: newMsgId(), role: "user", content: text };
    const assistantId = newMsgId();
    const nextMessages = [
      ...messages,
      userMsg,
      { id: assistantId, role: "assistant" as const, content: "" },
    ];
    setMessages(nextMessages);
    setChatStreaming(true);
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      let failed = false;
      await api.streamChat(
        {
          entry_id: entry.id,
          messages: toApiMessages([...messages, userMsg]),
        },
        {
          onDelta: (t) =>
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: m.content + t } : m,
              ),
            ),
          onError: (err) => {
            failed = true;
            onStatus?.(err);
          },
        },
        ac.signal,
      );
      if (!failed) onStatus?.("AI 回复完成");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onStatus?.(e instanceof Error ? e.message : String(e));
        setMessages((prev) => prev.filter((m) => m.id !== assistantId));
      }
    } finally {
      setChatStreaming(false);
    }
  }

  function runSummary(lang: string) {
    const label =
      AI_LANGUAGES.find((l) => l.value === lang)?.label || lang;
    void runChat(`请根据本篇文章生成${label}的摘要`);
  }

  function onChatSubmit(e: FormEvent) {
    e.preventDefault();
    const text = draft;
    setDraft("");
    void runChat(text);
  }

  async function runTranslate(force = false, language = targetLang) {
    setAiBusy(true);
    setBilingual(true);
    onStatus?.(`正在翻译为 ${language}…`);
    translateAbortRef.current?.abort();
    const ac = new AbortController();
    translateAbortRef.current = ac;
    const needForce =
      force || (!!translatedLang && translatedLang !== language);
    let latest: TranslationParagraph[] = [];
    try {
      await api.streamTranslate(
        {
          entry_id: entry.id,
          target_language: language,
          force: needForce || force,
        },
        {
          onInit: (info) => {
            latest = info.paragraphs;
            setParagraphs(info.paragraphs);
            setTranslatedLang(info.target_language || language);
            setBilingual(true);
          },
          onDelta: (index, text) => {
            setParagraphs((prev) => {
              const next = prev.map((p) =>
                p.paragraph_index === index
                  ? {
                      ...p,
                      translated_text: (p.translated_text || "") + text,
                      status: p.status === "failed" ? p.status : "pending",
                    }
                  : p,
              );
              latest = next;
              return next;
            });
          },
          onParagraph: (p) => {
            setParagraphs((prev) => {
              const next = prev.map((x) =>
                x.paragraph_index === p.paragraph_index ? p : x,
              );
              latest = next;
              return next;
            });
          },
          onDone: (info) => {
            setTranslatedLang(info.target_language || language);
            const failed = latest.filter((p) => p.status === "failed").length;
            onStatus?.(
              failed
                ? `翻译完成（${info.target_language || language}），${failed} 段失败可重试`
                : `翻译完成（${info.target_language || language}）：${latest.length} 段`,
            );
          },
          onError: (err) => onStatus?.(err),
        },
        ac.signal,
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        onStatus?.(e instanceof Error ? e.message : String(e));
      }
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
        prev.map((x) =>
          x.paragraph_index === updated.paragraph_index ? updated : x,
        ),
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
    splitStartXRef.current = e.clientX;
    splitWidthRef.current =
      containerRef.current?.getBoundingClientRect().width || 1;
    setSplitDragging(true);
  }

  function onQaResizeMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    const dockEl = (e.currentTarget as HTMLElement).closest(".qa-dock");
    qaStartYRef.current = e.clientY;
    qaHeightRef.current = dockEl?.getBoundingClientRect().height ?? 300;
    const parentH = detailRef.current?.getBoundingClientRect().height ?? 800;
    qaMaxHeightRef.current = parentH * 0.7;
    setQaDragging(true);
  }

  function handleAskAiClick() {
    if (!askAi || locked) return;
    const text = askAi.text;
    window.getSelection()?.removeAllRanges();
    setAskAi(null);
    void runChat(`根据文章解释"${text}"`);
  }

  function handleClearChat() {
    void api
      .clearChatHistory(entry.id)
      .then(() => {
        setMessages([]);
        onStatus?.("聊天记录已清空");
      })
      .catch((e) =>
        onStatus?.(e instanceof Error ? e.message : String(e)),
      );
  }

  const locked = busy || aiBusy || chatStreaming;
  const langChanged =
    !!paragraphs.length && !!translatedLang && translatedLang !== targetLang;
  const menuTrigger = isNarrow ? "click" : "hover";

  const aiActions = (
    <>
      <AiActionButton
        label="AI 摘要"
        lang={summaryLang}
        languages={AI_LANGUAGES}
        disabled={locked}
        menuTrigger={menuTrigger}
        onRun={(lang) => runSummary(lang)}
        onLangChange={(lang) => {
          setSummaryLang(lang);
          saveSummaryLanguage(lang);
        }}
      />
      <AiActionButton
        label={bilingual ? "清除翻译" : "AI 翻译"}
        lang={targetLang}
        languages={AI_LANGUAGES}
        disabled={locked}
        enableMenu={!bilingual}
        menuTrigger={menuTrigger}
        onRun={(lang) => {
          if (bilingual && lang === targetLang) {
            setBilingual(false);
            return;
          }
          setTargetLang(lang);
          saveTranslateLanguage(lang);
          runTranslate(langChanged || translatedLang !== lang, lang);
        }}
        onLangChange={(lang) => {
          setTargetLang(lang);
          saveTranslateLanguage(lang);
        }}
      />
      {bilingual ? (
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
    </>
  );

  const metaActions = (
    <>
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
    </>
  );

  return (
    <section className="pane detail" ref={detailRef}>
      {askAi ? (
        <button
          type="button"
          className="ask-ai-pop"
          style={{ left: askAi.x, top: askAi.y }}
          disabled={locked}
          aria-label="向 AI 提问选中文本"
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.preventDefault();
            handleAskAiClick();
          }}
        >
          问AI
        </button>
      ) : null}
      <div className={`pane-head ${isNarrow ? "pane-head--reader-narrow" : "row"}`}>
        {onBack ? (
          <button type="button" className="back-btn" onClick={onBack}>
            ← 文章
          </button>
        ) : (
          <ReaderHeadTitle
            showFocusToggle={showFocusToggle}
            readerFocus={readerFocus}
            onToggleReaderFocus={onToggleReaderFocus}
          />
        )}
        <div className={`detail-actions ${isNarrow ? "detail-actions--narrow" : ""}`}>
          {isNarrow ? (
            <>
              <div className="detail-actions-row detail-actions-row--ai">{aiActions}</div>
              <div className="detail-actions-row detail-actions-row--meta">{metaActions}</div>
            </>
          ) : (
            <>
              {aiActions}
              {metaActions}
            </>
          )}
        </div>
      </div>

      {mode === "web" && entry.url ? (
        <WebFrame url={entry.url} />
      ) : mode === "dual" && entry.url ? (
        <div
          className={`dual ${splitDragging ? "dragging" : ""}`}
          ref={containerRef}
        >
          <article
            className="article"
            style={{ flex: `0 0 ${splitRatio * 100}%` }}
          >
            <h1>{entry.title}</h1>
            <div className="article-meta">
              <span>{entry.feed_title}</span>
              {entry.author ? <span>{entry.author}</span> : null}
              <span>{formatDate(entry.published_at)}</span>
            </div>
            {bilingual && paragraphs.length ? (
              <BilingualBody
                paragraphs={paragraphs}
                busy={locked}
                onRetry={retryParagraph}
              />
            ) : (
              <MarkdownBody entryId={entry.id} />
            )}
          </article>
          <div
            className={`split-resizer ${splitDragging ? "dragging" : ""}`}
            onMouseDown={onSplitMouseDown}
            role="separator"
            aria-orientation="vertical"
          />
          <div
            className="web-frame-wrap"
            style={{ flex: `0 0 ${(1 - splitRatio) * 100}%` }}
          >
            <iframe
              className="web-frame"
              src={entry.url}
              title="原文网页"
              sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            />
            <div className="web-frame-hint">
              若页面空白（部分站点禁止嵌入），请
              <a href={entry.url} target="_blank" rel="noreferrer">
                在新窗口打开
              </a>
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
            <BilingualBody
              paragraphs={paragraphs}
              busy={locked}
              onRetry={retryParagraph}
            />
          ) : (
            <MarkdownBody entryId={entry.id} />
          )}
        </article>
      )}

      <div
        className={`qa-dock ${chatOpen ? "open" : ""}`}
        style={
          chatOpen
            ? { height: qaHeightPx != null ? `${qaHeightPx}px` : "50%" }
            : undefined
        }
      >
        {chatOpen ? (
          <div
            className={`qa-resizer ${qaDragging ? "dragging" : ""}`}
            onMouseDown={onQaResizeMouseDown}
            role="separator"
            aria-orientation="horizontal"
            aria-label="调整问答区高度"
          />
        ) : null}
        <div className="qa-toggle-row">
          <button
            type="button"
            className="qa-toggle"
            onClick={() => setChatOpen((v) => !v)}
          >
            AI 问答 {chatOpen ? "▾" : "▴"}
          </button>
          {chatOpen ? (
            <button
              type="button"
              className="ghost danger-text qa-clear-btn"
              disabled={locked || messages.length === 0}
              onClick={() => setConfirmClearChat(true)}
            >
              清空记录
            </button>
          ) : null}
        </div>
        {chatOpen ? (
          <div className="qa-panel">
            <div className="qa-messages">
              {messages.length === 0 ? (
                <p className="muted qa-empty">
                  在此向 AI 提问，或点击上方「AI 摘要」生成摘要。
                </p>
              ) : (
                messages.map((m, i) => (
                  <ChatBubble
                    key={m.id}
                    msg={m}
                    streaming={
                      chatStreaming &&
                      m.role === "assistant" &&
                      i === messages.length - 1
                    }
                  />
                ))
              )}
              <div ref={chatEndRef} />
            </div>
            <form className="qa-input-row" onSubmit={onChatSubmit}>
              <input
                type="text"
                className="qa-input"
                placeholder="输入问题，Enter 发送"
                value={draft}
                disabled={locked}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button
                type="submit"
                className="primary"
                disabled={locked || !draft.trim()}
              >
                {chatStreaming ? "…" : "发送"}
              </button>
            </form>
          </div>
        ) : null}
      </div>
      <ConfirmModal
        open={confirmClearChat}
        title="确认清空聊天记录"
        message="将删除本文与 AI 的全部聊天记录和历史记忆，此操作不可恢复。"
        confirmText="清空"
        onConfirm={handleClearChat}
        onClose={() => setConfirmClearChat(false)}
      />
    </section>
  );
}
