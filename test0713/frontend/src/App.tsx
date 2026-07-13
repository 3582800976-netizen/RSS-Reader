import { useCallback, useEffect, useRef, useState } from "react";
import { api, Entry, Feed, Stats } from "./api";
import AgentSettingsModal from "./components/AgentSettingsModal";
import EntryList from "./components/EntryList";
import ReaderPane from "./components/ReaderPane";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import {
  FontSize,
  ListView,
  ReadingMode,
  ThemeMode,
  loadFontSize,
  loadReadingMode,
  loadTheme,
  saveFontSize,
  saveReadingMode,
  saveTheme,
} from "./prefs";

export default function App() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [selectedFeedId, setSelectedFeedId] = useState<number | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [listView, setListView] = useState<ListView>("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [theme, setTheme] = useState<ThemeMode>(() => loadTheme());
  const [fontSize, setFontSize] = useState<FontSize>(() => loadFontSize());
  const [readingMode, setReadingMode] = useState<ReadingMode>(() => loadReadingMode());
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    saveFontSize(fontSize);
  }, [fontSize]);

  useEffect(() => {
    saveReadingMode(readingMode);
  }, [readingMode]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const refreshFeeds = useCallback(async () => {
    setFeeds(await api.listFeeds());
  }, []);

  const refreshStats = useCallback(async () => {
    setStats(await api.getStats());
  }, []);

  const refreshEntries = useCallback(async () => {
    const params: Parameters<typeof api.listEntries>[0] = {
      feed_id: selectedFeedId,
      q: debouncedSearch || null,
      limit: 100,
    };
    if (listView === "unread") params.is_read = false;
    if (listView === "starred") params.is_starred = true;
    const list = await api.listEntries(params);
    setEntries(list);
    setSelectedEntry((prev) => {
      if (!prev) return null;
      return list.find((e) => e.id === prev.id) ?? null;
    });
  }, [selectedFeedId, listView, debouncedSearch]);

  const reload = useCallback(async () => {
    await Promise.all([refreshFeeds(), refreshEntries(), refreshStats()]);
  }, [refreshFeeds, refreshEntries, refreshStats]);

  useEffect(() => {
    reload().catch((e) => setStatus(String(e.message || e)));
  }, [reload]);

  async function withBusy(fn: () => Promise<void>, okMsg?: string) {
    setBusy(true);
    setStatus("");
    try {
      await fn();
      if (okMsg) setStatus(okMsg);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function patchLocalEntry(updated: Entry) {
    setSelectedEntry((prev) => (prev?.id === updated.id ? updated : prev));
    setEntries((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
  }

  return (
    <div className="app">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        busy={busy}
        theme={theme}
        fontSize={fontSize}
        readingMode={readingMode}
        onThemeToggle={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
        onFontCycle={() =>
          setFontSize((s) => (s === "S" ? "M" : s === "M" ? "L" : "S"))
        }
        onReadingMode={setReadingMode}
        onSyncAll={() =>
          withBusy(async () => {
            const r = await api.syncAll();
            await reload();
            setStatus(`同步完成：成功 ${r.ok_count}，失败 ${r.fail_count}，新增 ${r.inserted_total}`);
          })
        }
        onImportOpml={() => fileRef.current?.click()}
        onExportOpml={() => withBusy(() => api.exportOpml(), "已导出 OPML")}
        onOpenAiSettings={() => setAiSettingsOpen(true)}
      />

      <AgentSettingsModal open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />

      <input
        ref={fileRef}
        type="file"
        accept=".opml,.xml,text/xml"
        hidden
        onChange={(ev) => {
          const file = ev.target.files?.[0];
          ev.target.value = "";
          if (!file) return;
          withBusy(async () => {
            const r = await api.importOpml(file);
            await api.syncAll();
            await reload();
            setStatus(`OPML 导入：新增 ${r.imported}，跳过 ${r.skipped}，已同步`);
          });
        }}
      />

      <div className="layout">
        <Sidebar
          feeds={feeds}
          selectedFeedId={selectedFeedId}
          listView={listView}
          feedUrl={feedUrl}
          busy={busy}
          onFeedUrlChange={setFeedUrl}
          onAddFeed={(e) => {
            e.preventDefault();
            if (!feedUrl.trim()) return;
            withBusy(async () => {
              const feed = await api.addFeed(feedUrl.trim());
              setFeedUrl("");
              setSelectedFeedId(feed.id);
              await reload();
              setStatus(`已添加：${feed.title}`);
            });
          }}
          onSelectFeed={(id) => {
            setSelectedFeedId(id);
            setSelectedEntry(null);
          }}
          onListView={(v) => {
            setListView(v);
            setSelectedEntry(null);
          }}
          onSyncFeed={(id) =>
            withBusy(async () => {
              await api.syncFeed(id);
              await reload();
              setStatus("单源同步完成");
            })
          }
          onDeleteFeed={(id) =>
            withBusy(async () => {
              await api.deleteFeed(id);
              if (selectedFeedId === id) setSelectedFeedId(null);
              setSelectedEntry(null);
              await reload();
              setStatus("已删除订阅源");
            })
          }
        />

        <EntryList
          entries={entries}
          selectedId={selectedEntry?.id ?? null}
          busy={busy}
          onSelect={(entry) => {
            setSelectedEntry(entry);
            if (!entry.is_read) {
              api
                .patchEntry(entry.id, { is_read: true })
                .then((updated) => {
                  patchLocalEntry(updated);
                  refreshFeeds();
                  refreshStats();
                })
                .catch(() => undefined);
            }
          }}
          onToggleStar={(entry) =>
            withBusy(async () => {
              const updated = await api.patchEntry(entry.id, {
                is_starred: !entry.is_starred,
              });
              patchLocalEntry(updated);
              await Promise.all([refreshEntries(), refreshStats()]);
            })
          }
          onMarkAllRead={() =>
            withBusy(async () => {
              const r = await api.markAllRead(selectedFeedId);
              await reload();
              setStatus(`已标为已读：${r.updated} 篇`);
            })
          }
        />

        <ReaderPane
          entry={selectedEntry}
          mode={readingMode}
          busy={busy}
          onStatus={setStatus}
          onToggleStar={() => {
            if (!selectedEntry) return;
            withBusy(async () => {
              const updated = await api.patchEntry(selectedEntry.id, {
                is_starred: !selectedEntry.is_starred,
              });
              patchLocalEntry(updated);
              await Promise.all([refreshEntries(), refreshStats()]);
            });
          }}
          onToggleRead={() => {
            if (!selectedEntry) return;
            withBusy(async () => {
              const updated = await api.patchEntry(selectedEntry.id, {
                is_read: !selectedEntry.is_read,
              });
              patchLocalEntry(updated);
              await Promise.all([refreshFeeds(), refreshEntries(), refreshStats()]);
            });
          }}
        />
      </div>

      <StatusBar stats={stats} status={status} />
    </div>
  );
}
