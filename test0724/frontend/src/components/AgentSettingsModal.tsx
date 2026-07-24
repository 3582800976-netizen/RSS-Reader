import { FormEvent, useEffect, useState } from "react";
import {
  AgentSettings,
  api,
  DailyUsagePoint,
  LlmProvider,
  UsageSummary,
} from "../api";
import {
  CUSTOM_VENDOR_ID,
  findVendorTemplate,
  LLM_VENDOR_TEMPLATES,
} from "../providerTemplates";
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
  const [vendorId, setVendorId] = useState(CUSTOM_VENDOR_ID);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [testStatus, setTestStatus] = useState<
    Record<number, "ok" | "fail" | "testing">
  >({});
  const [testFlashKey, setTestFlashKey] = useState<Record<number, number>>({});
  const [testingId, setTestingId] = useState<number | null>(null);

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

  function applyVendor(id: string) {
    setVendorId(id);
    if (id === CUSTOM_VENDOR_ID) {
      setForm((prev) => ({ ...prev, name: "", base_url: "" }));
      return;
    }
    const t = findVendorTemplate(id);
    if (!t) return;
    setForm((prev) => ({
      ...prev,
      name: t.name,
      base_url: t.base_url,
      // 模型名不预填，由用户自行填写
    }));
  }

  const vendorHint =
    vendorId === CUSTOM_VENDOR_ID
      ? "自定义：请自行填写 Base URL 与模型名"
      : findVendorTemplate(vendorId)?.hint ||
        "已自动填充 Base URL；请填写 API Key 与模型名";

  async function onAddProvider(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg("");
    try {
      const name = form.name.trim();
      const base_url = form.base_url.trim();
      const api_key = form.api_key.trim();
      const model_name = form.model_name.trim();
      if (!name || !base_url || !api_key || !model_name) {
        setMsg("请完整填写显示名称、Base URL、API Key 与模型名后再保存");
        return;
      }
      const provider = await api.createProvider({
        name,
        base_url,
        api_key,
        model_name,
      });
      // 首次添加时自动绑定到问答/翻译，之后可在下方分别改
      await api.updateAgentSettings("qa", {
        provider_id: provider.id,
        model_name,
      });
      await api.updateAgentSettings("translation", {
        provider_id: provider.id,
        model_name,
      });
      setForm(emptyForm);
      setVendorId(CUSTOM_VENDOR_ID);
      await reload();
      setMsg(`已添加「${provider.name}」，并绑定到 AI 问答 / 翻译智能体`);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onTest(provider: LlmProvider) {
    const model = provider.model_name?.trim() || "";
    if (!model) {
      setMsg(`「${provider.name}」未保存模型名，请删除后重新添加并填写模型名`);
      setTestStatus((prev) => ({ ...prev, [provider.id]: "fail" }));
      setTestFlashKey((prev) => ({ ...prev, [provider.id]: Date.now() }));
      return;
    }
    setBusy(true);
    setTestingId(provider.id);
    setMsg("");
    setTestStatus((prev) => ({ ...prev, [provider.id]: "testing" }));
    try {
      // 使用该 Provider 自身的 base_url / key / model_name
      const r = await api.testProvider({
        provider_id: provider.id,
      });
      setTestStatus((prev) => ({
        ...prev,
        [provider.id]: r.ok ? "ok" : "fail",
      }));
      setTestFlashKey((prev) => ({ ...prev, [provider.id]: Date.now() }));
      setMsg(r.ok ? `连通成功：${r.reply || "OK"}` : `连通失败：${r.error}`);
    } catch (err) {
      setTestStatus((prev) => ({ ...prev, [provider.id]: "fail" }));
      setTestFlashKey((prev) => ({ ...prev, [provider.id]: Date.now() }));
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
      setTestingId(null);
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
          请先选择厂商模板自动填充 Base URL，再填写 API Key 与模型名。也可选「自定义」手动填写。
          API Key 仅保存在本机。
        </p>

        <section className="modal-section">
          <h3>添加 Provider</h3>
          <form className="provider-form" onSubmit={onAddProvider}>
            <label className="provider-field provider-field-full">
              <span>厂商模板</span>
              <select
                disabled={busy}
                value={vendorId}
                onChange={(e) => applyVendor(e.target.value)}
              >
                <option value={CUSTOM_VENDOR_ID}>自定义（手动填写 URL）</option>
                {LLM_VENDOR_TEMPLATES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="provider-template-hint">{vendorHint}</p>
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
              onChange={(e) => {
                setVendorId(CUSTOM_VENDOR_ID);
                setForm({ ...form, base_url: e.target.value });
              }}
              required
            />
            <input
              placeholder="API Key"
              value={form.api_key}
              disabled={busy}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              required
            />
            <input
              placeholder="模型名（由服务商提供）"
              value={form.model_name}
              disabled={busy}
              onChange={(e) => setForm({ ...form, model_name: e.target.value })}
              required
            />
            <button
              type="submit"
              className="primary"
              disabled={
                busy ||
                !form.name.trim() ||
                !form.base_url.trim() ||
                !form.api_key.trim() ||
                !form.model_name.trim()
              }
            >
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
              {providers.map((p) => {
                const status = testStatus[p.id];
                return (
                  <li key={p.id} className="provider-row">
                    <strong className="provider-name" title={p.name}>
                      {p.name}
                    </strong>
                    <span className="muted provider-url" title={p.base_url}>
                      {p.base_url}
                    </span>
                    <div className="provider-test">
                      <span
                        key={testFlashKey[p.id] || status || "idle"}
                        className={`provider-status-dot ${
                          status === "ok"
                            ? "ok"
                            : status === "fail"
                              ? "fail"
                              : status === "testing"
                                ? "testing"
                                : "idle"
                        }`}
                        title={
                          status === "ok"
                            ? "连通成功"
                            : status === "fail"
                              ? "连通失败"
                              : status === "testing"
                                ? "测试中"
                                : ""
                        }
                        aria-hidden={status ? undefined : true}
                        aria-label={
                          status === "ok"
                            ? "连通成功"
                            : status === "fail"
                              ? "连通失败"
                              : status === "testing"
                                ? "测试中"
                                : undefined
                        }
                      />
                      <button
                        type="button"
                        className="ghost"
                        disabled={busy}
                        onClick={() => onTest(p)}
                      >
                        {testingId === p.id ? "测试中…" : "测试连通"}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="ghost danger-text provider-delete"
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
                  </li>
                );
              })}
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
          {(["qa", "translation"] as const).map((agent) => {
            const s = setting(agent);
            return (
              <div className="agent-bind" key={agent}>
                <div className="agent-bind-title">
                  {agent === "qa" ? "AI 问答" : "翻译 Translation"}
                </div>
                <div className="agent-bind-grid">
                  <label>
                    Provider
                    <select
                      disabled={busy || providers.length === 0}
                      value={s?.provider_id ?? ""}
                      onChange={(e) => {
                        const providerId = e.target.value
                          ? Number(e.target.value)
                          : null;
                        const selected = providers.find(
                          (p) => p.id === providerId,
                        );
                        patchAgent(agent, {
                          provider_id: providerId,
                          model_name: selected?.model_name?.trim() || null,
                        });
                      }}
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
                  {agent === "qa" ? (
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
            AI 问答每次回复计 1 次；翻译按段落计次。
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
