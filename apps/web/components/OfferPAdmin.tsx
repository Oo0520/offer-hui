"use client";

import { useEffect, useMemo, useState } from "react";

type Row = {
  id: string;
  title: string;
  external_id: string;
  city: string | null;
  industry: string | null;
  job_type: string | null;
  degree: string | null;
  cohort: string | null;
  deadline_at: string | null;
  apply_url: string;
  source_url: string;
  created_at: string;
  description: string | null;
  tags: unknown;
  companies?: { name?: string } | null;
};

const TOKEN_KEY = "offerp_admin_token";

const DEGREES = ["不限", "专科及以上", "本科及以上", "硕士及以上", "博士研究生"];
const INDUSTRIES = [
  "互联网",
  "软件/信息技术",
  "芯片/半导体",
  "人工智能",
  "汽车/新能源",
  "工程建设",
  "银行/金融",
  "能源/电力",
  "制造/工业",
  "快消/零售",
  "教育/科研",
  "医疗/生物",
  "传媒/文化",
  "其他",
];
const SOURCE_TYPES = ["企业官网", "企业公众号", "高校就业网", "国家24365", "社区数据", "其他"];

const empty = {
  company_name: "",
  title: "",
  job_type: "campus" as const,
  degree: "本科及以上",
  cohort: "2027届",
  city: "",
  location: "",
  industry: "互联网",
  deadline_at: "",
  apply_url: "",
  source_url: "",
  source_type: "企业公众号",
  tags: "",
  note: "",
};

