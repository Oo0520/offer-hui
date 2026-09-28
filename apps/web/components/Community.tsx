"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Post = {
  id: string;
  title: string;
  content: string;
  tag: string | null;
  company: string | null;
  reward: boolean;
  created_at: string;
  tab: "salary" | "interview" | "referral";
  author: string;
};

const TABS = [
  { key: "all", label: "全部" },
  { key: "salary", label: "薪资爆料" },
  { key: "interview", label: "面经" },
  { key: "referral", label: "内推码" },
];

function tabOf(tag: string | null): Post["tab"] {
  const t = tag || "";
  if (t.includes("薪资") || t.includes("爆料") || t.includes("薪酬")) return "salary";
  if (t.includes("内推") || t.includes("内推码")) return "referral";
  return "interview";
}

export default function Community() {
  const [tab, setTab] = useState("all");
  const [posts, setPosts] = useState<Post[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  // 发帖表单
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tag, setTag] = useState("");
  const [company, setCompany] = useState("");
  const [reward, setReward] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // 管理审核
  const [adminSecret, setAdminSecret] = useState("");
  const [adminMode, setAdminMode] = useState(false);
  const [pendingList, setPendingList] = useState<Post[]>([]);

  function loadPosts() {
    supabase
      .from("posts")
      .select("id, title, content, tag, company, reward, created_at, author_id")
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error && data) {
          setPosts(
            data.map((p) => ({
              ...p,
              tab: tabOf(p.tag),
              author: p.author_id?.slice(0, 4) || "匿名",
            }))
          );
        }
        setLoading(false);
      });
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user || null));
    loadPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitPost() {
    if (!user || !title.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await supabase.auth.getSession();
      const t = data.session?.access_token;
      if (!t) return;
      const res = await fetch("/api/community/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
        body: JSON.stringify({ title: title.trim(), content: content.trim(), tag: tag.trim() || null, company: company.trim() || null, reward }),
      });
      if (res.ok) {
        alert("发布成功，内容已进入审核队列，通过后公开显示。");
        setTitle(""); setContent(""); setTag(""); setCompany(""); setReward(false);
        setShowForm(false);
      } else {
        const e = await res.json().catch(() => ({}));
        alert("发布失败：" + (e.error || res.status));
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function loadPending() {
    if (!adminSecret.trim()) return;
    const res = await fetch(`/api/admin/posts?secret=${encodeURIComponent(adminSecret.trim())}`);
    if (!res.ok) {
      alert("密钥无效或未授权");
      return;
    }
    const j = await res.json();
    setPendingList(
      j.posts.map((p: any) => ({
        ...p,
        tab: tabOf(p.tag),
        author: p.author_id?.slice(0, 4) || "匿名",
      }))
    );
  }

  async function review(id: string, action: "approve" | "reject") {
    const res = await fetch(`/api/admin/posts?secret=${encodeURIComponent(adminSecret.trim())}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      setPendingList((list) => list.filter((p) => p.id !== id));
      if (action === "approve") loadPosts();
    } else {
      alert("操作失败");
    }
  }

  const list = tab === "all" ? posts : posts.filter((p) => p.tab === tab);

  return (
    <div className="wrap">
      <div className="page-hero">
        <div>
          <h1 className="h-display">求职社区</h1>
          <p>
            薪资爆料 · 面经分享 · 内推码互助。发帖进入审核队列，通过后公开显示。
          </p>
        </div>
        <div className="orbital">
          <button className="inner" onClick={() => (user ? setShowForm(!showForm) : alert("请先登录后再发布"))}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
            {showForm ? "收起" : "发布帖子"}
          </button>
          <button
            className="inner"
            style={{ marginTop: 8 }}
            onClick={() => setAdminMode(!adminMode)}
          >
            {adminMode ? "关闭审核" : "审核入口"}
          </button>
        </div>
      </div>

      {showForm && user && (
        <div className="sub-panel glass" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="标题（≤80字），如：【面经】xx公司一面"
              style={{ padding: "10px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#eeebe3", fontSize: 13.5 }}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="正文（≤2000字）：内容真实、可核实，禁止广告与违规信息"
              rows={4}
              style={{ padding: "10px 14px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#eeebe3", fontSize: 13.5, resize: "vertical" }}
            />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder="标签（薪资/面经/内推…）"
                style={{ flex: 1, minWidth: 140, padding: "8px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#eeebe3", fontSize: 12.5 }}
              />
              <input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="公司（可选）"
                style={{ flex: 1, minWidth: 140, padding: "8px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#eeebe3", fontSize: 12.5 }}
              />
              <label style={{ fontSize: 12, color: "rgba(238,235,227,.75)", display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={reward} onChange={(e) => setReward(e.target.checked)} />
                悬赏帖
              </label>
            </div>
            <button
              onClick={submitPost}
              disabled={submitting}
              style={{ padding: 12, background: "#ca0013", color: "#fff", border: "none", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer" }}
            >
              {submitting ? "提交中…" : "提交（等待审核）"}
            </button>
          </div>
        </div>
      )}

      {adminMode && (
        <div className="sub-panel glass" style={{ marginTop: 16 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="管理密钥（ADMIN_TOKEN）"
              style={{ flex: 1, minWidth: 160, padding: "8px 12px", background: "rgba(255,255,255,.05)", border: "1px solid rgba(255,255,255,.1)", borderRadius: 10, color: "#eeebe3", fontSize: 12.5 }}
            />
            <button
              onClick={loadPending}
              style={{ padding: "9px 16px", background: "rgba(255,255,255,.08)", border: "1px solid rgba(183,198,194,.3)", borderRadius: 10, fontSize: 12.5, fontWeight: 700, color: "#eeebe3", cursor: "pointer" }}
            >
              加载待审
            </button>
          </div>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            {pendingList.length === 0 ? (
              <p style={{ color: "rgba(183,198,194,.6)", fontSize: 12.5 }}>暂无待审帖子</p>
            ) : (
              pendingList.map((p) => (
                <div key={p.id} style={{ border: "1px solid rgba(183,198,194,.2)", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: "#eeebe3" }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: "rgba(183,198,194,.7)", margin: "6px 0" }}>{p.content.slice(0, 200)}</div>
                  <div style={{ fontSize: 11, color: "rgba(183,198,194,.5)" }}>
                    {p.author} · {p.tag || "无标签"}{p.company ? " · " + p.company : ""} · {p.created_at?.slice(0, 10)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button onClick={() => review(p.id, "approve")} style={{ padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      通过
                    </button>
                    <button onClick={() => review(p.id, "reject")} style={{ padding: "6px 14px", background: "rgba(202,0,19,.8)", color: "#fff", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      驳回
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="comm-main">
        <div className="promo-banner glass">
          <div className="p-ic">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <h4>内推广场 · 悬赏招募</h4>
            <p>发内推码 / 面经被采纳，最高可得 ¥50 悬赏 · 发布需通过内容审核</p>
          </div>
        </div>

        <div className="comm-tabs">
          {TABS.map((t) => (
            <button key={t.key} className={tab === t.key ? "on" : ""} onClick={() => setTab(t.key)}>
              {t.label}
            </button>
          ))}
        </div>

        <div>
          {loading ? (
            <p style={{ padding: "30px 0", textAlign: "center", color: "rgba(183,198,194,.6)", fontSize: 12.5 }}>加载中…</p>
          ) : list.length === 0 ? (
            <p style={{ padding: "30px 0", textAlign: "center", color: "rgba(183,198,194,.6)", fontSize: 12.5 }}>
              {tab === "all" ? "还没有已审核的帖子，来发第一帖吧。" : "该分类暂无内容。"}
            </p>
          ) : (
            list.map((p) => (
              <div key={p.id} className="post-card glass">
                <div className="p-av">{p.author.slice(0, 1).toUpperCase()}</div>
                <div className="p-main">
                  <div className="p-title">{p.title}</div>
                  <div className="p-meta">
                    {p.tag && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 9px", borderRadius: 7, background: "rgba(183,198,194,.1)", border: "1px solid rgba(183,198,194,.24)", color: "var(--graygreen)" }}>
                        {p.tag}
                      </span>
                    )}
                    {p.company && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 9px", borderRadius: 7, background: "rgba(183,198,194,.1)", border: "1px solid rgba(183,198,194,.24)", color: "var(--graygreen)" }}>
                        {p.company}
                      </span>
                    )}
                    {p.reward && (
                      <span style={{ fontSize: 9.5, fontWeight: 800, padding: "2px 9px", borderRadius: 7, background: "rgba(202,0,19,.14)", border: "1px solid rgba(202,0,19,.35)", color: "#fda4af" }}>
                        悬赏帖
                      </span>
                    )}
                  </div>
                  <div className="p-sum">{p.content}</div>
                  <div className="p-foot">
                    <span>{p.created_at?.slice(0, 10)}</span>
                    <span>已审核</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
