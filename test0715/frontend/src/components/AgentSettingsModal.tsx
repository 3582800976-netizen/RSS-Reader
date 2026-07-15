import { FormEvent, useEffect, useState } from "react";
import {
  AgentSettings,
  api,
  DailyUsagePoint,
  LlmProvider,
  UsageSummary,
} from "../api";
import { CallsChart, TokensChart } from "./UsageCharts";

type Props = {
  open: boolean;
  onClose: () => void;
};

const emptyForm = {
  name: "",
  base_url: "",
  api_key: "",
  model_name: "",
};

export default function AgentSettingsModal({ open, onClose }: Props) {
  const [providers, setProviders] = useState<LlmProvider[]>([]);
  const [settings, setSettings] = useState<AgentSettings[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [daily, setDaily] = useState<DailyUsagePoint[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function reload() {
    const [p, s, u, d] = await Promise.all([
      api.listProviders(),
      api.listAgentSettings(),
      api.getUsageSummary(),
      api.getUsageDaily(30),
    ]);
    setProviders(p);
    setSettings(s);
    setUsage(u);
    setDaily(d.days || []);
  }

  useEffect(() => {
    if (!open) return;
    reload().catch((e) => setMsg(String(e.message || e)));
  }, [open]);

  if (!open) return null;

  function setting(agent: string) {
    return settings.find((s) => s.agent_type === agent);
  }

  async function onAddProvider(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const name = form.name.trim();
      const base_url = form.base_url.trim();
      const model_name = form.model_name.trim();
      if (!name || !base_url || !model_name) {
        setMsg("请填写显示名称、Base URL 与模型名");
        return;
      }
      const provider = await api.createProvider({
        name,
        base_url,
        api_key: form.api_key.trim() || undefined,
      });
      // 首次添加时自动绑定到摘要/翻译，之后可在下方分别改
      await api.updateAgentSettings("summary", {
        provider_id: provider.id,
        model_name,
      });
      await api.updateAgentSettings("translation", {
        provider_id: provider.id,
        model_name,
      });
      setForm(emptyForm);
      await reload();
      setMsg(`已添加「${provider.name}」，并绑定到摘要 / 翻译智能体`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onTest(provider: LlmProvider) {
    const model =
      setting("summary")?.model_name?.trim() ||
      setting("translation")?.model_name?.trim() ||
      "";
    if (!model) {
      setMsg("请先在下方智能体绑定中填写模型名，再测试连通");
      return;
    }
    setBusy(true);
    setMsg("");
    try {
      const r = await api.testProvider({
        provider_id: provider.id,
        model_name: model,
      });
      setMsg(r.ok ? `连通成功：${r.reply || "OK"}` : `连通失败：${r.error}`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function patchAgent(
    agent_type: string,
    patch: Parameters<typeof api.updateAgentSettings>[1]
  ) {
    setBusy(true);
    setMsg("");
    try {
      await api.updateAgentSettings(agent_type, patch);
      await reload();
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="AI 设置"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>AI 智能体设置</h2>
          <button type="button" className="ghost" onClick={onClose}>
            关闭
          </button>
        </div>

        <p className="modal-hint">
          请先在下方添加 Provider（服务商），保存后即可在「智能体绑定」里为摘要 /
          翻译选择 Provider 并填写模型名。API Key 仅保存在本机。
        </p>

        <section className="modal-section">
          <h3>添加 Provider</h3>
          <form className="provider-form" onSubmit={onAddProvider}>
            <input
              placeholder="显示名称（自定，如 My API）"
              value={form.name}
              disabled={busy}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <input
              placeholder="Base URL（API 地址）"
              value={form.base_url}
              disabled={busy}
              onChange={(e) => setForm({ ...form, base_url: e.target.value })}
              required
            />
            <input
              placeholder="API Key"
              value={form.api_key}
              disabled={busy}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
            />
            <input
              placeholder="模型名（由服务商提供）"
              value={form.model_name}
              disabled={busy}
              onChange={(e) => setForm({ ...form, model_name: e.target.value })}
              required
            />
            <button type="submit" className="primary" disabled={busy}>
              保存并绑定智能体
            </button>
          </form>
        </section>

        <section className="modal-section">
          <h3>已有 Provider</h3>
          {providers.length === 0 ? (
            <p className="muted">尚未配置。请先在上方填写并保存。</p>
          ) : (
            <ul className="provider-list">
              {providers.map((p) => (
                <li key={p.id}>
                  <div>
                    <strong>{p.name}</strong>
                    <span className="muted"> · {p.base_url}</span>
                    <span className="muted">
                      {" "}
                      · Key {p.api_key_set ? "已设置" : "未设置"}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button type="button" className="ghost" disabled={busy} onClick={() => onTest(p)}>
                      测试连通
                    </button>
                    <button
                      type="button"
                      className="ghost danger-text"
                      disabled={busy}
                      onClick={() =>
                        api
                          .deleteProvider(p.id)
                          .then(reload)
                          .catch((e) => setMsg(String(e.message || e)))
                      }
                    >
                      删除
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="modal-section">
          <h3>智能体绑定</h3>
          {providers.length === 0 ? (
            <p className="muted">
              Provider 下拉暂时不可选：需要先添加至少一个 Provider。模型名、语言等可先填写，失焦即保存。
            </p>
          ) : null}
          {(["summary", "translation"] as const).map((agent) => {
            const s = setting(agent);
            return (
              <div className="agent-bind" key={agent}>
                <div className="agent-bind-title">
                  {agent === "summary" ? "摘要 Summary" : "翻译 Translation"}
                </div>
                <div className="agent-bind-grid">
                  <label>
                    Provider
                    <select
                      disabled={busy || providers.length === 0}
                      value={s?.provider_id ?? ""}
                      onChange={(e) =>
                        patchAgent(agent, {
                          provider_id: e.target.value ? Number(e.target.value) : null,
                        })
                      }
                    >
                      <option value="">
                        {providers.length === 0 ? "请先添加 Provider" : "未选择"}
                      </option>
                      {providers.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    模型名
                    <input
                      disabled={busy}
                      placeholder="由你使用的服务商决定"
                      defaultValue={s?.model_name || ""}
                      key={`${agent}-model-${s?.model_name || ""}`}
                      onBlur={(e) =>
                        patchAgent(agent, { model_name: e.target.value.trim() || null })
                      }
                    />
                  </label>
                  <label>
                    目标语言
                    <select
                      disabled={busy}
                      value={s?.target_language || "Chinese"}
                      onChange={(e) =>
                        patchAgent(agent, { target_language: e.target.value })
                      }
                    >
                      <option value="Chinese">中文</option>
                      <option value="English">English</option>
                      <option value="Japanese">日本語</option>
                      <option value="Korean">한국어</option>
                      <option value="French">Français</option>
                      <option value="German">Deutsch</option>
                      <option value="Spanish">Español</option>
                      <option value="Portuguese">Português</option>
                      <option value="Russian">Русский</option>
                      <option value="Arabic">العربية</option>
                    </select>
                  </label>
                  {agent === "summary" ? (
                    <label>
                      详略
                      <select
                        disabled={busy}
                        value={s?.detail_level || "concise"}
                        onChange={(e) => patchAgent(agent, { detail_level: e.target.value })}
                      >
                        <option value="concise">简洁</option>
                        <option value="detailed">详细</option>
                      </select>
                    </label>
                  ) : (
                    <label>
                      提示词策略
                      <select
                        disabled={busy}
                        value={s?.prompt_strategy || "default"}
                        onChange={(e) =>
                          patchAgent(agent, { prompt_strategy: e.target.value })
                        }
                      >
                        <option value="default">默认</option>
                        <option value="hy_mt">HY-MT 优化</option>
                      </select>
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        <section className="modal-section">
          <h3>用量统计</h3>
          <p className="modal-hint">
            摘要每次生成计 1 次；翻译按段落计次。
          </p>
          {usage ? (
            <>
              <div className="usage-grid">
                <div>
                  <strong>{usage.total_calls}</strong>
                  <span>调用次数</span>
                </div>
                <div>
                  <strong>{usage.prompt_tokens.toLocaleString()}</strong>
                  <span>Prompt Tokens</span>
                </div>
                <div>
                  <strong>{usage.completion_tokens.toLocaleString()}</strong>
                  <span>Completion Tokens</span>
                </div>
                <div>
                  <strong>{usage.total_tokens.toLocaleString()}</strong>
                  <span>合计 Tokens</span>
                </div>
              </div>
              {daily.length > 0 ? (
                <div className="usage-charts">
                  <CallsChart days={daily} />
                  <TokensChart days={daily} />
                </div>
              ) : null}
              {usage.by_model?.length ? (
                <div className="usage-by-model">
                  {usage.by_model.map((m) => (
                    <div key={m.model_name} className="usage-model-row">
                      <strong>{m.model_name}</strong>
                      <span className="muted">
                        {m.calls} 次 · {Number(m.tokens).toLocaleString()} tokens
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : (
            <p className="muted">暂无数据</p>
          )}
        </section>

        {msg ? <p className="modal-msg">{msg}</p> : null}
      </div>
    </div>
  );
}
