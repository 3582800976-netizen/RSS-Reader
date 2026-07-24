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
  model_name?: string | null;
  is_active: boolean;
  created_at: string;
};

export type AgentSettings = {
  agent_type: "qa" | "translation" | string;
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

export type CleanedEntry = {
  entry_id: number;
  cleaned_html?: string | null;
  cleaned_markdown?: string | null;
  word_count: number;
  status: string;
  title?: string | null;
  byline?: string | null;
};

export type ReadingPrefs = {
  theme: string;
  font_size: number;
  line_height: number;
  font_family: string;
  display_mode: string;
  split_ratio: number;
  left_width: number;
  middle_width: number;
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
    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail),
    );
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

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ChatStreamHandlers = {
  onDelta: (text: string) => void;
  onDone?: (info: { model_name?: string | null }) => void;
  onError?: (error: string) => void;
};

export type ChatHistory = {
  entry_id: number;
  messages: ChatMessage[];
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
      { method: "POST" },
    ),
  listEntries: (params: ListEntriesParams = {}) => {
    const q = new URLSearchParams();
    if (params.feed_id != null) q.set("feed_id", String(params.feed_id));
    if (params.is_read != null) q.set("is_read", String(params.is_read));
    if (params.is_starred != null)
      q.set("is_starred", String(params.is_starred));
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
    return request<{
      imported: number;
      skipped: number;
      feed_ids: number[];
      job_id: string;
    }>("/api/opml/import", { method: "POST", body: form });
  },
  importStatus: (jobId: string) =>
    request<{
      status: string;
      total: number;
      synced: number;
      ok: number;
      fail: number;
      inserted: number;
      error?: string;
    }>(`/api/opml/import-status/${jobId}`),
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
    model_name?: string;
    is_active?: boolean;
  }) =>
    request<LlmProvider>("/api/ai/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  updateProvider: (
    id: number,
    body: Partial<{
      name: string;
      base_url: string;
      api_key: string;
      model_name: string;
      is_active: boolean;
    }>,
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
    model_name?: string;
  }) =>
    request<{ ok: boolean; reply?: string; error?: string }>(
      "/api/ai/providers/test",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
  listAgentSettings: () => request<AgentSettings[]>("/api/ai/settings"),
  updateAgentSettings: (
    agent_type: string,
    body: Partial<{
      provider_id: number | null;
      model_name: string | null;
      target_language: string | null;
      detail_level: string | null;
      prompt_strategy: string | null;
    }>,
  ) =>
    request<AgentSettings>(`/api/ai/settings/${agent_type}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  streamChat: async (
    body: { entry_id: number; messages: ChatMessage[] },
    handlers: ChatStreamHandlers,
    signal?: AbortSignal,
  ) => {
    const res = await fetch("/api/ai/chat/stream", {
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
      throw new Error(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );
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
            model_name?: string | null;
          };
          if (evt.type === "delta" && evt.text) handlers.onDelta(evt.text);
          if (evt.type === "done")
            handlers.onDone?.({ model_name: evt.model_name });
          if (evt.type === "error") handlers.onError?.(evt.error || "问答失败");
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  },
  getChatHistory: (entry_id: number) =>
    request<ChatHistory>(`/api/ai/chat/${entry_id}`),
  clearChatHistory: (entry_id: number) =>
    request<{ ok: boolean }>(`/api/ai/chat/${entry_id}`, { method: "DELETE" }),
  getTranslation: async (entry_id: number) => {
    const res = await fetch(`/api/ai/translate/${entry_id}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("读取翻译失败");
    return res.json() as Promise<TranslationOut>;
  },
  streamTranslate: async (
    body: {
      entry_id: number;
      target_language?: string;
      force?: boolean;
    },
    handlers: {
      onInit?: (info: {
        entry_id: number;
        target_language?: string | null;
        paragraphs: TranslationParagraph[];
        cached: boolean;
      }) => void;
      onDelta?: (paragraph_index: number, text: string) => void;
      onParagraph?: (p: TranslationParagraph) => void;
      onDone?: (info: {
        cached: boolean;
        target_language?: string | null;
      }) => void;
      onError?: (error: string) => void;
    },
    signal?: AbortSignal,
  ) => {
    const res = await fetch("/api/ai/translate/stream", {
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
      throw new Error(
        typeof detail === "string" ? detail : JSON.stringify(detail),
      );
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
            entry_id?: number;
            target_language?: string | null;
            paragraphs?: TranslationParagraph[];
            cached?: boolean;
            paragraph_index?: number;
            text?: string;
            original_text?: string | null;
            translated_text?: string | null;
            status?: string;
            model_name?: string | null;
            error?: string;
          };
          if (evt.type === "init" && evt.paragraphs) {
            handlers.onInit?.({
              entry_id: evt.entry_id ?? body.entry_id,
              target_language: evt.target_language,
              paragraphs: evt.paragraphs,
              cached: !!evt.cached,
            });
          }
          if (
            evt.type === "delta" &&
            typeof evt.paragraph_index === "number" &&
            evt.text
          ) {
            handlers.onDelta?.(evt.paragraph_index, evt.text);
          }
          if (evt.type === "paragraph" && typeof evt.paragraph_index === "number") {
            handlers.onParagraph?.({
              paragraph_index: evt.paragraph_index,
              original_text: evt.original_text,
              translated_text: evt.translated_text,
              status: evt.status || "success",
              model_name: evt.model_name,
            });
          }
          if (evt.type === "done") {
            handlers.onDone?.({
              cached: !!evt.cached,
              target_language: evt.target_language,
            });
          }
          if (evt.type === "error") {
            handlers.onError?.(evt.error || "翻译失败");
          }
        } catch {
          /* ignore malformed chunk */
        }
      }
    }
  },
  translateEntry: (body: {
    entry_id: number;
    target_language?: string;
    force?: boolean;
  }) =>
    request<TranslationOut>("/api/ai/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
  clearTranslation: (entry_id: number) =>
    request<{ ok: boolean }>(`/api/ai/translate/${entry_id}`, {
      method: "DELETE",
    }),
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

  getCleaned: (entryId: number) =>
    request<CleanedEntry>(`/api/entries/${entryId}/cleaned`),
  getReadingPrefs: () => request<ReadingPrefs>("/api/preferences/reading"),
  saveReadingPrefs: (body: Partial<ReadingPrefs>) =>
    request<ReadingPrefs>("/api/preferences/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
};
