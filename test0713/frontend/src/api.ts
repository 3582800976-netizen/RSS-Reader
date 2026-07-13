export type Feed = {
  id: number;
  title: string;
  feed_url: string;
  site_url?: string | null;
  last_fetched_at?: string | null;
  created_at: string;
  unread_count: number;
};

export type Entry = {
  id: number;
  feed_id: number;
  guid: string;
  url?: string | null;
  title: string;
  author?: string | null;
  published_at?: string | null;
  summary?: string | null;
  is_read: boolean;
  is_starred: boolean;
  created_at: string;
  feed_title?: string | null;
};

export type Stats = {
  feed_count: number;
  entry_count: number;
  unread_count: number;
  starred_count: number;
  last_synced_at?: string | null;
};

export type ListEntriesParams = {
  feed_id?: number | null;
  is_read?: boolean | null;
  is_starred?: boolean | null;
  q?: string | null;
  limit?: number;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = data.detail || JSON.stringify(data);
    } catch {
      /* ignore */
    }
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return res as unknown as T;
}

export const api = {
  listFeeds: () => request<Feed[]>("/api/feeds"),
  addFeed: (feed_url: string) =>
    request<Feed>("/api/feeds", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_url }),
    }),
  deleteFeed: (id: number) =>
    request<{ ok: boolean }>(`/api/feeds/${id}`, { method: "DELETE" }),
  syncFeed: (id: number) =>
    request(`/api/feeds/${id}/sync`, { method: "POST" }),
  syncAll: () =>
    request<{ ok_count: number; fail_count: number; inserted_total: number }>(
      "/api/sync",
      { method: "POST" }
    ),
  listEntries: (params: ListEntriesParams = {}) => {
    const q = new URLSearchParams();
    if (params.feed_id != null) q.set("feed_id", String(params.feed_id));
    if (params.is_read != null) q.set("is_read", String(params.is_read));
    if (params.is_starred != null) q.set("is_starred", String(params.is_starred));
    if (params.q) q.set("q", params.q);
    q.set("limit", String(params.limit ?? 100));
    return request<Entry[]>(`/api/entries?${q.toString()}`);
  },
  getEntry: (id: number) => request<Entry>(`/api/entries/${id}`),
  patchEntry: (id: number, body: { is_read?: boolean; is_starred?: boolean }) =>
    request<Entry>(`/api/entries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  markAllRead: (feed_id?: number | null) =>
    request<{ updated: number }>("/api/entries/mark-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ feed_id: feed_id ?? null }),
    }),
  getStats: () => request<Stats>("/api/stats"),
  importOpml: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ imported: number; skipped: number; feed_ids: number[] }>(
      "/api/opml/import",
      { method: "POST", body: form }
    );
  },
  exportOpml: async () => {
    const res = await fetch("/api/opml/export");
    if (!res.ok) throw new Error("导出失败");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "subscriptions.opml";
    a.click();
    URL.revokeObjectURL(url);
  },
};
