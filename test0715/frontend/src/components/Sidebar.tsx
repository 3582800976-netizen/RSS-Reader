import { Feed } from "../api";
import { ListView } from "../prefs";

type Props = {
  feeds: Feed[];
  selectedFeedId: number | null;
  listView: ListView;
  feedUrl: string;
  busy: boolean;
  onFeedUrlChange: (v: string) => void;
  onAddFeed: (e: React.FormEvent) => void;
  onSelectFeed: (id: number | null) => void;
  onListView: (v: ListView) => void;
  onSyncFeed: (id: number) => void;
  onDeleteFeed: (id: number) => void;
};

export default function Sidebar({
  feeds,
  selectedFeedId,
  listView,
  feedUrl,
  busy,
  onFeedUrlChange,
  onAddFeed,
  onSelectFeed,
  onListView,
  onSyncFeed,
  onDeleteFeed,
}: Props) {
  return (
    <aside className="pane feeds">
      <div className="pane-head">订阅源</div>

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
                onClick={() => onDeleteFeed(f.id)}
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
