import { useState } from "react";
import { Feed } from "../api";
import { ListView } from "../prefs";
import ConfirmModal from "./ConfirmModal";

type Props = {
  feeds: Feed[];
  selectedFeedId: number | null;
  listView: ListView;
  feedUrl: string;
  busy: boolean;
  style?: React.CSSProperties;
  onFeedUrlChange: (v: string) => void;
  onAddFeed: (e: React.FormEvent) => void;
  onSelectFeed: (id: number | null) => void;
  onListView: (v: ListView) => void;
  onSyncFeed: (id: number) => void;
  onDeleteFeed: (id: number) => void;
  onImportOpml: () => void;
  onExportOpml: () => void;
};

export default function Sidebar({
  feeds,
  selectedFeedId,
  listView,
  feedUrl,
  busy,
  style,
  onFeedUrlChange,
  onAddFeed,
  onSelectFeed,
  onListView,
  onSyncFeed,
  onDeleteFeed,
  onImportOpml,
  onExportOpml,
}: Props) {
  const [feedToDelete, setFeedToDelete] = useState<Feed | null>(null);

  return (
    <aside className="pane feeds" style={style}>
      <div className="pane-head row">
        <span>订阅源</span>
        <div className="feed-head-actions">
          <button
            type="button"
            className="opml-btn"
            title="导入 OPML"
            disabled={busy}
            onClick={onImportOpml}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6M9 15h6M12 12v6M9.5 14.5 12 17l2.5-2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>导入</span>
          </button>
          <button
            type="button"
            className="opml-btn"
            title="导出 OPML"
            disabled={busy}
            onClick={onExportOpml}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden>
              <path
                d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M14 2v6h6M9 15h6M12 18v-6M9.5 15.5 12 12l2.5 3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>导出</span>
          </button>
        </div>
      </div>

      <div className="view-tabs">
        {(
          [
            ["all", "全部"],
            ["unread", "未读"],
            ["starred", "收藏"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={listView === id ? "active" : ""}
            onClick={() => onListView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <form className="add-feed" onSubmit={onAddFeed}>
        <input
          value={feedUrl}
          onChange={(e) => onFeedUrlChange(e.target.value)}
          placeholder="粘贴 Feed URL…"
          disabled={busy}
        />
        <button type="submit" disabled={busy || !feedUrl.trim()}>
          +
        </button>
      </form>

      <button
        type="button"
        className={`feed-item ${selectedFeedId === null ? "active" : ""}`}
        onClick={() => onSelectFeed(null)}
      >
        <span className="feed-title">全部文章</span>
      </button>

      <ul className="feed-list">
        {feeds.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className={`feed-item ${selectedFeedId === f.id ? "active" : ""}`}
              onClick={() => onSelectFeed(f.id)}
            >
              <span className="feed-title" title={f.feed_url}>
                {f.title}
              </span>
              {f.unread_count > 0 ? <span className="badge">{f.unread_count}</span> : null}
            </button>
            <div className="feed-ops">
              <button type="button" disabled={busy} onClick={() => onSyncFeed(f.id)}>
                同步
              </button>
              <button
                type="button"
                className="danger"
                disabled={busy}
                onClick={() => setFeedToDelete(f)}
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>

      <ConfirmModal
        open={feedToDelete !== null}
        title="确认删除订阅源"
        message={
          feedToDelete
            ? `确定要删除「${feedToDelete.title}」吗？该订阅源下的文章也将被移除。`
            : ""
        }
        confirmText="删除"
        cancelText="取消"
        onConfirm={() => {
          if (feedToDelete) {
            onDeleteFeed(feedToDelete.id);
          }
        }}
        onClose={() => setFeedToDelete(null)}
      />
    </aside>
  );
}
