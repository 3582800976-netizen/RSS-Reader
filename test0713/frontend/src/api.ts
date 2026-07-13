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

export type LlmProvider = {
  id: number;
  name: string;
  base_url: string;
  api_key_set: boolean;
  is_active: boolean;
  created_at: string;
};

export type AgentSettings = {
  agent_type: "summary" | "translation" | string;
  provider_id?: number | null;
  model_name?: string | null;
  target_language?: string | null;
  detail_level?: string | null;
  prompt_strategy?: string | null;
};

export type TranslationParagraph = {
  paragraph_index: number;
  original_text?: string | null;
  translated_text?: string | null;
  status: string;
  model_name?: string | null;
};

export type TranslationOut = {
  entry_id: number;
  paragraphs: TranslationParagraph[];
  target_language?: string | null;
};

export type UsageSummary = {
  total_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  by_agent: Array<{ agent_type: string; calls: number; tokens: number }>;
  by_model: Array<{ model_name: string; calls: number; tokens: number }>;
};

export type DailyUsagePoint = {
  date: string;
  calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
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

export type SummaryStreamHandlers = {
  onDelta: (text: string) => void;
  onDone?: (info: { cached: boolean; model_name?: string | null }) => void;
  onError?: (error: string) => void;
};

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

  listProviders: () => request<LlmProvider[]>("/api/ai/providers"),
  createProvider: (body: {
    name: string;
    base_url: string;
    api_key?: string;
    is_active?: boolean;
  }) =>
    request<LlmProvider>("/api/ai/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateProvider: (
    id: number,
    body: Partial<{ name: string; base_url: string; api_key: string; is_active: boolean }>
  ) =>
    request<LlmProvider>(`/api/ai/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  deleteProvider: (id: number) =>
    request<{ ok: boolean }>(`/api/ai/providers/${id}`, { method: "DELETE" }),
  testProvider: (body: {
    provider_id?: number;
    base_url?: string;
    api_key?: string;
    model_name: string;
  }) =>
    request<{ ok: boolean; reply?: string; error?: string }>("/api/ai/providers/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  listAgentSettings: () => request<AgentSettings[]>("/api/ai/settings"),
  updateAgentSettings: (
    agent_type: string,
    body: Partial<{
      provider_id: number | null;
      model_name: string | null;
      target_language: string | null;
      detail_level: string | null;
      prompt_strategy: string | null;
    }>
  ) =>
    request<AgentSettings>(`/api/ai/settings/${agent_type}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getCachedSummary: async (entry_id: number) => {
    const res = await fetch(`/api/ai/summary/${entry_id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("读取摘要失败");
    return res.json() as Promise<{
      entry_id: number;
      summary_text: string;
      model_name?: string | null;
      cached: boolean;
    }>;
  },
  streamSummary: async (
    body: {
      entry_id: number;
      target_language?: string;
      detail_level?: string;
      force?: boolean;
    },
    handlers: SummaryStreamHandlers,
    signal?: AbortSignal
  ) => {
    const res = await fetch("/api/ai/summary/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
    if (!res.ok || !res.body) {
      let detail = res.statusText;
      try {
        const data = await res.json();
        detail = data.detail || detail;
      } catch {
        /* ignore */
      }
      throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";
      for (const part of parts) {
        const line = part
          .split("\n")
          .map((l) => l.trim())
          .find((l) => l.startsWith("data:"));
        if (!line) continue;
        const raw = line.slice(5).trim();
        try {
          const evt = JSON.parse(raw) as {
            type: string;
            text?: string;
            error?: string;
            cached?: boolean;
            model_name?: string | null;
          };
          if (evt.type === "delta" && evt.text) handlers.onDelta(evt.text);
          if (evt.type === "done")
            handlers.onDone?.({ cached: !!evt.cached, model_name: evt.model_name });
          if (evt.type === "error") handlers.onError?.(evt.error || "摘要失败");
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  },
  getTranslation: async (entry_id: number) => {
    const res = await fetch(`/api/ai/translate/${entry_id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("读取翻译失败");
    return res.json() as Promise<TranslationOut>;
  },
  translateEntry: (body: { entry_id: number; target_language?: string; force?: boolean }) =>
    request<TranslationOut>("/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  clearTranslation: (entry_id: number) =>
    request<{ ok: boolean }>(`/api/ai/translate/${entry_id}`, { method: "DELETE" }),
  retryTranslation: (body: {
    entry_id: number;
    paragraph_index: number;
    original_text?: string;
    target_language?: string;
  }) =>
    request<TranslationParagraph>("/api/ai/translate/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  getUsageSummary: () => request<UsageSummary>("/api/ai/usages/summary"),
  getUsageDaily: (days = 30) =>
    request<{ days: DailyUsagePoint[] }>(`/api/ai/usages/daily?days=${days}`),
};
