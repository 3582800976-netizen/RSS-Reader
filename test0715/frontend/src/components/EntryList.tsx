import { Entry } from "../api";
import { formatDate } from "../prefs";

type Props = {
  entries: Entry[];
  selectedId: number | null;
  busy: boolean;
  onSelect: (entry: Entry) => void;
  onToggleStar: (entry: Entry) => void;
  onMarkAllRead: () => void;
};

export default function EntryList({
  entries,
  selectedId,
  busy,
  onSelect,
  onToggleStar,
  onMarkAllRead,
}: Props) {
  return (
    <section className="pane entries">
      <div className="pane-head row">
        <span>文章</span>
        <button type="button" className="text-btn" disabled={busy} onClick={onMarkAllRead}>
          全部标为已读
        </button>
      </div>
      <ul className="entry-list">
        {entries.map((entry) => (
          <li key={entry.id}>
            <div
              className={`entry-item ${selectedId === entry.id ? "active" : ""} ${entry.is_read ? "read" : ""}`}
            >
              <button type="button" className="entry-main" onClick={() => onSelect(entry)}>
                <div className="entry-title-row">
                  {!entry.is_read ? <span className="unread-dot" /> : <span className="unread-spacer" />}
                  <span className="entry-title">{entry.title}</span>
                </div>
                <div className="entry-meta">
                  <span>{entry.feed_title}</span>
                  <span>{formatDate(entry.published_at)}</span>
                </div>
              </button>
              <button
                type="button"
                className={`star-btn ${entry.is_starred ? "on" : ""}`}
                title={entry.is_starred ? "取消收藏" : "收藏"}
                onClick={() => onToggleStar(entry)}
              >
                ★
              </button>
            </div>
          </li>
        ))}
        {entries.length === 0 ? <li className="empty">没有匹配的文章</li> : null}
      </ul>
    </section>
  );
}