export default function OfferPAdmin() {
  const [token, setToken] = useState("");
  const [authed, setAuthed] = useState(false);
  const [form, setForm] = useState(empty);
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      setToken(t);
      setAuthed(true);
      loadRows(t);
    }
  }, []);

  async function loadRows(t: string) {
    try {
      const r = await fetch("/api/offerp/jobs", {
        headers: { "x-admin-token": t },
      });
      if (r.ok) setRows(await r.json());
    } catch {
      /* ignore */
    }
  }

  async function doLogin() {
    const r = await fetch("/api/offerp/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    if (r.ok) {
      localStorage.setItem(TOKEN_KEY, token);
      setAuthed(true);
      setMsg({ ok: true, text: "欢迎回来" });
      loadRows(token);
    } else {
      setMsg({ ok: false, text: "口令错误" });
    }
  }

  function set<K extends keyof typeof empty>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setMsg(null);
    setLoading(true);
    try {
      const r = await fetch("/api/offerp/jobs", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": token,
        },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (r.ok) {
        setMsg({ ok: true, text: `已保存：${form.company_name} · ${form.title}` });
        setForm(empty);
        loadRows(token);
      } else {
        setMsg({ ok: false, text: j.error || "保存失败" });
      }
    } catch {
      setMsg({ ok: false, text: "网络错误" });
    } finally {
      setLoading(false);
    }
  }

  async function del(id: string) {
    if (!confirm("确认删除该岗位？")) return;
    const r = await fetch(`/api/offerp/jobs?id=${id}`, {
      method: "DELETE",
      headers: { "x-admin-token": token },
    });
    if (r.ok) {
      setRows((rs) => rs.filter((x) => x.id !== id));
      setMsg({ ok: true, text: "已删除" });
    } else {
      setMsg({ ok: false, text: "删除失败" });
    }
  }

  const jtLabel = (t: string | null) =>
    t === "intern" ? "实习" : t === "fair" ? "招聘会" : "校招";

  const stats = useMemo(() => {
    const bySrc = new Map<string, number>();
    for (const r of rows) {
      const k = String((r.tags as string[])?.[0] || "未标来源");
      bySrc.set(k, (bySrc.get(k) || 0) + 1);
    }
    return bySrc;
  }, [rows]);

  if (!authed) {
    return (
      <div style={wrap}>
        <div style={{ maxWidth: 360, width: "100%" }}>
          <div style={title}>Offer派 · 数据管理</div>
          <div style={{ margin: "8px 0 20px", color: "#8a8f98", fontSize: 13 }}>
            输入管理口令后录入岗位
          </div>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && doLogin()}
            placeholder="管理口令"
            style={input}
          />
          <button onClick={doLogin} style={btnPrimary}>
            进入
          </button>
          {msg && <Msg m={msg} />}
        </div>
      </div>
    );
  }

  return (
    <div style={wrap}>
      <div style={{ maxWidth: 880, width: "100%" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={title}>Offer派 · 数据管理</div>
            <div style={{ color: "#8a8f98", fontSize: 13, marginTop: 2 }}>
              手动录入岗位，提交即上架（来源显示"手动录入"）
            </div>
          </div>
          <button
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setAuthed(false);
            }}
            style={btnGhost}
          >
            退出
          </button>
        </div>

        {msg && <Msg m={msg} />}

        {/* 录入表单 */}
        <div style={card}>
          <div style={cardTitle}>录入岗位</div>
          <div style={grid}>
            <Label t="公司名 *">
              <input style={input} value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="如：瑞幸咖啡" />
            </Label>
            <Label t="岗位名 *">
              <input style={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="如：储备店长" />
            </Label>
            <Label t="招聘类型">
              <select style={input} value={form.job_type} onChange={(e) => set("job_type", e.target.value)}>
                <option value="campus">校招</option>
                <option value="intern">实习</option>
                <option value="fair">招聘会</option>
              </select>
            </Label>
            <Label t="届别">
              <input style={input} value={form.cohort} onChange={(e) => set("cohort", e.target.value)} placeholder="如：2027届" />
            </Label>
            <Label t="学历要求">
              <select style={input} value={form.degree} onChange={(e) => set("degree", e.target.value)}>
                {DEGREES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Label>
            <Label t="行业">
              <select style={input} value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                {INDUSTRIES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Label>
            <Label t="城市（留空=全国）">
              <input style={input} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="如：北京" />
            </Label>
            <Label t="工作地点备注">
              <input style={input} value={form.location} onChange={(e) => set("location", e.target.value)} placeholder="如：全国、海外" />
            </Label>
            <Label t="截止日期（留空=招满即止）">
              <input type="date" style={input} value={form.deadline_at} onChange={(e) => set("deadline_at", e.target.value)} />
            </Label>
            <Label t="来源类型">
              <select style={input} value={form.source_type} onChange={(e) => set("source_type", e.target.value)}>
                {SOURCE_TYPES.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Label>
            <Label t="投递链接 *">
              <input style={input} value={form.apply_url} onChange={(e) => set("apply_url", e.target.value)} placeholder="官方投递入口 URL" />
            </Label>
            <Label t="来源链接 *">
              <input style={input} value={form.source_url} onChange={(e) => set("source_url", e.target.value)} placeholder="公众号原文 / 官网公告 URL" />
            </Label>
            <Label t="标签（逗号分隔，可空）">
              <input style={input} value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="如：央企、西安" />
            </Label>
            <Label t="备注（可空）">
              <input style={input} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="笔试情况 / 面向人群等" />
            </Label>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={submit} disabled={loading} style={btnPrimary}>
              {loading ? "提交中…" : "保存岗位"}
            </button>
            <span style={{ color: "#8a8f98", fontSize: 12 }}>
              同公司同岗位重复提交会覆盖更新
            </span>
          </div>
        </div>

        {/* 已录列表 */}
        <div style={card}>
          <div style={cardTitle}>
            已录入 {rows.length} 条
            <span style={{ fontSize: 12, color: "#8a8f98", marginLeft: 8 }}>
              {[...stats.entries()].map(([k, v]) => `${k} ${v}`).join(" · ")}
            </span>
          </div>
          {rows.length === 0 ? (
            <div style={{ color: "#8a8f98", fontSize: 13, padding: "12px 0" }}>还没有手动录入的岗位</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {rows.map((r) => (
                <div key={r.id} style={rowCard}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {r.companies?.name || "?"} · {r.title}
                      <span style={{ marginLeft: 8, fontWeight: 500, color: "#ca0013", fontSize: 12 }}>
                        {jtLabel(r.job_type)}
                      </span>
                    </div>
                    <div style={{ color: "#8a8f98", fontSize: 12, marginTop: 3, wordBreak: "break-all" }}>
                      {r.city || "全国"} · {r.degree || "学历不限"} · {r.cohort || ""} · {r.industry || "未分类"}
                      {r.deadline_at ? ` · 截止 ${r.deadline_at}` : " · 招满即止"}
                    </div>
                    {r.description && (
                      <div style={{ color: "#b7c6c2", fontSize: 12, marginTop: 2 }}>备注：{r.description}</div>
                    )}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                    <a href={r.apply_url} target="_blank" rel="noreferrer" style={linkBtn}>投递页</a>
                    <a href={r.source_url} target="_blank" rel="noreferrer" style={linkBtn}>来源</a>
                    <button onClick={() => del(r.id)} style={delBtn}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Label({ t, children }: { t: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "#8a8f98" }}>
      {t}
      {children}
    </label>
  );
}

function Msg({ m }: { m: { ok: boolean; text: string } }) {
  return (
    <div
      style={{
        margin: "10px 0",
        padding: "8px 12px",
        borderRadius: 10,
        fontSize: 13,
        background: m.ok ? "rgba(16,185,129,.12)" : "rgba(239,68,68,.12)",
        color: m.ok ? "#34d399" : "#f87171",
      }}
    >
      {m.text}
    </div>
  );
}

const wrap: React.CSSProperties = {
  minHeight: "100vh",
  display: "flex",
  justifyContent: "center",
  padding: "40px 16px",
  background: "#0a0a0a",
  color: "#f5f5f5",
  fontFamily:
    'Nunito, "PingFang SC", "Microsoft YaHei", -apple-system, sans-serif',
};
const title: React.CSSProperties = { fontSize: 22, fontWeight: 900 };
const card: React.CSSProperties = {
  marginTop: 20,
  padding: 20,
  borderRadius: 24,
  border: "1px solid rgba(255,255,255,.08)",
  background: "rgba(255,255,255,.03)",
};
const cardTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 800,
  marginBottom: 14,
  display: "flex",
  alignItems: "center",
};
const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
  gap: 12,
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  borderRadius: 12,
  border: "1px solid rgba(183,198,194,.25)",
  background: "rgba(255,255,255,.04)",
  color: "#f5f5f5",
  fontSize: 13,
  outline: "none",
};
const btnPrimary: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 999,
  border: "none",
  background: "#ca0013",
  color: "#fff",
  fontSize: 14,
  fontWeight: 800,
  cursor: "pointer",
};
const btnGhost: React.CSSProperties = {
  padding: "8px 16px",
  borderRadius: 999,
  border: "1px solid rgba(183,198,194,.3)",
  background: "transparent",
  color: "#b7c6c2",
  fontSize: 13,
  cursor: "pointer",
};
const rowCard: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  padding: "12px 14px",
  borderRadius: 16,
  border: "1px solid rgba(255,255,255,.06)",
  background: "rgba(255,255,255,.02)",
};
const linkBtn: React.CSSProperties = {
  fontSize: 12,
  color: "#38bdf8",
  textDecoration: "none",
};
const delBtn: React.CSSProperties = {
  fontSize: 12,
  color: "#f87171",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};
