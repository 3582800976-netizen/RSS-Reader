import { useMemo } from "react";
import DOMPurify from "dompurify";
import { Entry } from "../api";
import { formatDate, ReadingMode } from "../prefs";

type Props = {
  entry: Entry | null;
  mode: ReadingMode;
  busy: boolean;
  onToggleStar: () => void;
  onToggleRead: () => void;
};

function WebFrame({ url }: { url: string }) {
  return (
    <div className="web-frame-wrap">
      <iframe className="web-frame" src={url} title="原文网页" sandbox="allow-scripts allow-same-origin allow-popups allow-forms" />
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

export default function ReaderPane({
  entry,
  mode,
  busy,
  onToggleStar,
  onToggleRead,
}: Props) {
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

  return (
    <section className="pane detail">
      <div className="pane-head row">
        <span>阅读</span>
        <div className="detail-actions">
          <button type="button" className={`ghost ${entry.is_starred ? "star-on" : ""}`} disabled={busy} onClick={onToggleStar}>
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
        <div className="dual">
          <article className="article">
            <h1>{entry.title}</h1>
            <div className="article-meta">
              <span>{entry.feed_title}</span>
              {entry.author ? <span>{entry.author}</span> : null}
              <span>{formatDate(entry.published_at)}</span>
            </div>
            <ReaderBody entry={entry} />
          </article>
          <WebFrame url={entry.url} />
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
          ) : (
            <ReaderBody entry={entry} />
          )}
        </article>
      )}
    </section>
  );
}
