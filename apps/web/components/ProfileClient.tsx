"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function Switch({
  on,
  onChange,
}: {
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className={"sw" + (on ? " on" : "")}
      onClick={() => onChange(!on)}
      style={{ cursor: "pointer" }}
    />
  );
}

export default function ProfileClient() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [major, setMajor] = useState("");
  const [cohort, setCohort] = useState("");
  const [saved, setSaved] = useState(false);
  const [sw, setSw] = useState({ email: true, push: false, ics: true });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user;
      if (!u) {
        router.push("/login");
        return;
      }
      setUser(u);
      setName(u.user_metadata?.name || "");
      // 从 profiles 表读资料
      supabase
        .from("profiles")
        .select("name, school, major, cohort")
        .eq("id", u.id)
        .single()
        .then(({ data: p }) => {
          if (p) {
            setName(p.name || "");
            setSchool(p.school || "");
            setMajor(p.major || "");
            setCohort(p.cohort || "");
          }
          setLoading(false);
        });
    });
  }, [router]);

  async function saveProfile() {
    if (!user) return;
    await supabase
      .from("profiles")
      .upsert({
        id: user.id,
        email: user.email,
        name, school, major, cohort,
        updated_at: new Date().toISOString(),
      });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) {
    return <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(238,235,227,0.5)" }}>加载中...</div>;
  }

  return (
    <div className="wrap">
      <div className="page-hero" style={{ marginTop: 24 }}>
        <div>
          <h1 className="h-display">我的</h1>
          <p>{user?.email}</p>
        </div>
      </div>

      <div className="profile-grid">
        {/* 个人资料 */}
        <div className="profile-card glass" style={{ gridColumn: "1/-1" }}>
          <h4>个人资料</h4>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>昵称</label>
              <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="你的名字" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>学校</label>
              <input value={school} onChange={(e) => setSchool(e.target.value)} style={inputStyle} placeholder="如：福州大学" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>专业</label>
              <input value={major} onChange={(e) => setMajor(e.target.value)} style={inputStyle} placeholder="如：计算机科学与技术" />
            </div>
            <div>
              <label style={{ fontSize: "12px", color: "rgba(238,235,227,0.6)", display: "block", marginBottom: "4px" }}>届别</label>
              <input value={cohort} onChange={(e) => setCohort(e.target.value)} style={inputStyle} placeholder="如：2027届" />
            </div>
            <button onClick={saveProfile} style={saveBtnStyle}>
              {saved ? "✓ 已保存" : "保存资料"}
            </button>
          </div>
        </div>

        {/* 求职工具 */}
        <div className="profile-card glass" style={{ gridColumn: "1/-1" }}>
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#8b5cf6" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            求职工具
          </h4>
          <div className="tool-grid">
            <Link className="tool-item glass" href="/board">
              <span className="t-ic">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M3 5h18M3 12h18M3 19h18" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <div className="tt">求职看板</div>
                <div className="ts">已投 / 笔试 / 面试 / Offer</div>
              </div>
            </Link>
            <Link className="tool-item glass" href="/match">
              <span className="t-ic">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.2 2.2m8.4 8.4 2.2 2.2m0-12.8-2.2 2.2m-8.4 8.4-2.2 2.2" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <div>
                <div className="tt">AI 匹配</div>
                <div className="ts">简历 → 高匹配岗位</div>
              </div>
            </Link>
            <Link className="tool-item glass" href="/community">
              <span className="t-ic">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                  <path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              </span>
              <div>
                <div className="tt">内推广场</div>
                <div className="ts">悬赏内推码 · 面经</div>
              </div>
            </Link>
          </div>
        </div>

        <div className="profile-card glass">
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#06b6d4" strokeWidth="2" />
                <path d="M12 7v5l3 3" stroke="#06b6d4" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </span>
            数据来源
          </h4>
          <p style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <span className="badge">国家 24365 平台</span>
            <span className="badge">福建就业网</span>
            <span className="badge">福建人才联合网</span>
            <span className="badge">福建理工大学就业网</span>
          </p>
          <p style={{ fontSize: 12, color: "rgba(183,198,194,.6)", marginTop: 10 }}>
            所有岗位均标注来源并跳转官方投递入口，本站不截留简历、不做招聘闭环。
          </p>
        </div>

        <div className="profile-card glass">
          <h4>
            <span className="gicon">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
                <path d="M12 2 3 7v6c0 5 3.8 8.2 9 9 5.2-.8 9-4 9-9V7l-9-5Z" stroke="#ef4444" strokeWidth="2" strokeLinejoin="round" />
              </svg>
            </span>
            关于
          </h4>
          <p style={{ fontSize: 12.5, lineHeight: 1.8, color: "rgba(183,198,194,.75)" }}>
            Offer派 —— 应届生求职信息聚合中台。聚合校招 / 实习信息，提供校招日历、DDL
            提醒、求职看板、AI 匹配与轻社区。聚焦材料 / 计算机 / 软件 / 电子等专业。
          </p>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "10px",
  color: "#eeebe3",
  fontSize: "14px",
  outline: "none",
};

const saveBtnStyle: React.CSSProperties = {
  padding: "12px",
  background: "#ca0013",
  color: "#fff",
  border: "none",
  borderRadius: "10px",
  fontSize: "14px",
  fontWeight: 700,
  cursor: "pointer",
  marginTop: "4px",
};
