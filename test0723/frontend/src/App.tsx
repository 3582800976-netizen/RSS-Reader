import { useCallback, useEffect, useRef, useState } from "react";
import { api, Entry, Feed, Stats } from "./api";
import AgentSettingsModal from "./components/AgentSettingsModal";
import DisplaySettingsModal from "./components/DisplaySettingsModal";
import EntryList from "./components/EntryList";
import ReaderPane from "./components/ReaderPane";
import Resizer from "./components/Resizer";
import Sidebar from "./components/Sidebar";
import StatusBar from "./components/StatusBar";
import TopBar from "./components/TopBar";
import {
  FontSize,
  ListView,
  ReadingMode,
  ThemeMode,
  loadFontSize,
  loadMarkReadDelay,
  loadReadingMode,
  loadTheme,
  saveFontSize,
  saveMarkReadDelay,
  saveReadingMode,
  saveTheme,
} from "./prefs";

const MOBILE_BREAKPOINT_PX = 860;
type MobilePane = "feeds" | "entries" | "reader";

function getEntriesTitle(
  feeds: Feed[],
  selectedFeedId: number | null,
  listView: ListView,
): string {
  if (listView === "unread") return "未读";
  if (listView === "starred") return "收藏";
  if (selectedFeedId === null) return "全部文章";
  return feeds.find((f) => f.id === selectedFeedId)?.title ?? "文章";
}

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
  const [leftWidth, setLeftWidth] = useState(240);
  const [middleWidth, setMiddleWidth] = useState(320);
  const [aiSettingsOpen, setAiSettingsOpen] = useState(false);
  const [displaySettingsOpen, setDisplaySettingsOpen] = useState(false);
  const [markReadDelay, setMarkReadDelay] = useState(() => loadMarkReadDelay());
  const fileRef = useRef<HTMLInputElement>(null);
  const markReadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selectedEntryIdRef = useRef<number | null>(null);
  const [isNarrow, setIsNarrow] = useState(
    () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`).matches,
  );
  const [mobilePane, setMobilePane] = useState<MobilePane>("feeds");

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT_PX}px)`);
    const onChange = () => setIsNarrow(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

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
    saveMarkReadDelay(markReadDelay);
  }, [markReadDelay]);

  useEffect(() => {
    selectedEntryIdRef.current = selectedEntry?.id ?? null;
  }, [selectedEntry]);

  useEffect(() => {
    return () => {
      if (markReadTimeoutRef.current !== null) {
        clearTimeout(markReadTimeoutRef.current);
      }
    };
  }, []);

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

  // Restore preferences from server on mount only (not on every feed switch)
  useEffect(() => {
    api.getReadingPrefs()
      .then((prefs) => {
        setTheme(prefs.theme as ThemeMode);
        setFontSize(String(prefs.font_size) as FontSize);
        setReadingMode(prefs.display_mode as ReadingMode);
        if (prefs.left_width) setLeftWidth(prefs.left_width);
        if (prefs.middle_width) setMiddleWidth(prefs.middle_width);
      })
      .catch(() => undefined);
  }, []);

  // Load data when reload dependencies change
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

  function clearPendingMarkRead() {
    if (markReadTimeoutRef.current !== null) {
      clearTimeout(markReadTimeoutRef.current);
      markReadTimeoutRef.current = null;
    }
  }

  function scheduleMarkRead(entry: Entry, delaySec: number) {
    clearPendingMarkRead();
    const entryId = entry.id;
    const markNow = () => {
      api
        .patchEntry(entryId, { is_read: true })
        .then((updated) => {
          patchLocalEntry(updated);
          refreshFeeds();
          refreshStats();
        })
        .catch(() => undefined);
    };
    if (delaySec <= 0) {
      markNow();
      return;
    }
    markReadTimeoutRef.current = setTimeout(() => {
      markReadTimeoutRef.current = null;
      if (selectedEntryIdRef.current !== entryId) return;
      markNow();
    }, delaySec * 1000);
  }

  return (
    <div className="app">
      <TopBar
        search={search}
        onSearchChange={setSearch}
        busy={busy}
        isNarrow={isNarrow}
        readingMode={readingMode}
        onReadingMode={setReadingMode}
        onSyncAll={() =>
          withBusy(async () => {
            const r = await api.syncAll();
            await reload();
            setStatus(`同步完成：成功 ${r.ok_count}，失败 ${r.fail_count}，新增 ${r.inserted_total}`);
          })
        }
        onOpenAiSettings={() => setAiSettingsOpen(true)}
        onOpenDisplaySettings={() => setDisplaySettingsOpen(true)}
      />

      <AgentSettingsModal open={aiSettingsOpen} onClose={() => setAiSettingsOpen(false)} />
      <DisplaySettingsModal
        open={displaySettingsOpen}
        theme={theme}
        fontSize={fontSize}
        markReadDelay={markReadDelay}
        onClose={() => setDisplaySettingsOpen(false)}
        onThemeChange={(t) => setTheme(t)}
        onFontCycle={() =>
          setFontSize((s) => (s === "S" ? "M" : s === "M" ? "L" : "S"))
        }
        onMarkReadDelayChange={setMarkReadDelay}
      />

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
            await refreshFeeds();
            setBusy(false);
            setStatus(
              `OPML 导入完成：新增 ${r.imported}，跳过 ${r.skipped}，后台同步中…`,
            );
            const poll = async () => {
              const job = await api.importStatus(r.job_id);
              setStatus(
                `后台同步中：${job.synced}/${job.total} 源（成功 ${job.ok}，失败 ${job.fail}，新增 ${job.inserted} 篇）`,
              );
              if (job.status === "done" || job.status === "failed") {
                if (job.status === "done") {
                  setStatus(
                    `OPML 同步完成：${job.ok}/${job.total} 源成功，新增 ${job.inserted} 篇。`,
                  );
                } else {
                  setStatus(`OPML 同步失败：${job.error || "未知错误"}`);
                }
                await reload();
                return;
              }
              setTimeout(poll, 1500);
            };
            setTimeout(poll, 500);
          });
        }}
      />

      <div
        className="layout"
        data-mobile-pane={isNarrow ? mobilePane : undefined}
      >
        <Sidebar
          feeds={feeds}
          selectedFeedId={selectedFeedId}
          listView={listView}
          feedUrl={feedUrl}
          busy={busy}
          style={{ width: leftWidth, flexShrink: 0 }}
          onFeedUrlChange={setFeedUrl}
          onAddFeed={(e) => {
            e.preventDefault();
            if (!feedUrl.trim()) return;
            withBusy(async () => {
              const feed = await api.addFeed(feedUrl.trim());
              setFeedUrl("");
              setSelectedFeedId(feed.id);
              if (isNarrow) setMobilePane("entries");
              await reload();
              setStatus(`已添加：${feed.title}`);
            });
          }}
          onSelectFeed={(id) => {
            clearPendingMarkRead();
            setSelectedFeedId(id);
            setSelectedEntry(null);
            if (isNarrow) setMobilePane("entries");
          }}
          onListView={(v) => {
            clearPendingMarkRead();
            setListView(v);
            setSelectedEntry(null);
            if (isNarrow) setMobilePane("entries");
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
              clearPendingMarkRead();
              setSelectedEntry(null);
              await reload();
              setStatus("已删除订阅源");
            })
          }
          onImportOpml={() => fileRef.current?.click()}
          onExportOpml={() => withBusy(() => api.exportOpml(), "已导出 OPML")}
        />

        <Resizer
          onResize={(d) => setLeftWidth((w) => Math.min(Math.max(w + d, 180), 400))}
          onResizeEnd={() =>
            api.saveReadingPrefs({ left_width: leftWidth }).catch(() => undefined)
          }
        />

        <EntryList
          entries={entries}
          selectedId={selectedEntry?.id ?? null}
          busy={busy}
          title={getEntriesTitle(feeds, selectedFeedId, listView)}
          onBack={
            isNarrow
              ? () => {
                  setMobilePane("feeds");
                }
              : undefined
          }
          style={{ width: middleWidth, flexShrink: 0 }}
          onSelect={(entry) => {
            clearPendingMarkRead();
            setSelectedEntry(entry);
            if (isNarrow) setMobilePane("reader");
            if (!entry.is_read) {
              scheduleMarkRead(entry, markReadDelay);
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

        <Resizer
          onResize={(d) => setMiddleWidth((w) => Math.min(Math.max(w + d, 200), 480))}
          onResizeEnd={() =>
            api.saveReadingPrefs({ middle_width: middleWidth }).catch(() => undefined)
          }
        />

        <ReaderPane
          entry={selectedEntry}
          mode={readingMode}
          busy={busy}
          isNarrow={isNarrow}
          onBack={
            isNarrow
              ? () => {
                  clearPendingMarkRead();
                  setSelectedEntry(null);
                  setMobilePane("entries");
                }
              : undefined
          }
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
